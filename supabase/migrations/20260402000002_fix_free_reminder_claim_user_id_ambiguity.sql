-- ============================================
-- Migration: Fix Free Reminder Claim User Id Ambiguity
-- Description:
--   - Qualify free-usage CTE columns inside the PL/pgSQL reminder claim function
--   - Avoid collision with RETURNS TABLE output variables
-- ============================================

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
