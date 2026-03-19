-- ============================================
-- Migration: Enable RLS and Create Policies
-- Description: Row Level Security policies for user data isolation
-- ============================================

-- Enable Row Level Security on all user tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and modify their own contracts
-- USING clause: Controls SELECT, UPDATE, DELETE operations
-- WITH CHECK clause: Controls INSERT operations (prevents inserting rows for other users)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for policies, so we drop first
DROP POLICY IF EXISTS "Users manage own contracts" ON contracts;
CREATE POLICY "Users manage own contracts" ON contracts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only see and modify vendor contacts for their own contracts
-- Uses EXISTS subquery to check ownership through the contract foreign key
-- SECURITY FIX: Added WITH CHECK clause to prevent INSERT violations
-- Note: PostgreSQL doesn't support IF NOT EXISTS for policies, so we drop first
DROP POLICY IF EXISTS "Users manage own vendor_contacts" ON vendor_contacts;
CREATE POLICY "Users manage own vendor_contacts" ON vendor_contacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = vendor_contacts.contract_id
        AND contracts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = vendor_contacts.contract_id
        AND contracts.user_id = auth.uid()
    )
  );

-- Policy: Users can only see and modify reminders for their own contracts
-- Uses EXISTS subquery to check ownership through the contract foreign key
-- SECURITY FIX: Added WITH CHECK clause to prevent INSERT violations
-- Note: PostgreSQL doesn't support IF NOT EXISTS for policies, so we drop first
DROP POLICY IF EXISTS "Users manage own reminders" ON reminders;
CREATE POLICY "Users manage own reminders" ON reminders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = reminders.contract_id
        AND contracts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = reminders.contract_id
        AND contracts.user_id = auth.uid()
    )
  );

-- Policy: Users can only see and modify their own profile
-- USING clause: Controls SELECT, UPDATE, DELETE operations
-- WITH CHECK clause: Controls INSERT operations (prevents inserting profiles for other users)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for policies, so we drop first
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
