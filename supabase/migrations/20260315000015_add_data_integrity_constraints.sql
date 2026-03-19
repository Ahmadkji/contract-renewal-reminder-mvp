-- ============================================
-- Migration: Add Data Integrity Constraints
-- Description: Fix remaining schema logic issues
-- ============================================

-- ============================================
-- FIX #1: Improve email validation regex
-- ============================================
-- The previous regex '^[^@]+@[^@]+\.[^@]+$' was too permissive
-- It allowed invalid emails like '@.com', 'a@b.c', 'test@.com'
-- New regex follows RFC 5322 simplified standard

ALTER TABLE vendor_contacts 
DROP CONSTRAINT IF EXISTS valid_email,
ADD CONSTRAINT valid_email CHECK (
  email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- ============================================
-- FIX #2: Prevent negative contract values
-- ============================================
-- Contract values should be non-negative (0 or positive)
-- This prevents data entry errors

ALTER TABLE contracts 
ADD CONSTRAINT value_positive CHECK (value >= 0);

-- ============================================
-- FIX #3: Make email_reminders NOT NULL
-- ============================================
-- Ensure email_reminders column always has a value

ALTER TABLE reminders 
ALTER COLUMN email_reminders SET NOT NULL;

-- ============================================
-- FIX #4: Add vendor_contacts.contract_id index
-- ============================================
-- Missing index for foreign key lookups

CREATE INDEX IF NOT EXISTS idx_vendor_contacts_contract_id 
ON vendor_contacts(contract_id);
