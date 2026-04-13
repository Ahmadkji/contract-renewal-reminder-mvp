-- ============================================
-- Migration: Restrict Reminder Processor RPC Access
-- Description:
--   - Ensure reminder claim/finalize RPCs are callable only by service_role
--   - Prevent authenticated/anon clients from directly invoking background-job functions
-- ============================================

REVOKE ALL ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_email_reminders(TIMESTAMPTZ, INTEGER, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_reminder_delivery(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
