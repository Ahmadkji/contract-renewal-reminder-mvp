-- ============================================
-- Migration: Create Vendor Contacts Table
-- Description: Vendor contact information with foreign key to contracts
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  CONSTRAINT valid_email CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
