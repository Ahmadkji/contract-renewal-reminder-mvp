-- ============================================
-- Migration: Resolve Active Subscription Insert Conflicts
-- Description:
--   - Prevent active-subscription unique-index collisions when a new
--     provider subscription arrives for a user with an already-active row.
--   - Cleanup deterministic failed webhook retries caused by this constraint.
-- ============================================

CREATE OR REPLACE FUNCTION public.resolve_billing_active_subscription_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN (
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'subscription.active',
    'subscription.paid',
    'subscription.trialing',
    'subscription.scheduled_cancel',
    'subscription.past_due',
    'subscription.unpaid'
  ) THEN
    UPDATE public.billing_subscriptions
    SET
      status = 'canceled',
      cancel_at_period_end = FALSE,
      canceled_at = COALESCE(canceled_at, NOW()),
      updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND provider_subscription_id <> NEW.provider_subscription_id
      AND status IN (
        'active',
        'trialing',
        'past_due',
        'unpaid',
        'subscription.active',
        'subscription.paid',
        'subscription.trialing',
        'subscription.scheduled_cancel',
        'subscription.past_due',
        'subscription.unpaid'
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_billing_active_subscription_conflict() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_billing_active_subscription_conflict() TO service_role;

DROP TRIGGER IF EXISTS trg_resolve_billing_active_subscription_conflict
  ON public.billing_subscriptions;

CREATE TRIGGER trg_resolve_billing_active_subscription_conflict
BEFORE INSERT ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.resolve_billing_active_subscription_conflict();

-- Cleanup known deterministic failed webhook backlog entries so reconcile
-- workers can focus on new work after this fix is deployed.
UPDATE public.billing_webhook_inbox
SET
  processing_status = 'ignored',
  processing_error = CONCAT('Dead-lettered after conflict-resolution migration: ', processing_error),
  processed_at = COALESCE(processed_at, NOW()),
  processing_claimed_at = NULL,
  processing_claim_token = NULL,
  next_attempt_at = NOW()
WHERE processing_status = 'failed'
  AND processing_error ILIKE '%idx_billing_subscriptions_one_active_per_user%';
