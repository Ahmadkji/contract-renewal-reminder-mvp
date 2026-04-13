-- ============================================
-- Migration: Enforce Reminder Data Integrity
-- Description:
--   - Add UNIQUE constraint to prevent duplicate reminders
--   - Add trigger to protect sent_at immutability
--   - Ensure database enforces correctness, not just application code
-- ============================================

-- Step 1: Add UNIQUE constraint on (contract_id, days_before)
-- This prevents ghost reminders and duplicates
ALTER TABLE public.reminders
ADD CONSTRAINT unique_contract_reminder
UNIQUE (contract_id, days_before);

-- Step 2: Create function to prevent sent_at updates after it's set
CREATE OR REPLACE FUNCTION public.prevent_sent_at_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If sent_at was already set and someone tries to change it
  IF OLD.sent_at IS NOT NULL AND NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'sent_at is immutable once set. Reminder already sent at %', OLD.sent_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Attach trigger to reminders table
CREATE TRIGGER lock_sent_at_after_send
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sent_at_update();

-- Step 4: Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_contract_reminder ON public.reminders IS 
  'Ensures only one reminder exists per contract per days_before value. Prevents ghost reminders and duplicates.';

COMMENT ON TRIGGER lock_sent_at_after_send ON public.reminders IS
  'Protects idempotency by preventing sent_at from being modified once set.';
