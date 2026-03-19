# SQL Schema Issues and Solutions

## Problem Summary

**Error:** `ERROR: 42P07: relation "contracts" already exists`

**Root Cause:** The [`supabase-schema.sql`](../supabase-schema.sql:1) file uses non-idempotent `CREATE TABLE` statements that fail when tables already exist in the database.

---

## Issues Found in supabase-schema.sql

### 1. Non-idempotent CREATE TABLE Statements

**Location:** Lines 5, 43, 53, 187

**Problem:**
```sql
CREATE TABLE contracts (
  ...
);
```

**Issue:** When you run the entire schema file on a database that already has tables, it fails immediately on the first existing table with error `42P07: relation "contracts" already exists`.

**Fix:**
```sql
CREATE TABLE IF NOT EXISTS contracts (
  ...
);
```

---

### 2. Non-idempotent CREATE INDEX Statements

**Location:** Lines 81-88, 205

**Problem:**
```sql
CREATE INDEX idx_contracts_user_id ON contracts(user_id);
```

**Issue:** Will fail if indexes already exist.

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
```

---

### 3. Non-idempotent CREATE POLICY Statements

**Location:** Lines 123-151, 213-217

**Problem:**
```sql
CREATE POLICY "Users manage own contracts" ON contracts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Issue:** Will fail if policies already exist.

**Fix:**
```sql
CREATE POLICY IF NOT EXISTS "Users manage own contracts" ON contracts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### 4. Non-idempotent CREATE TRIGGER Statements

**Location:** Lines 101-104, 225-228

**Problem:**
```sql
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Issue:** Will fail if triggers already exist.

**Fix:**
```sql
CREATE TRIGGER IF NOT EXISTS update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### 5. Monolithic Schema File

**Problem:** All tables, indexes, policies, and triggers are in one file, making it impossible to:
- Selectively apply only new changes
- Track migration history
- Rollback specific changes
- Follow database version control best practices

**Solution:** Use Supabase CLI migrations with individual migration files.

---

## Solutions

### Solution A: Create a Separate Migration File (RECOMMENDED)

This is the safest approach for adding the profiles table to an existing database.

#### Step 1: Create the migration file

Create a new file `migrations/add_profiles_table.sql` with the following content:

```sql
-- Migration: Add profiles table
-- Created: 2026-03-15
-- Description: Adds user profile table with RLS policies and triggers

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
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

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own profile
CREATE POLICY IF NOT EXISTS "Users manage own profile" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Create updated_at trigger for profiles
CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Step 2: Apply the migration using Supabase CLI

```bash
# If you haven't initialized Supabase CLI yet
supabase init

# Login if not already logged in
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

#### Step 3: Verify the migration

```bash
# Check remote tables
supabase db remote tables

# You should see "profiles" in the list
```

---

### Solution B: Make the Entire Schema File Idempotent

If you want to be able to run the entire schema file multiple times safely:

#### Step 1: Update supabase-schema.sql

Replace all `CREATE TABLE` with `CREATE TABLE IF NOT EXISTS`
Replace all `CREATE INDEX` with `CREATE INDEX IF NOT EXISTS`
Replace all `CREATE POLICY` with `CREATE POLICY IF NOT EXISTS`
Replace all `CREATE TRIGGER` with `CREATE TRIGGER IF NOT EXISTS`

#### Step 2: Run the updated schema

```bash
# Via Supabase SQL Editor
# Paste the entire updated schema file and execute

# OR via psql
psql postgresql://user:password@host:5432/postgres -f supabase-schema.sql
```

---

### Solution C: Use Supabase CLI db push (Best for Long-term)

Let Supabase CLI handle schema diffing automatically:

```bash
# Initialize Supabase in your project
supabase init

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push schema changes (CLI will detect and apply only new changes)
supabase db push
```

**Advantages:**
- Automatically creates migration files
- Tracks migration history
- Only applies new changes
- Supports rollback
- CI/CD friendly

---

## Quick Fix for Your Current Situation

Since you already have the contracts table and just added the profiles table to the schema:

### Option 1: Run only the profiles table SQL

Copy just the profiles table section (lines 184-228) from [`supabase-schema.sql`](../supabase-schema.sql:184) and run it in Supabase SQL Editor:

```sql
-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  full_name TEXT,
  avatar_url TEXT,
  email_notifications BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own profile" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Option 2: Use Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login
supabase login

# Link to your project (get project-ref from Supabase dashboard)
supabase link --project-ref your-project-ref

# Push schema - CLI will detect only the new profiles table
supabase db push
```

---

## Verification

After applying the migration, verify it worked:

### Check via Supabase Dashboard

1. Go to Table Editor
2. You should see the `profiles` table
3. Click on `profiles` table
4. Verify columns: id, user_id, full_name, avatar_url, email_notifications, timezone, created_at, updated_at

### Check via SQL

Run this query in Supabase SQL Editor:

```sql
-- Check if profiles table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'profiles';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- Check if policies exist
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Check if indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'profiles';
```

Expected results:
- Table `profiles` exists
- `rowsecurity` is `true`
- Policy `Users manage own profile` exists
- Index `idx_profiles_user_id` exists

---

## Testing the Profiles Table

### Test 1: Insert a profile

```sql
-- Insert a test profile (replace UUID with actual user ID from auth.users)
INSERT INTO profiles (user_id, full_name, email_notifications, timezone)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Test User',
  true,
  'UTC'
);
```

### Test 2: Query profiles

```sql
-- Select all profiles
SELECT * FROM profiles;

-- Select current user's profile
SELECT * FROM profiles WHERE user_id = auth.uid();
```

### Test 3: Update profile

```sql
-- Update a profile
UPDATE profiles 
SET full_name = 'Updated Name', 
    email_notifications = false
WHERE user_id = auth.uid();
```

### Test 4: Test RLS

```sql
-- This should work (your own profile)
SELECT * FROM profiles WHERE user_id = auth.uid();

-- This should return empty (other users' profiles)
SELECT * FROM profiles WHERE user_id != auth.uid();
```

---

## Summary

**Recommended Approach:** Solution A (Create a separate migration file)

**Steps:**
1. Create `migrations/add_profiles_table.sql` with the profiles table SQL
2. Run `supabase db push` to apply the migration
3. Verify the table was created successfully
4. Test inserting and querying profiles

**Key Benefits:**
- Idempotent (can run multiple times safely)
- Version controlled
- Easy to rollback
- Follows Supabase best practices
- CI/CD friendly

**Next Steps:**
1. Apply the migration using one of the methods above
2. Verify the profiles table is created
3. Test the table works correctly
4. Update your application to use the profiles table
5. Consider implementing profile auto-creation on user signup
