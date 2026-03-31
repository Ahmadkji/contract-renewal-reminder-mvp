-- ============================================
-- Migration: Dead-Letter Deterministic Webhook Failures
-- Description:
--   - Reclassify known non-retryable webhook failures as ignored to prevent
--     unbounded failed-backlog growth and retry amplification.
-- ============================================

UPDATE public.billing_webhook_inbox
SET
  processing_status = 'ignored',
  processing_error = CONCAT('Dead-lettered non-retryable webhook failure: ', processing_error),
  processed_at = COALESCE(processed_at, NOW()),
  processing_claimed_at = NULL,
  processing_claim_token = NULL,
  next_attempt_at = NOW()
WHERE processing_status = 'failed'
  AND (
    processing_error ILIKE '%idx_billing_subscriptions_one_active_per_user%'
    OR processing_error ILIKE '%billing_customers_user_id_fkey%'
  );
