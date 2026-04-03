-- ============================================
-- Migration: Add Free Email Reminder Quota
-- Description:
--   - Allow free-plan users to send up to 5 reminder emails
--   - Persist reminder send history in an immutable ledger
--   - Enforce quota in the DB mutation and reminder-claim paths
--   - Keep premium reminder delivery unlimited
-- ============================================

-- ============================================
-- Reminder Send Ledger
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_reminder_send_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID,
  reminder_id UUID NOT NULL,
  billing_tier TEXT NOT NULL CHECK (billing_tier IN ('free_trial', 'premium')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_reminder_send_events_reminder_id
  ON public.email_reminder_send_events(reminder_id);

CREATE INDEX IF NOT EXISTS idx_email_reminder_send_events_user_sent_at
  ON public.email_reminder_send_events(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_reminder_send_events_free_trial_user_id
  ON public.email_reminder_send_events(user_id)
  WHERE billing_tier = 'free_trial';

ALTER TABLE public.email_reminder_send_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reminder send events" ON public.email_reminder_send_events;
CREATE POLICY "Users view own reminder send events" ON public.email_reminder_send_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Reminder Quota Helpers
-- ============================================

CREATE OR REPLACE FUNCTION public.get_free_email_reminder_quota(p_user_id UUID)
RETURNS TABLE (
  quota_limit INTEGER,
  used INTEGER,
  remaining INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH usage_counts AS (
    SELECT COUNT(*)::INTEGER AS used_count
    FROM public.email_reminder_send_events
    WHERE user_id = p_user_id
      AND billing_tier = 'free_trial'
  )
  SELECT
    5 AS quota_limit,
    usage_counts.used_count AS used,
    GREATEST(5 - usage_counts.used_count, 0)::INTEGER AS remaining
  FROM usage_counts;
$$;

REVOKE ALL ON FUNCTION public.get_free_email_reminder_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_email_reminder_quota(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_email_reminder_delivery(
  p_reminder_id UUID,
  p_claim_token TEXT,
  p_delivery_tier TEXT,
  p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_token TEXT := NULLIF(BTRIM(COALESCE(p_claim_token, '')), '');
  v_delivery_tier TEXT := NULLIF(BTRIM(COALESCE(p_delivery_tier, '')), '');
  v_sent_at TIMESTAMPTZ := COALESCE(p_sent_at, NOW());
  v_reminder RECORD;
BEGIN
  IF p_reminder_id IS NULL THEN
    RAISE EXCEPTION 'Reminder id is required';
  END IF;

  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Claim token is required';
  END IF;

  IF v_delivery_tier NOT IN ('free_trial', 'premium') THEN
    RAISE EXCEPTION 'Invalid reminder delivery tier';
  END IF;

  SELECT
    reminders.id AS reminder_id,
    contracts.id AS contract_id,
    contracts.user_id
  INTO v_reminder
  FROM public.reminders AS reminders
  INNER JOIN public.contracts AS contracts
    ON contracts.id = reminders.contract_id
  WHERE reminders.id = p_reminder_id
    AND reminders.processing_claim_token = v_claim_token
  FOR UPDATE OF reminders;

  IF v_reminder.reminder_id IS NULL THEN
    RAISE EXCEPTION 'Reminder claim not found or already completed';
  END IF;

  INSERT INTO public.email_reminder_send_events (
    user_id,
    contract_id,
    reminder_id,
    billing_tier,
    sent_at
  )
  VALUES (
    v_reminder.user_id,
    v_reminder.contract_id,
    v_reminder.reminder_id,
    v_delivery_tier,
    v_sent_at
  )
  ON CONFLICT (reminder_id) DO NOTHING;

  UPDATE public.reminders
  SET
    sent_at = v_sent_at,
    processing_claimed_at = NULL,
    processing_claim_token = NULL
  WHERE id = p_reminder_id
    AND processing_claim_token = v_claim_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to finalize reminder delivery';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ============================================
-- Contract mutation functions (free reminder quota + premium controls)
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
  v_existing_email_reminders BOOLEAN := FALSE;
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

  SELECT email_reminders
  INTO v_existing_email_reminders
  FROM public.contracts
  WHERE id = p_contract_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;

  v_is_premium := public.is_user_premium(v_user_id);

  IF NOT v_is_premium AND v_email_reminders THEN
    IF COALESCE(array_length(v_notify_emails, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Additional reminder recipients require an active premium subscription';
    END IF;

    IF NOT COALESCE(v_existing_email_reminders, FALSE) THEN
      SELECT remaining
      INTO v_free_quota_remaining
      FROM public.get_free_email_reminder_quota(v_user_id);

      IF COALESCE(v_free_quota_remaining, 0) <= 0 THEN
        RAISE EXCEPTION 'Free email reminder quota exhausted';
      END IF;
    END IF;
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
    email_reminders = v_email_reminders,
    updated_at = NOW()
  WHERE id = p_contract_id
    AND user_id = v_user_id
  RETURNING id INTO v_contract_id;

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

-- ============================================
-- Reminder processors (premium + free-trial quota)
-- ============================================

DROP FUNCTION IF EXISTS public.get_due_email_reminders(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.get_due_email_reminders(TIMESTAMPTZ, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_due_email_reminders(
  p_reference_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100,
  p_claim_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  reminder_id UUID,
  contract_id UUID,
  user_id UUID,
  contract_name TEXT,
  vendor TEXT,
  end_date DATE,
  days_before INTEGER,
  notify_emails TEXT[],
  timezone TEXT,
  delivery_tier TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base_due AS (
    SELECT
      reminders.id AS reminder_id,
      contracts.id AS contract_id,
      contracts.user_id,
      contracts.name AS contract_name,
      contracts.vendor,
      contracts.end_date,
      reminders.days_before,
      COALESCE(reminders.notify_emails, '{}'::TEXT[]) AS notify_emails,
      COALESCE(profiles.timezone, 'UTC') AS timezone,
      reminders.created_at AS reminder_created_at,
      COALESCE(entitlements.is_premium, FALSE) AS is_premium
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.profiles AS profiles
      ON profiles.user_id = contracts.user_id
    LEFT JOIN public.entitlement_snapshots AS entitlements
      ON entitlements.user_id = contracts.user_id
    WHERE reminders.sent_at IS NULL
      AND contracts.email_reminders = TRUE
      AND COALESCE(profiles.email_notifications, TRUE) = TRUE
      AND (contracts.end_date - reminders.days_before) = (
        (p_reference_time AT TIME ZONE COALESCE(profiles.timezone, 'UTC'))::DATE
      )
  ),
  free_usage AS (
    SELECT
      events.user_id,
      COUNT(*)::INTEGER AS used
    FROM public.email_reminder_send_events AS events
    WHERE events.billing_tier = 'free_trial'
    GROUP BY events.user_id
  ),
  active_free_claims AS (
    SELECT
      contracts.user_id,
      COUNT(*)::INTEGER AS reserved
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.entitlement_snapshots AS entitlements
      ON entitlements.user_id = contracts.user_id
    WHERE reminders.sent_at IS NULL
      AND reminders.processing_claimed_at IS NOT NULL
      AND reminders.processing_claimed_at > (
        p_reference_time - make_interval(secs => GREATEST(COALESCE(p_claim_timeout_seconds, 900), 60))
      )
      AND COALESCE(entitlements.is_premium, FALSE) = FALSE
    GROUP BY contracts.user_id
  ),
  ranked_due AS (
    SELECT
      base_due.reminder_id,
      base_due.contract_id,
      base_due.user_id,
      base_due.contract_name,
      base_due.vendor,
      base_due.end_date,
      base_due.days_before,
      base_due.notify_emails,
      base_due.timezone,
      base_due.reminder_created_at,
      base_due.is_premium,
      COALESCE(free_usage.used, 0) AS free_trial_used,
      COALESCE(active_free_claims.reserved, 0) AS free_trial_reserved,
      GREATEST(5 - COALESCE(free_usage.used, 0) - COALESCE(active_free_claims.reserved, 0), 0) AS free_trial_remaining,
      ROW_NUMBER() OVER (
        PARTITION BY base_due.user_id
        ORDER BY base_due.end_date ASC, base_due.days_before DESC, base_due.reminder_created_at ASC, base_due.reminder_id ASC
      ) AS user_due_rank
    FROM base_due
    LEFT JOIN free_usage
      ON free_usage.user_id = base_due.user_id
    LEFT JOIN active_free_claims
      ON active_free_claims.user_id = base_due.user_id
  )
  SELECT
    ranked_due.reminder_id,
    ranked_due.contract_id,
    ranked_due.user_id,
    ranked_due.contract_name,
    ranked_due.vendor,
    ranked_due.end_date,
    ranked_due.days_before,
    ranked_due.notify_emails,
    ranked_due.timezone,
    CASE
      WHEN ranked_due.is_premium THEN 'premium'
      ELSE 'free_trial'
    END AS delivery_tier
  FROM ranked_due
  WHERE ranked_due.is_premium = TRUE
    OR ranked_due.user_due_rank <= ranked_due.free_trial_remaining
  ORDER BY ranked_due.end_date ASC, ranked_due.days_before DESC, ranked_due.reminder_created_at ASC, ranked_due.reminder_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

DROP FUNCTION IF EXISTS public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.claim_due_email_reminders(
  p_reference_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100,
  p_claim_token TEXT DEFAULT NULL,
  p_claim_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  reminder_id UUID,
  contract_id UUID,
  user_id UUID,
  contract_name TEXT,
  vendor TEXT,
  end_date DATE,
  days_before INTEGER,
  notify_emails TEXT[],
  timezone TEXT,
  delivery_tier TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim_token TEXT := NULLIF(BTRIM(COALESCE(p_claim_token, '')), '');
  v_claim_timeout_seconds INTEGER := GREATEST(COALESCE(p_claim_timeout_seconds, 900), 60);
BEGIN
  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Claim token is required';
  END IF;

  RETURN QUERY
  WITH base_due AS (
    SELECT
      reminders.id AS reminder_id,
      contracts.id AS contract_id,
      contracts.user_id,
      contracts.name AS contract_name,
      contracts.vendor,
      contracts.end_date,
      reminders.days_before,
      COALESCE(reminders.notify_emails, '{}'::TEXT[]) AS notify_emails,
      COALESCE(profiles.timezone, 'UTC') AS timezone,
      reminders.created_at AS reminder_created_at,
      COALESCE(entitlements.is_premium, FALSE) AS is_premium
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.profiles AS profiles
      ON profiles.user_id = contracts.user_id
    LEFT JOIN public.entitlement_snapshots AS entitlements
      ON entitlements.user_id = contracts.user_id
    WHERE reminders.sent_at IS NULL
      AND (
        reminders.processing_claimed_at IS NULL
        OR reminders.processing_claimed_at <= (
          p_reference_time - make_interval(secs => v_claim_timeout_seconds)
        )
      )
      AND contracts.email_reminders = TRUE
      AND COALESCE(profiles.email_notifications, TRUE) = TRUE
      AND (contracts.end_date - reminders.days_before) = (
        (p_reference_time AT TIME ZONE COALESCE(profiles.timezone, 'UTC'))::DATE
      )
  ),
  free_usage AS (
    SELECT
      events.user_id,
      COUNT(*)::INTEGER AS used
    FROM public.email_reminder_send_events AS events
    WHERE events.billing_tier = 'free_trial'
    GROUP BY events.user_id
  ),
  active_free_claims AS (
    SELECT
      contracts.user_id,
      COUNT(*)::INTEGER AS reserved
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.entitlement_snapshots AS entitlements
      ON entitlements.user_id = contracts.user_id
    WHERE reminders.sent_at IS NULL
      AND reminders.processing_claimed_at IS NOT NULL
      AND reminders.processing_claimed_at > (
        p_reference_time - make_interval(secs => v_claim_timeout_seconds)
      )
      AND COALESCE(entitlements.is_premium, FALSE) = FALSE
    GROUP BY contracts.user_id
  ),
  ranked_due AS (
    SELECT
      base_due.reminder_id,
      base_due.contract_id,
      base_due.user_id,
      base_due.contract_name,
      base_due.vendor,
      base_due.end_date,
      base_due.days_before,
      base_due.notify_emails,
      base_due.timezone,
      base_due.reminder_created_at,
      base_due.is_premium,
      COALESCE(free_usage.used, 0) AS free_trial_used,
      COALESCE(active_free_claims.reserved, 0) AS free_trial_reserved,
      GREATEST(5 - COALESCE(free_usage.used, 0) - COALESCE(active_free_claims.reserved, 0), 0) AS free_trial_remaining,
      ROW_NUMBER() OVER (
        PARTITION BY base_due.user_id
        ORDER BY base_due.end_date ASC, base_due.days_before DESC, base_due.reminder_created_at ASC, base_due.reminder_id ASC
      ) AS user_due_rank
    FROM base_due
    LEFT JOIN free_usage
      ON free_usage.user_id = base_due.user_id
    LEFT JOIN active_free_claims
      ON active_free_claims.user_id = base_due.user_id
  ),
  candidate_due AS (
    SELECT
      ranked_due.reminder_id,
      ranked_due.contract_id,
      ranked_due.user_id,
      ranked_due.contract_name,
      ranked_due.vendor,
      ranked_due.end_date,
      ranked_due.days_before,
      ranked_due.notify_emails,
      ranked_due.timezone,
      ranked_due.reminder_created_at,
      CASE
        WHEN ranked_due.is_premium THEN 'premium'
        ELSE 'free_trial'
      END AS delivery_tier
    FROM ranked_due
    WHERE ranked_due.is_premium = TRUE
       OR (
         ranked_due.user_due_rank <= ranked_due.free_trial_remaining
         AND pg_try_advisory_xact_lock(hashtextextended(ranked_due.user_id::TEXT, 931005))
       )
  ),
  due_reminders AS (
    SELECT reminders.id
    FROM public.reminders AS reminders
    INNER JOIN candidate_due
      ON candidate_due.reminder_id = reminders.id
    ORDER BY candidate_due.end_date ASC, candidate_due.days_before DESC, candidate_due.reminder_created_at ASC, candidate_due.reminder_id ASC
    FOR UPDATE OF reminders SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  ),
  claimed_reminders AS (
    UPDATE public.reminders AS reminders
    SET
      processing_claimed_at = p_reference_time,
      processing_claim_token = v_claim_token
    FROM due_reminders
    WHERE reminders.id = due_reminders.id
    RETURNING reminders.id
  )
  SELECT
    candidate_due.reminder_id,
    candidate_due.contract_id,
    candidate_due.user_id,
    candidate_due.contract_name,
    candidate_due.vendor,
    candidate_due.end_date,
    candidate_due.days_before,
    candidate_due.notify_emails,
    candidate_due.timezone,
    candidate_due.delivery_tier
  FROM candidate_due
  INNER JOIN claimed_reminders
    ON claimed_reminders.id = candidate_due.reminder_id
  ORDER BY candidate_due.end_date ASC, candidate_due.days_before DESC, candidate_due.reminder_created_at ASC, candidate_due.reminder_id ASC;
END;
$$;
