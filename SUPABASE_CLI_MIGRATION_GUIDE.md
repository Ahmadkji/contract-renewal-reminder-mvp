# Supabase CLI Migration Guide

## Overview

This guide explains how to apply the database schema changes using the Supabase CLI (Method 2 from [`DATABASE_MIGRATION_GUIDE.md`](DATABASE_MIGRATION_GUIDE.md)).

---

## Prerequisites

1. **Install Supabase CLI**

```bash
npm install -g supabase
```

2. **Verify Installation**

```bash
supabase --version
```

Expected output: Version number (e.g., `2.x.x`)

---

## Step 1: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate with your Supabase account.

**Expected Result:**
- Browser opens to Supabase login page
- After successful login, terminal shows "Logged in as your-email@example.com"

---

## Step 2: Link to Your Project

If you don't have your project reference:

### Option A: List Projects

```bash
supabase projects list
```

This will show all your projects with their references.

### Option B: Create New Project

```bash
supabase projects create
```

Follow the prompts to create a new project.

### Option C: Use Project URL

If you know your project URL:

```bash
supabase link --project-ref your-project-ref
```

Replace `your-project-ref` with your actual project reference (e.g., `abcdefgh-ijkl-mnopqrstuv`).

**Expected Result:**
```
Linked to project: your-project-name
Database URL: postgresql://xxx.xxx.supabase.co:5432/postgres
```

---

## Step 3: Initialize Supabase in Your Project (Optional)

If this is your first time using Supabase CLI in this project:

```bash
supabase init
```

This creates:
- `supabase/config.toml` - Project configuration
- `.supabase/` directory - Local migrations directory

**Note:** If you already have a `supabase` directory, you can skip this step.

---

## Step 4: Push Database Schema

Now push the updated schema to your Supabase project:

```bash
supabase db push
```

This command will:
1. Read [`supabase-schema.sql`](supabase-schema.sql)
2. Compare with current database schema
3. Apply only the new changes
4. Create migration files in `.supabase/migrations/`

**Expected Output:**
```
Applying migration 20260315_000001_add_profiles_table...
Creating table: profiles
Creating index: idx_profiles_user_id
Creating policy: Users manage own profile
Creating trigger: update_profiles_updated_at
Migration completed successfully!
```

---

## Step 5: Verify Migration

After pushing, verify the changes were applied:

### Check Migration Status

```bash
supabase db remote commit
```

This shows the latest migration that was applied.

### Check Remote Database

```bash
supabase db remote tables
```

Expected output should include `profiles` table.

---

## Step 6: Test Profile Creation

Test that the profiles table works correctly:

### Via Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:

```sql
-- Test inserting a profile
INSERT INTO profiles (user_id, full_name)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Test User'
);

-- Test reading the profile
SELECT * FROM profiles LIMIT 1;
```

3. Expected result: Successfully inserted and retrieved profile data

### Via Your Application

1. Sign up as a new user
2. Navigate to dashboard
3. Check if profile is created (if you implement auto-creation)
4. Verify you can access your own profile

---

## Common Issues & Solutions

### Issue 1: "Not logged in"

**Error Message:**
```
Error: Not logged in. Run 'supabase login' first.
```

**Solution:**
```bash
supabase login
```

---

### Issue 2: "Project not found"

**Error Message:**
```
Error: Project not found. Please check your project reference.
```

**Solution:**

1. List your projects:
   ```bash
   supabase projects list
   ```

2. Use the correct project reference:
   ```bash
   supabase link --project-ref correct-project-ref
   ```

---

### Issue 3: "Schema already exists"

**Error Message:**
```
Error: Table 'profiles' already exists
```

**Solution:**

The CLI is smart enough to handle this. It will only create new tables. If you see this error, it means the table was already created in a previous migration.

To verify:
```bash
supabase db remote tables
```

---

### Issue 4: "Migration failed"

**Error Message:**
```
Error: Migration failed: relation "auth.users" does not exist
```

**Solution:**

This is expected! The `auth.users` table is created by Supabase when the first user signs up. The foreign key will work once users are created.

To test:

1. Sign up a test user in your application
2. Then run:
   ```bash
   supabase db push
   ```

---

## Advanced: Creating Migration Files

For better version control, create individual migration files:

### Step 1: Create Migration File

```bash
supabase migration new add_profiles_table
```

This creates a new migration file in `.supabase/migrations/`.

### Step 2: Edit Migration File

Open the created migration file and add the profiles table SQL:

```sql
-- Migration: add_profiles_table
-- Created: 2026-03-15

CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email_notifications BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Apply Migration

```bash
supabase db push
```

---

## CI/CD Integration

For automated deployments, add to your CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Deploy Database

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Supabase CLI
        run: npm install -g supabase
      
      - name: Push database changes
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: supabase db push
```

### Vercel Example

Add to `vercel.json`:

```json
{
  "build": {
    "env": {
      "SUPABASE_ACCESS_TOKEN": "@supabase-access-token"
    }
  }
}
```

Then in your build script:

```json
{
  "scripts": {
    "postbuild": "supabase db push"
  }
}
```

---

## Rollback

If you need to rollback a migration:

### Option 1: Revert Last Migration

```bash
supabase migration revert
```

### Option 2: Reset to Specific Migration

```bash
supabase db reset --version 20260315_000001
```

Replace `20260315_000001` with the migration version you want to revert to.

### Option 3: Drop Table Manually

```bash
supabase db execute --file drop-profiles.sql
```

Create `drop-profiles.sql`:

```sql
DROP TABLE IF EXISTS profiles CASCADE;
```

---

## Summary

**Recommended Method:** Supabase CLI
**Advantages:**
- Automated migrations
- Version control
- Easy CI/CD integration
- Repeatable deployments
- Migration history

**Commands to Run:**
1. `supabase login`
2. `supabase link --project-ref your-ref`
3. `supabase db push`

**Next Steps:**
1. Follow this guide to apply the migration
2. Test the profiles table works
3. Verify RLS policies are enforced
4. Update your application to use profiles

The Supabase CLI provides the best workflow for database migrations in production environments.
