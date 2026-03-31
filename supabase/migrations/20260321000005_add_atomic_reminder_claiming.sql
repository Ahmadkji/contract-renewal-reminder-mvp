-- ============================================
-- Migration: Add Atomic Reminder Claiming
-- Description:
--   - Add persisted claim fields for reminder processing
--   - Claim due reminders atomically with FOR UPDATE SKIP LOCKED
--   - Allow crashed workers to be recovered after a claim timeout
-- ============================================

ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS processing_claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_reminders_claimable
  ON public.reminders (sent_at, processing_claimed_at, created_at)
  WHERE sent_at IS NULL;

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
  timezone TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim_token TEXT := NULLIF(btrim(COALESCE(p_claim_token, '')), '');
  v_claim_timeout_seconds INTEGER := GREATEST(COALESCE(p_claim_timeout_seconds, 900), 60);
BEGIN
  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Claim token is required';
  END IF;

  RETURN QUERY
  WITH due_reminders AS (
    SELECT reminders.id
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.profiles AS profiles
      ON profiles.user_id = contracts.user_id
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
    ORDER BY contracts.end_date ASC, reminders.days_before DESC, reminders.created_at ASC
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
    RETURNING
      reminders.id,
      reminders.contract_id,
      reminders.days_before,
      COALESCE(reminders.notify_emails, '{}'::TEXT[]) AS notify_emails
  )
  SELECT
    claimed_reminders.id AS reminder_id,
    contracts.id AS contract_id,
    contracts.user_id,
    contracts.name AS contract_name,
    contracts.vendor,
    contracts.end_date,
    claimed_reminders.days_before,
    claimed_reminders.notify_emails,
    COALESCE(profiles.timezone, 'UTC') AS timezone
  FROM claimed_reminders
  INNER JOIN public.contracts AS contracts
    ON contracts.id = claimed_reminders.contract_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = contracts.user_id
  ORDER BY contracts.end_date ASC, claimed_reminders.days_before DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) TO service_role;
