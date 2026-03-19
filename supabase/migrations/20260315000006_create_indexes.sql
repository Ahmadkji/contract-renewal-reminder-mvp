-- ============================================
-- Migration: Create Indexes
-- Description: Performance indexes for all tables
-- ============================================

-- Index on contracts.user_id for fast user isolation queries
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);

-- Index on contracts.start_date for queries filtering by start date
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);

-- Index on contracts.end_date for expiring contract queries
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

-- Partial index on reminders.sent_at for scheduler: "find unsent reminders"
-- WHERE sent_at IS NULL makes this index smaller and faster for the scheduler
CREATE INDEX IF NOT EXISTS idx_reminders_sent_at ON reminders(sent_at) WHERE sent_at IS NULL;

-- Index on vendor_contacts.contract_id for foreign key joins
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_contract_id ON vendor_contacts(contract_id);

-- Index on vendor_contacts.email for looking up contacts by email
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_email ON vendor_contacts(email);

-- Index on reminders.contract_id for foreign key joins
CREATE INDEX IF NOT EXISTS idx_reminders_contract_id ON reminders(contract_id);

-- Index on profiles.user_id for fast user profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
