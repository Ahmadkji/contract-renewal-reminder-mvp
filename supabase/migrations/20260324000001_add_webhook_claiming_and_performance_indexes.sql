-- ============================================
-- Migration: Webhook claiming + performance hardening indexes
-- Description:
--   - Add async claim/retry metadata for billing webhook inbox
--   - Add claim function using FOR UPDATE SKIP LOCKED
--   - Restore critical contracts query/search indexes
--   - Add worker/backlog indexes for webhook and reminders
-- ============================================

-- Enable trigram support for ILIKE acceleration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.billing_webhook_inbox
ADD COLUMN IF NOT EXISTS processing_claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_claim_token TEXT,
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Normalize existing rows so retry scheduler has deterministic values.
UPDATE public.billing_webhook_inbox
SET
  attempt_count = COALESCE(attempt_count, 0),
  next_attempt_at = CASE
    WHEN processing_status IN ('processed', 'ignored') THEN COALESCE(processed_at, NOW())
    ELSE COALESCE(next_attempt_at, NOW())
  END,
  processing_claimed_at = CASE
    WHEN processing_status IN ('processed', 'ignored') THEN NULL
    ELSE processing_claimed_at
  END,
  processing_claim_token = CASE
    WHEN processing_status IN ('processed', 'ignored') THEN NULL
    ELSE processing_claim_token
  END;

CREATE INDEX IF NOT EXISTS idx_contracts_user_id_end_date
  ON public.contracts(user_id, end_date);

CREATE INDEX IF NOT EXISTS idx_contracts_name_gin
  ON public.contracts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contracts_vendor_gin
  ON public.contracts USING gin (vendor gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_inbox_claimable
  ON public.billing_webhook_inbox(processing_status, next_attempt_at, received_at, processing_claimed_at)
  WHERE processing_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_billing_webhook_inbox_claim_token
  ON public.billing_webhook_inbox(processing_claim_token)
  WHERE processing_claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_stuck_claims
  ON public.reminders(processing_claimed_at)
  WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_pending_billing_webhook_events(
  p_reference_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100,
  p_claim_token TEXT DEFAULT NULL,
  p_claim_timeout_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  provider_event_id TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim_token TEXT := NULLIF(BTRIM(COALESCE(p_claim_token, '')), '');
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 100), 1);
  v_claim_timeout_seconds INTEGER := GREATEST(COALESCE(p_claim_timeout_seconds, 300), 30);
BEGIN
  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Claim token is required';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT inbox.provider_event_id
    FROM public.billing_webhook_inbox AS inbox
    WHERE inbox.processing_status IN ('pending', 'failed')
      AND COALESCE(inbox.next_attempt_at, TIMESTAMPTZ 'epoch') <= p_reference_time
      AND (
        inbox.processing_claimed_at IS NULL
        OR inbox.processing_claimed_at <= (
          p_reference_time - make_interval(secs => v_claim_timeout_seconds)
        )
      )
    ORDER BY inbox.received_at ASC
    FOR UPDATE OF inbox SKIP LOCKED
    LIMIT v_limit
  ),
  claimed AS (
    UPDATE public.billing_webhook_inbox AS inbox
    SET
      processing_claimed_at = p_reference_time,
      processing_claim_token = v_claim_token
    FROM claimable
    WHERE inbox.provider_event_id = claimable.provider_event_id
    RETURNING inbox.provider_event_id
  )
  SELECT claimed.provider_event_id
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_billing_webhook_events(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_billing_webhook_events(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) TO service_role;
