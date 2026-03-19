-- ============================================
-- Migration: Grant Permissions
-- Description: Grant permissions to authenticated role
-- ============================================

-- Grant schema usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant full CRUD permissions on contracts table to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO authenticated;

-- Grant full CRUD permissions on vendor_contacts table to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_contacts TO authenticated;

-- Grant full CRUD permissions on reminders table to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON reminders TO authenticated;

-- Grant full CRUD permissions on profiles table to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Grant execute permission on the update_updated_at_column function to authenticated users
-- This function is used by triggers to automatically update the updated_at column
GRANT EXECUTE ON FUNCTION update_updated_at_column TO authenticated;
