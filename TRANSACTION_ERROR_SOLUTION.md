# Production Indexes Deployment - Transaction Error Solution

## Problem

When trying to execute the CONCURRENTLY migration, you encountered this error:

```
ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

## Root Cause

The Supabase SQL Editor runs queries inside a transaction by default. However, `CREATE INDEX CONCURRENTLY` has a fundamental constraint:

**It cannot be executed inside a transaction block.**

This is a PostgreSQL limitation, not a Supabase-specific issue.

## Solution

Instead of one large SQL file with multiple `CREATE INDEX CONCURRENTLY` statements, we've split the migration into **10 individual SQL files** that can be executed one at a time.

## New File Structure

```
supabase/migrations/production_indexes/
├── README.md                                    # Deployment instructions
├── 01_drop_existing_indexes.sql                  # Step 1: Drop existing indexes
├── 02_create_idx_contracts_name_gin.sql         # Step 2: Create GIN index
├── 03_create_idx_contracts_vendor_gin.sql        # Step 3: Create GIN index
├── 04_create_idx_contracts_user_id_end_date.sql  # Step 4: Create composite index
├── 05_create_idx_contracts_type.sql              # Step 5: Create single index
├── 06_create_idx_reminders_days_before.sql       # Step 6: Create single index
├── 07_create_idx_vendor_contacts_contact_name.sql # Step 7: Create single index
├── 08_create_idx_contracts_user_id_auto_renew.sql # Step 8: Create composite index
├── 09_create_idx_contracts_user_id_type.sql      # Step 9: Create composite index
└── 10_create_idx_contracts_value.sql             # Step 10: Create partial index
```

## How to Deploy

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open [`supabase/migrations/production_indexes/01_drop_existing_indexes.sql`](supabase/migrations/production_indexes/01_drop_existing_indexes.sql)
4. Copy the SQL and paste into SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for it to complete
7. Repeat for files 02-10 in numerical order
8. Execute during low-traffic period

**Important:** Execute files one at a time. Do not try to run multiple files together.

### Option 2: Command Line with psql

```bash
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection String > URI

# Execute files in order
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/01_drop_existing_indexes.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/02_create_idx_contracts_name_gin.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/03_create_idx_contracts_vendor_gin.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/04_create_idx_contracts_user_id_end_date.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/05_create_idx_contracts_type.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/06_create_idx_reminders_days_before.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/07_create_idx_vendor_contacts_contact_name.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/08_create_idx_contracts_user_id_auto_renew.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/09_create_idx_contracts_user_id_type.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/production_indexes/10_create_idx_contracts_value.sql
```

## What Each File Does

| File | Description | Purpose |
|------|-------------|---------|
| 01_drop_existing_indexes.sql | Drops existing indexes | Clean slate for new indexes |
| 02_create_idx_contracts_name_gin.sql | GIN index on contracts.name | Case-insensitive text search |
| 03_create_idx_contracts_vendor_gin.sql | GIN index on contracts.vendor | Case-insensitive text search |
| 04_create_idx_contracts_user_id_end_date.sql | Composite index | Optimizes user + date queries |
| 05_create_idx_contracts_type.sql | Single column index | Optimizes type filtering |
| 06_create_idx_reminders_days_before.sql | Single column index | Optimizes reminder queries |
| 07_create_idx_vendor_contacts_contact_name.sql | Single column index | Optimizes contact search |
| 08_create_idx_contracts_user_id_auto_renew.sql | Composite index | Optimizes auto-renew queries |
| 09_create_idx_contracts_user_id_type.sql | Composite index | Optimizes user + type queries |
| 10_create_idx_contracts_value.sql | Partial index | Optimizes financial queries |

## Verification

After deploying all files, verify indexes were created:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

Expected output should include all 9 indexes:
- idx_contracts_name_gin
- idx_contracts_vendor_gin
- idx_contracts_user_id_end_date
- idx_contracts_type
- idx_reminders_days_before
- idx_vendor_contacts_contact_name
- idx_contracts_user_id_auto_renew
- idx_contracts_user_id_type
- idx_contracts_value

## Why This Works

By executing each index creation separately:
1. ✅ Each statement runs in its own transaction
2. ✅ No transaction block constraint violation
3. ✅ Table remains available for writes during index creation
4. ✅ No downtime for your application
5. ✅ Follows Supabase best practices

## Best Practices

1. **Execute files in order** (01-10)
2. **Wait for completion** before running the next file
3. **Deploy during low-traffic** periods
4. **Monitor database performance** during creation
5. **Test in staging** before production
6. **Keep the migration marked as applied** (already done)

## Troubleshooting

### Error: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"

**Cause:** Trying to run multiple files together

**Solution:** Execute files one at a time, waiting for each to complete

### Error: Index creation taking too long

**Cause:** Large tables with existing data

**Solution:**
- Run during low-traffic period
- Monitor database CPU and memory
- Be patient - CONCURRENTLY takes longer but prevents locks

### Error: Previous index still exists

**Cause:** File 01 wasn't executed

**Solution:** Run file 01 first to drop existing indexes

## Rollback

If you need to rollback:

```sql
DROP INDEX IF EXISTS idx_contracts_name_gin;
DROP INDEX IF EXISTS idx_contracts_vendor_gin;
DROP INDEX IF EXISTS idx_contracts_user_id_end_date;
DROP INDEX IF EXISTS idx_contracts_type;
DROP INDEX IF EXISTS idx_reminders_days_before;
DROP INDEX IF EXISTS idx_vendor_contacts_contact_name;
DROP INDEX IF EXISTS idx_contracts_user_id_auto_renew;
DROP INDEX IF EXISTS idx_contracts_user_id_type;
DROP INDEX IF EXISTS idx_contracts_value;
```

Then mark the migration as rolled back:
```bash
supabase migration repair --status reverted 20260315000014
```

## Summary

✅ **Problem solved:** Split CONCURRENTLY migration into individual files
✅ **No transaction errors:** Each file runs independently
✅ **Production-safe:** No table locks during index creation
✅ **Well-documented:** README with step-by-step instructions
✅ **Easy to deploy:** Execute files 01-10 in order

## Next Steps

1. Read [`supabase/migrations/production_indexes/README.md`](supabase/migrations/production_indexes/README.md)
2. Deploy to staging environment first
3. Execute files 01-10 in numerical order
4. Verify all indexes were created
5. Monitor database performance
6. Schedule production deployment during low-traffic period
