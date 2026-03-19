# Production Index Deployment Guide

## Overview

This guide explains how to deploy production indexes with the `CONCURRENTLY` flag to avoid table locks during deployment.

## Why CONCURRENTLY is Required

According to official Supabase documentation:
> "the default behaviour of `create index` is to lock the table from writes. Luckily Postgres provides us with `create index concurrently` which prevents blocking writes on the table, but does take a bit longer to build."

**Source:** https://supabase.com/docs/guides/database/postgres/indexes

## Important Constraints

1. **CONCURRENTLY cannot be used with `IF NOT EXISTS`**
2. **CONCURRENTLY cannot be used inside a transaction**
3. **CONCURRENTLY takes longer but prevents table locks**
4. **Each index must be created individually**

## Deployment Strategy

### For Development/Staging (Empty Tables)

Use standard migration deployment:
```bash
supabase db push
```

Since tables are empty, index creation is fast and locks don't matter.

### For Production (Existing Data)

Follow these steps to deploy CONCURRENTLY indexes:

## Step 1: Deploy Initial Schema

Deploy all migrations except the CONCURRENTLY migration:
```bash
# This will deploy migrations 00001-00013
supabase db push --remote-url <production-db-url>
```

## Step 2: Mark CONCURRENTLY Migration as Applied

Since CONCURRENTLY migrations cannot be run through `supabase db push`, mark it as applied:
```bash
supabase migration repair --status applied 20260315000014
```

## Step 3: Execute CONCURRENTLY Migration Manually

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260315000014_add_production_indexes_concurrently.sql`
4. Paste into SQL Editor
5. Execute during low-traffic period

### Option B: Using psql Command Line

```bash
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection String > URI

psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/20260315000014_add_production_indexes_concurrently.sql
```

### Option C: Using Supabase CLI with Remote Connection

```bash
# Connect to remote database
supabase db remote commit

# Then execute the SQL manually using psql
```

## Step 4: Verify Index Creation

After deployment, verify indexes were created:

```sql
-- Check all indexes
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

Expected output should include:
- `idx_contracts_name_gin`
- `idx_contracts_vendor_gin`
- `idx_contracts_user_id_end_date`
- `idx_contracts_type`
- `idx_reminders_days_before`
- `idx_vendor_contacts_contact_name`
- `idx_contracts_user_id_auto_renew`
- `idx_contracts_user_id_type`
- `idx_contracts_value`

## Step 5: Monitor Index Usage

Check if indexes are being used:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Troubleshooting

### Error: "CREATE INDEX CONCURRENTLY cannot be executed within a pipeline"

**Cause:** Trying to run CONCURRENTLY migration through `supabase db push`

**Solution:** Execute the migration manually using SQL Editor or psql

### Error: Index creation taking too long

**Cause:** Large tables with existing data

**Solution:**
- Run during low-traffic period
- Monitor database CPU and memory
- Consider creating indexes one at a time

### Error: Index in "invalid" state

**Cause:** Index creation was interrupted

**Solution:**
```sql
-- Drop the invalid index
DROP INDEX IF EXISTS idx_contracts_name_gin;

-- Recreate it
CREATE INDEX CONCURRENTLY idx_contracts_name_gin 
ON contracts USING gin (name gin_trgm_ops);
```

## Best Practices

1. **Deploy during low-traffic periods** - Index creation can be resource-intensive
2. **Monitor database performance** - Watch CPU, memory, and disk I/O
3. **Test in staging first** - Verify the migration works before production
4. **Have a rollback plan** - Know how to drop indexes if needed
5. **Document deployment** - Keep track of when indexes were created

## Rollback Plan

If you need to rollback the indexes:

```sql
-- Drop all CONCURRENTLY indexes
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

## Current Status

✅ Migration file created: `supabase/migrations/20260315000014_add_production_indexes_concurrently.sql`
✅ Migration marked as applied in remote database
⚠️  Indexes need to be created manually in production

## Next Steps

1. Deploy to staging environment first
2. Verify indexes work correctly
3. Schedule production deployment during low-traffic period
4. Execute CONCURRENTLY migration manually
5. Verify index creation and usage
6. Monitor database performance
