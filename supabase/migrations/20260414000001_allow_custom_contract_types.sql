-- ============================================
-- Migration: Allow Custom Contract Types
-- Description:
--   - Remove restrictive contract type check (license/service/support/subscription only)
--   - Keep a minimal safety check so type cannot be blank
-- ============================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Legacy check from initial schema: type IN ('license', 'service', 'support', 'subscription')
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.contracts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%license%'
    AND pg_get_constraintdef(oid) ILIKE '%service%'
    AND pg_get_constraintdef(oid) ILIKE '%support%'
    AND pg_get_constraintdef(oid) ILIKE '%subscription%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.contracts DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.contracts'::regclass
      AND conname = 'contracts_type_not_blank_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_type_not_blank_check
      CHECK (char_length(btrim(type)) > 0);
  END IF;
END
$$;
