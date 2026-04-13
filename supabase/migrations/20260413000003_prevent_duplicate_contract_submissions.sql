-- ============================================
-- Migration: Prevent Duplicate Contract Submissions
-- Description:
--   - Deduplicate concurrent/retried identical create-contract requests
--   - Keep behavior atomic using existing per-user advisory lock
--   - Return existing contract id when payload matches a very recent create
-- ============================================

CREATE OR REPLACE FUNCTION public.create_contract_with_relations(
  p_user_id UUID,
  p_name TEXT,
  p_vendor TEXT,
  p_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_value DECIMAL,
  p_currency TEXT,
  p_auto_renew BOOLEAN,
  p_renewal_terms TEXT,
  p_notes TEXT,
  p_tags TEXT[],
  p_vendor_contact TEXT,
  p_vendor_email TEXT,
  p_reminder_days INTEGER[],
  p_email_reminders BOOLEAN,
  p_notify_emails TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_existing_contract_id UUID;
  v_user_id UUID := auth.uid();
  v_name TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_vendor TEXT := NULLIF(BTRIM(COALESCE(p_vendor, '')), '');
  v_currency TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_currency, '')), ''), 'USD');
  v_renewal_terms TEXT := NULLIF(BTRIM(COALESCE(p_renewal_terms, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_vendor_contact TEXT := NULLIF(BTRIM(COALESCE(p_vendor_contact, '')), '');
  v_vendor_email TEXT := NULLIF(BTRIM(COALESCE(p_vendor_email, '')), '');
  v_email_reminders BOOLEAN := COALESCE(p_email_reminders, FALSE);
  v_is_premium BOOLEAN;
  v_contract_count INTEGER;
  v_free_quota_remaining INTEGER := 0;
  v_tags TEXT[] := ARRAY(
    SELECT normalized_tag
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_tag), '') AS normalized_tag
      FROM unnest(COALESCE(p_tags, '{}'::TEXT[])) AS raw_tag
    ) normalized
    WHERE normalized_tag IS NOT NULL
    ORDER BY normalized_tag
  );
  v_notify_emails TEXT[] := ARRAY(
    SELECT normalized_email
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_email), '') AS normalized_email
      FROM unnest(COALESCE(p_notify_emails, '{}'::TEXT[])) AS raw_email
    ) normalized
    WHERE normalized_email IS NOT NULL
    ORDER BY normalized_email
  );
  v_reminder_days INTEGER[] := ARRAY(
    SELECT DISTINCT reminder_day
    FROM unnest(COALESCE(p_reminder_days, '{}'::INTEGER[])) AS reminder_day
    WHERE reminder_day BETWEEN 1 AND 365
    ORDER BY reminder_day
  );
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  IF v_name IS NULL OR v_vendor IS NULL THEN
    RAISE EXCEPTION 'Contract name and vendor are required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF (v_vendor_contact IS NULL) <> (v_vendor_email IS NULL) THEN
    RAISE EXCEPTION 'Vendor contact and vendor email must both be provided together';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));

  -- Deduplicate identical create requests in a short retry window.
  SELECT contracts.id
  INTO v_existing_contract_id
  FROM public.contracts AS contracts
  WHERE contracts.user_id = v_user_id
    AND contracts.name = v_name
    AND contracts.vendor = v_vendor
    AND contracts.type = p_type
    AND contracts.start_date = p_start_date
    AND contracts.end_date = p_end_date
    AND contracts.value IS NOT DISTINCT FROM p_value
    AND contracts.currency = v_currency
    AND contracts.auto_renew = COALESCE(p_auto_renew, FALSE)
    AND contracts.renewal_terms IS NOT DISTINCT FROM v_renewal_terms
    AND contracts.notes IS NOT DISTINCT FROM v_notes
    AND contracts.tags = COALESCE(v_tags, '{}'::TEXT[])
    AND contracts.email_reminders = v_email_reminders
    AND contracts.created_at >= (NOW() - INTERVAL '120 seconds')
    AND (
      (v_vendor_contact IS NULL AND NOT EXISTS (
        SELECT 1
        FROM public.vendor_contacts AS vendor_contacts
        WHERE vendor_contacts.contract_id = contracts.id
      ))
      OR (
        v_vendor_contact IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.vendor_contacts AS vendor_contacts
          WHERE vendor_contacts.contract_id = contracts.id
            AND vendor_contacts.contact_name = v_vendor_contact
            AND vendor_contacts.email = v_vendor_email
        )
      )
    )
    AND COALESCE(
      (
        SELECT array_agg(reminders.days_before ORDER BY reminders.days_before)
        FROM public.reminders AS reminders
        WHERE reminders.contract_id = contracts.id
      ),
      '{}'::INTEGER[]
    ) = COALESCE(v_reminder_days, '{}'::INTEGER[])
    AND COALESCE(
      (
        SELECT bool_and(
          COALESCE(reminders.notify_emails, '{}'::TEXT[]) = COALESCE(v_notify_emails, '{}'::TEXT[])
        )
        FROM public.reminders AS reminders
        WHERE reminders.contract_id = contracts.id
      ),
      TRUE
    )
  ORDER BY contracts.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_contract_id IS NOT NULL THEN
    RETURN v_existing_contract_id;
  END IF;

  v_is_premium := public.is_user_premium(v_user_id);

  IF NOT v_is_premium THEN
    SELECT COUNT(*)
    INTO v_contract_count
    FROM public.contracts
    WHERE user_id = v_user_id;

    IF v_contract_count >= 5 THEN
      RAISE EXCEPTION 'Free plan contract limit reached';
    END IF;

    IF v_email_reminders THEN
      IF COALESCE(array_length(v_notify_emails, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Additional reminder recipients require an active premium subscription';
      END IF;

      SELECT remaining
      INTO v_free_quota_remaining
      FROM public.get_free_email_reminder_quota(v_user_id);

      IF COALESCE(v_free_quota_remaining, 0) <= 0 THEN
        RAISE EXCEPTION 'Free email reminder quota exhausted';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.contracts (
    user_id,
    name,
    vendor,
    type,
    start_date,
    end_date,
    value,
    currency,
    auto_renew,
    renewal_terms,
    notes,
    tags,
    email_reminders
  )
  VALUES (
    p_user_id,
    v_name,
    v_vendor,
    p_type,
    p_start_date,
    p_end_date,
    p_value,
    v_currency,
    COALESCE(p_auto_renew, FALSE),
    v_renewal_terms,
    v_notes,
    COALESCE(v_tags, '{}'::TEXT[]),
    v_email_reminders
  )
  RETURNING id INTO v_contract_id;

  IF v_vendor_contact IS NOT NULL THEN
    INSERT INTO public.vendor_contacts (
      contract_id,
      contact_name,
      email
    )
    VALUES (
      v_contract_id,
      v_vendor_contact,
      v_vendor_email
    );
  END IF;

  IF COALESCE(array_length(v_reminder_days, 1), 0) > 0 THEN
    INSERT INTO public.reminders (
      contract_id,
      days_before,
      notify_emails
    )
    SELECT
      v_contract_id,
      reminder_day,
      COALESCE(v_notify_emails, '{}'::TEXT[])
    FROM unnest(v_reminder_days) AS reminder_day;
  END IF;

  RETURN v_contract_id;
END;
$$;
