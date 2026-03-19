-- ============================================
-- Migration: Fix Schema Issues
-- Description: Fix critical data integrity and performance issues identified in production audit
-- ============================================

-- Enable pg_trgm extension for GIN indexes on text columns
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- FIX #1: Make reminder_days NOT NULL with CHECK constraint
-- ============================================

-- First, ensure the columns exist (in case migration11 didn't apply correctly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'reminder_days'
  ) THEN
    ALTER TABLE reminders ADD COLUMN reminder_days INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'email_reminders'
  ) THEN
    ALTER TABLE reminders ADD COLUMN email_reminders BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update any existing NULL values
UPDATE reminders
SET reminder_days = days_before
WHERE reminder_days IS NULL;

-- Make reminder_days NOT NULL and add CHECK constraint
ALTER TABLE reminders
  ALTER COLUMN reminder_days SET NOT NULL,
  ADD CONSTRAINT reminder_days_positive CHECK (reminder_days > 0);

-- ============================================
-- FIX #2: Add GIN indexes for case-insensitive search on contracts
-- ============================================

-- Add GIN indexes for name and vendor columns (using trigram matching)
CREATE INDEX IF NOT EXISTS idx_contracts_name_gin ON contracts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_gin ON contracts USING gin (vendor gin_trgm_ops);

-- ============================================
-- FIX #3: Add unique constraint to prevent duplicate reminders
-- ============================================

-- First, remove any existing duplicates (keep the first one)
DELETE FROM reminders
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY contract_id, days_before ORDER BY created_at) as rn
    FROM reminders
  ) t
  WHERE rn > 1
);

-- Add unique constraint
ALTER TABLE reminders 
  ADD CONSTRAINT unique_contract_days_before 
  UNIQUE (contract_id, days_before);

-- ============================================
-- FIX #4: Replace single-column index with composite index
-- ============================================

-- Drop the existing single-column index
DROP INDEX IF EXISTS idx_contracts_end_date;

-- Create composite index on (user_id, end_date)
CREATE INDEX IF NOT EXISTS idx_contracts_user_id_end_date 
  ON contracts(user_id, end_date);

-- ============================================
-- FIX #5: Add index on contracts.type for filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);

-- ============================================
-- FIX #6: Add index on reminders.days_before for filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reminders_days_before ON reminders(days_before);

-- ============================================
-- FIX #7: Add index on vendor_contacts.contact_name for search
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vendor_contacts_contact_name ON vendor_contacts(contact_name);

-- ============================================
-- Additional optimization: Composite index for auto_renew filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contracts_user_id_auto_renew ON contracts(user_id, auto_renew);

-- ============================================
-- Additional optimization: Composite index for type filtering with user_id
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contracts_user_id_type ON contracts(user_id, type);

-- ============================================
-- Additional optimization: Index on contracts.value for financial queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contracts_value ON contracts(value) WHERE value IS NOT NULL;
