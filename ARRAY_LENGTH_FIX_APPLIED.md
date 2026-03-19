# array_length Function Error - Fix Applied

## Problem
Contract creation was failing with error:
```
Failed to create contract: function array_length(text[]) does not exist
```

Then after fixing that, a second error occurred:
```
Failed to create contract: upper bound of FOR loop cannot be null
```

## Root Cause #1: Missing Dimension Parameter
The stored procedure [`create_contract_with_relations`](supabase/migrations/20260317000001_create_contract_stored_procedure.sql:8) used `array_length()` function without the required dimension parameter.

### PostgreSQL array_length() Function Requirements
PostgreSQL's `array_length()` function requires **two arguments**:
1. The array to measure
2. The dimension (1 for 1D arrays, 2 for 2D arrays, etc.)

### Incorrect Code
```sql
FOR i IN 1..array_length(p_tags) LOOP
```

### Correct Code
```sql
FOR i IN 1..array_length(p_tags, 1) LOOP
```

## Root Cause #2: NULL Upper Bound in FOR Loop
Even with the dimension parameter added, `array_length()` can return NULL in certain edge cases, causing "upper bound of FOR loop cannot be null" error.

### Problematic Code
```sql
FOR i IN 1..array_length(p_tags, 1) LOOP
```

**Issue**: If `array_length()` returns NULL, the loop upper bound becomes NULL, which is invalid.

### Fixed Code
```sql
FOR i IN 1..COALESCE(array_length(p_tags, 1), 0) LOOP
```

**Solution**: Use `COALESCE` to ensure the upper bound is always a number (0 if NULL).

## Additional Issue Fixed
The reminder INSERT used a CROSS JOIN that created a Cartesian product, resulting in duplicate reminder rows.

### Before (Incorrect)
```sql
INSERT INTO reminders (contract_id, days_before, reminder_days, notify_emails)
SELECT v_contract_id, unnest, unnest
FROM unnest(p_reminder_days) AS unnest
CROSS JOIN unnest(p_notify_emails) AS unnest;
```

**Problem**: If you have 3 reminder days and 2 notify emails, this creates **6 reminder rows** instead of 3.

### After (Correct)
```sql
INSERT INTO reminders (contract_id, days_before, reminder_days, notify_emails)
SELECT v_contract_id, days, days, COALESCE(p_notify_emails, ARRAY[]::TEXT[])
FROM unnest(p_reminder_days) AS days;
```

**Solution**: Uses the notify_emails array directly for all reminders, preventing duplicates.

## Files Modified

1. **supabase/migrations/20260318000001_fix_array_length_in_stored_procedure.sql** (UPDATED)
   - Fixed both `array_length()` calls with dimension parameter
   - Added `COALESCE` to prevent NULL upper bound in FOR loops
   - Fixed reminder INSERT logic
   - Applied to remote database via `supabase db push`

2. **supabase/migrations/20260318000002_fix_null_upper_bound_in_stored_procedure.sql** (NEW)
   - Final version with all fixes applied
   - Applied to remote database via `supabase db push`

3. **supabase/migrations/20260317000001_create_contract_stored_procedure.sql** (UPDATED)
   - Fixed both `array_length()` calls with dimension parameter
   - Added `COALESCE` to prevent NULL upper bound in FOR loops
   - Fixed reminder INSERT logic
   - Added comments explaining fixes

## Changes Summary

| Location | Change | Reason |
|-----------|--------|--------|
| Line 43 | `array_length(p_tags)` → `array_length(p_tags, 1)` | Add dimension parameter |
| Line 43 | Added `COALESCE(..., 0)` | Prevent NULL upper bound in FOR loop |
| Line 69 | `array_length(p_reminder_days)` → `array_length(p_reminder_days, 1)` | Add dimension parameter |
| Line 69 | Added `COALESCE(..., 0)` | Prevent NULL upper bound in IF condition |
| Lines 71-75 | CROSS JOIN → Direct INSERT with unnest | Prevent duplicate reminders |

## Testing
After applying this fix:
1. Contract creation with tags should work
2. Contract creation with reminder days should work
3. Contract creation with both tags and reminders should work
4. No duplicate reminder rows should be created
5. No NULL upper bound errors should occur

## Migration Status
✅ First migration applied successfully to remote database
✅ Second migration (final fix) applied successfully to remote database
✅ Original migration file updated for consistency
✅ Stored procedure now uses correct PostgreSQL syntax with NULL safety

## Related Errors
The client-side error "API error response: {}" was a result of the PostgreSQL error being caught and returned by the API. With all fixes applied, contract creation should succeed without errors.
