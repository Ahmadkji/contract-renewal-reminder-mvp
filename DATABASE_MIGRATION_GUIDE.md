# Database Migration Guide

## Overview

This guide explains how to apply the database schema changes to your Supabase project.

## Changes to Apply

The [`supabase-schema.sql`](supabase-schema.sql) file has been updated with:

### New Table: `profiles`

Stores user profile information for display and preferences:

```sql
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Basic profile info
  full_name TEXT,
  avatar_url TEXT,
  
  -- Preferences
  email_notifications BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'UTC',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New RLS Policy: `profiles`

Users can only see and modify their own profile:

```sql
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### New Trigger: `update_profiles_updated_at`

Automatically updates the `updated_at` timestamp:

```sql
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Migration Methods

### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of [`supabase-schema.sql`](supabase-schema.sql)
4. Paste into the SQL Editor
5. Click **Run** to execute all statements
6. Verify the `profiles` table was created successfully

**Pros:**
- Easy to use
- Visual confirmation
- Can review execution results
- Rollback available in dashboard

**Cons:**
- Manual process
- Need to copy-paste entire file

---

### Method 2: Supabase CLI

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Login to your Supabase project:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Push the schema changes:
   ```bash
   supabase db push
   ```

**Pros:**
- Automated
- Version controlled
- Easy to repeat
- Good for CI/CD

**Cons:**
- Requires CLI setup
- Requires project linking

---

### Method 3: Direct SQL Connection

If you have direct database access:

```bash
psql -h your-db-host -U your-user -d your-db -f supabase-schema.sql
```

**Pros:**
- Direct control
- Fast execution
- Works in scripts

**Cons:**
- Requires database credentials
- Not recommended for Supabase

---

## Verification

After migration, verify the changes:

### 1. Check Table Exists

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'profiles';
```

Expected result: One row with `profiles` table name.

### 2. Check RLS Policy

Run this query:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
```

Expected result: One policy named `Users manage own profile`.

### 3. Check Index

Run this query:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles';
```

Expected result: One index named `idx_profiles_user_id`.

### 4. Test Profile Creation

Create a test profile:

```sql
INSERT INTO profiles (user_id, full_name)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Test User'
);
```

Expected result: Successful insert with no errors.

---

## Rollback Plan

If you need to rollback the migration:

### Option 1: Drop Table

```sql
DROP TABLE IF EXISTS profiles CASCADE;
```

### Option 2: Use Supabase Dashboard

1. Go to **Table Editor** in Supabase Dashboard
2. Find the `profiles` table
3. Click **Delete** button

---

## Post-Migration Steps

After successful migration:

### 1. Update Environment Variables

Ensure these are set in your environment:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Test Profile Creation

Try creating a user profile through your application:

1. Sign up as a new user
2. Navigate to dashboard
3. Check if profile is created automatically (if you implement auto-creation)
4. Or manually create profile via API

### 3. Test Profile Access

1. Sign in as User A
2. Try to access User B's profile (should fail)
3. Sign in as User A
4. Access User A's profile (should succeed)

### 4. Test Profile Updates

1. Update profile information
2. Verify `updated_at` timestamp is updated
3. Verify changes persist across page reloads

---

## Common Issues & Solutions

### Issue 1: "relation "auth.users" does not exist"

**Cause:** Supabase auth schema not initialized

**Solution:** This is expected - Supabase creates `auth.users` automatically. The foreign key will work once users are created.

### Issue 2: "policy already exists"

**Cause:** Migration run multiple times

**Solution:** Drop existing policy first:
```sql
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
```

### Issue 3: "trigger already exists"

**Cause:** Migration run multiple times

**Solution:** Drop existing trigger first:
```sql
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
```

---

## Summary

**Migration Status:** Ready to apply
**Recommended Method:** Supabase Dashboard (Method 1)
**Rollback:** Easy (drop table or use dashboard)
**Risk:** LOW

The database schema is ready for production use with the profiles table and proper RLS policies.
