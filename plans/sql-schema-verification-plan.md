# SQL Schema Verification and Fix Implementation Plan

[Overview]
This plan addresses critical issues found in the Supabase SQL schemas. The primary issue is a column name mismatch between the database schema and the application code - the `reminders` table uses `days_before` but the code queries for `reminder_days` and `email_reminders` which don't exist. Additionally, the `contract_stats` view needs explicit permissions to work properly with RLS.

[Types]
No new types required. Existing TypeScript types in `src/types/contract.ts` already define the expected structure but need the database columns to match.

[Files]
Single sentence describing file modifications.

Detailed breakdown:
- **New migration file**: `supabase/migrations/20260315000012_fix_reminders_columns.sql` - Add missing columns to reminders table
- **New migration file**: `supabase/migrations/20260315000013_grant_contract_stats_select.sql` - Grant SELECT on contract_stats view
- **Modified**: `src/lib/db/contracts.ts` - Update transform function to use correct column names (already using correct names, but needs verification)
- **Existing issue**: `src/types/contract.ts` - Type definitions reference fields that may not exist

[Functions]
Single sentence describing function modifications.

Detailed breakdown:
- **Verify**: `getAllContracts()` in `src/lib/db/contracts.ts` - Verify column mapping works with existing schema
- **Verify**: `getContractById()` in `src/lib/db/contracts.ts` - Same verification needed
- **Verify**: `getContractStats()` in `src/lib/db/contracts.ts` - Check if view returns single row per user
- **No changes needed**: The TypeScript code already uses snake_case for database columns (`reminder_days`, `email_reminders`) - these need to be added to the database

[Classes]
No class modifications - this is a schema-only fix.

[Dependencies]
Single sentence describing dependency modifications.

No new dependencies required. The migrations use standard PostgreSQL features already available in Supabase.

[Testing]
Single sentence describing testing approach.

Detailed breakdown:
- Create test migration to verify column existence
- Test contract creation with reminders
- Test contract retrieval and verify reminder data
- Test contract_stats view returns correct data per user

[Implementation Order]
Single sentence describing the implementation sequence.

Numbered steps:
1. Create migration to add missing columns to reminders table
2. Create migration to grant SELECT on contract_stats view
3. Apply migrations to local/remote database
4. Test contract CRUD operations with reminders
5. Test contract_stats view returns correct aggregated data

---

## Detailed Issue Analysis

### Issue 1: Missing Columns in reminders Table

**Current Schema (migration 20260315000004):**
```sql
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
```

**Application Code Expects (src/lib/db/contracts.ts):**
```typescript
reminders (
  reminder_days,      -- doesn't exist, should be days_before
  email_reminders,    -- doesn't exist, needs to be added
  notify_emails       -- exists
)
```

**Required Fix:**
Add `reminder_days` as a computed/virtual column or rename `days_before` to `reminder_days`, and add `email_reminders` boolean column.

### Issue 2: contract_stats View Permissions

**Current Schema:**
The view exists but may not have explicit SELECT grants for the authenticated role.

**Required Fix:**
Grant SELECT on contract_stats view to authenticated role.

### Issue 3: contract_stats View Returns Multiple Rows

**Current Behavior:**
The view returns one row per user_id. The `getContractStats()` function uses `.single()` which will fail if there are multiple users.

**Required Fix:**
Either:
- Modify the function to filter by current user: `.eq('user_id', user.id)`
- Or create a separate function for user-specific stats
