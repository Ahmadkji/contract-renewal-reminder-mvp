-- ============================================
-- Migration: Harden Contract RPC Input Normalization
-- Description:
--   - Normalize direct RPC inputs inside the database functions
--   - Trim empty strings to NULL
--   - De-duplicate tags and notification emails
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
  p_notify_emails TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_user_id UUID := auth.uid();
  v_name TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_vendor TEXT := NULLIF(btrim(COALESCE(p_vendor, '')), '');
  v_currency TEXT := COALESCE(NULLIF(btrim(COALESCE(p_currency, '')), ''), 'USD');
  v_renewal_terms TEXT := NULLIF(btrim(COALESCE(p_renewal_terms, '')), '');
  v_notes TEXT := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_vendor_contact TEXT := NULLIF(btrim(COALESCE(p_vendor_contact, '')), '');
  v_vendor_email TEXT := NULLIF(btrim(COALESCE(p_vendor_email, '')), '');
  v_tags TEXT[] := ARRAY(
    SELECT normalized_tag
    FROM (
      SELECT DISTINCT NULLIF(btrim(raw_tag), '') AS normalized_tag
      FROM unnest(COALESCE(p_tags, '{}'::TEXT[])) AS raw_tag
    ) normalized
    WHERE normalized_tag IS NOT NULL
    ORDER BY normalized_tag
  );
  v_notify_emails TEXT[] := ARRAY(
    SELECT normalized_email
    FROM (
      SELECT DISTINCT NULLIF(btrim(raw_email), '') AS normalized_email
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
    tags
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
    COALESCE(v_tags, '{}'::TEXT[])
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

CREATE OR REPLACE FUNCTION public.update_contract_with_relations(
  p_contract_id UUID,
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
  p_notify_emails TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_user_id UUID := auth.uid();
  v_name TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_vendor TEXT := NULLIF(btrim(COALESCE(p_vendor, '')), '');
  v_currency TEXT := COALESCE(NULLIF(btrim(COALESCE(p_currency, '')), ''), 'USD');
  v_renewal_terms TEXT := NULLIF(btrim(COALESCE(p_renewal_terms, '')), '');
  v_notes TEXT := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_vendor_contact TEXT := NULLIF(btrim(COALESCE(p_vendor_contact, '')), '');
  v_vendor_email TEXT := NULLIF(btrim(COALESCE(p_vendor_email, '')), '');
  v_tags TEXT[] := ARRAY(
    SELECT normalized_tag
    FROM (
      SELECT DISTINCT NULLIF(btrim(raw_tag), '') AS normalized_tag
      FROM unnest(COALESCE(p_tags, '{}'::TEXT[])) AS raw_tag
    ) normalized
    WHERE normalized_tag IS NOT NULL
    ORDER BY normalized_tag
  );
  v_notify_emails TEXT[] := ARRAY(
    SELECT normalized_email
    FROM (
      SELECT DISTINCT NULLIF(btrim(raw_email), '') AS normalized_email
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

  UPDATE public.contracts
  SET
    name = v_name,
    vendor = v_vendor,
    type = p_type,
    start_date = p_start_date,
    end_date = p_end_date,
    value = p_value,
    currency = v_currency,
    auto_renew = COALESCE(p_auto_renew, FALSE),
    renewal_terms = v_renewal_terms,
    notes = v_notes,
    tags = COALESCE(v_tags, '{}'::TEXT[]),
    updated_at = NOW()
  WHERE id = p_contract_id
    AND user_id = v_user_id
  RETURNING id INTO v_contract_id;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;

  DELETE FROM public.vendor_contacts
  WHERE contract_id = v_contract_id;

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

  DELETE FROM public.reminders
  WHERE contract_id = v_contract_id;

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
