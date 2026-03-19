# Contract Creation Issues - Implementation Plan

## Overview

Fix critical issues in the contract creation flow that prevent authenticated users from creating contracts. The primary issue is that RLS policies require `authenticated` users, but the session from cookies may not be properly passed through the Supabase client, causing `auth.uid()` to return NULL.

## Issues Identified (with code proof)

### Issue 1: Session Not Passed to Supabase Client (CRITICAL)
**Location:** `src/lib/db/contracts.ts`

The `getSupabase()` function uses `createClient()` which reads from cookies, but the server-side `validateSession()` in the API route creates a separate client instance. This can cause RLS to fail.

```typescript
// Current problematic code
const getSupabase = async () => {
  return await createClient()  // May not have session context
}
```

**Fix:** Use the admin client or ensure session is properly passed.

---

### Issue 2: Date Timezone Conversion (MEDIUM)
**Location:** `src/lib/db/contracts.ts:22-28`

```typescript
function toUTCDateOnly(date: Date): string {
  const year = date.getFullYear()  // Uses local timezone
  const month = date.getMonth()     // Uses local timezone
  const day = date.getDate()        // Uses local timezone
  return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
}
```

**Fix:** Extract UTC components directly from the Date object.

---

### Issue 3: Error Response Inconsistency (LOW)
**Location:** `src/app/api/contracts/route.ts` vs `src/components/dashboard/add-contract-form.tsx`

API returns field-level errors in `details`, but client only reads `error`.

**Fix:** Return field errors in a more accessible format.

---

### Issue 4: Client Cache Not Invalidated (LOW)
**Location:** `src/app/api/contracts/route.ts:176`

`updateTag()` only works server-side. Client dashboard needs router.refresh().

**Fix:** Add client-side cache invalidation.

---

## Types

No type changes required.

---

## Files

### New Files
None.

### Files to Modify

1. **src/lib/db/contracts.ts**
   - Fix `getSupabase()` to properly handle session context
   - Fix `toUTCDateOnly()` for timezone-safe conversion

2. **src/app/api/contracts/route.ts**
   - Improve error response format
   - Add better logging for debugging

3. **src/components/dashboard/add-contract-form.tsx**
   - Improve client-side error handling

4. **src/app/dashboard/layout.tsx**
   - Add router refresh after contract creation

---

## Functions

### New Functions
None.

### Modified Functions

1. **getSupabase()** (`src/lib/db/contracts.ts`)
   - Change: Ensure session context is properly passed
   - Reason: RLS policies fail when session is not available

2. **toUTCDateOnly()** (`src/lib/db/contracts.ts`)
   - Change: Use UTC date components instead of local
   - Reason: Prevent timezone shifts in date storage

3. **POST handler** (`src/app/api/contracts/route.ts`)
   - Change: Improve error response format
   - Reason: Client can properly display field errors

---

## Classes

No class changes required.

---

## Dependencies

No new dependencies required.

---

## Testing

1. Test contract creation with authenticated user
2. Test date storage across timezones
3. Test error display for validation failures
4. Test UI refresh after contract creation

---

## Implementation Order

1. Fix `getSupabase()` to use proper session context
2. Fix `toUTCDateOnly()` timezone handling
3. Improve error responses in API route
4. Add client-side cache invalidation
5. Test full contract creation flow
