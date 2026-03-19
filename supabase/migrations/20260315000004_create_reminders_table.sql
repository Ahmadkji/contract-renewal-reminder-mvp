-- ============================================
-- Migration: Create Reminders Table
-- Description: Email reminder system with foreign key to contracts
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL CHECK (days_before > 0),
  notify_emails TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
