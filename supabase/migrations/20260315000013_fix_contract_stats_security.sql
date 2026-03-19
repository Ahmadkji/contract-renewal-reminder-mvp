-- ============================================
-- Migration: Fix contract_stats View Security
-- Description: Fix contract_stats view to prevent data exposure
-- SECURITY ISSUE: The view returns stats for ALL users, allowing authenticated users
-- to see other users' contract statistics. This must be restricted.
-- ============================================

-- Drop existing view and recreate with security barrier
DROP VIEW IF EXISTS contract_stats;

-- Create view with security barrier and filter by auth.uid()
-- SECURITY BARRIER ensures the WHERE clause is applied before aggregation
CREATE OR REPLACE VIEW contract_stats WITH (security_barrier = true) AS
SELECT
  user_id,
  COUNT(*) as total_contracts,
  COUNT(*) FILTER (WHERE CURRENT_DATE > end_date) as expired,
  COUNT(*) FILTER (WHERE end_date - CURRENT_DATE <= 7  AND CURRENT_DATE <= end_date) as critical,
  COUNT(*) FILTER (WHERE end_date - CURRENT_DATE <= 30 AND end_date - CURRENT_DATE > 7) as expiring,
  COUNT(*) FILTER (WHERE end_date - CURRENT_DATE > 30) as active,
  SUM(value) as total_value,
  AVG(value) as average_value
FROM contracts
WHERE user_id = auth.uid()  -- Only show stats for current user
GROUP BY user_id;

-- Grant SELECT permission on view to authenticated users
GRANT SELECT ON contract_stats TO authenticated;
