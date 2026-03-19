-- ============================================
-- Migration: Initial Functions
-- Description: Create the update_updated_at_column() trigger function
-- This function is used by multiple tables to auto-update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
