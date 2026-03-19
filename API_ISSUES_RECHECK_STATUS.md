# API Issues Recheck - Status Report

## Summary

After re-checking the codebase, here are the findings:

---

## ✅ FIXED Issues (4)

| # | Issue | Status | Fixed In |
|---|-------|--------|----------|
| 1 | Date Serialization Mismatch | ✅ FIXED | `src/lib/validation/contract-schema.ts` |
| 3 | Admin Client Bypasses RLS | ✅ FIXED | `src/lib/db/contracts.ts` |
| 7 | API Route Security | ✅ FIXED | `src/app/api/contracts/[id]/route.ts` |

---

## ❌ REMAINING Issues (3)

### Issue #2: AuthContext Syntax Error (BUILD FAILURE)

**File**: `src/contexts/AuthContext.tsx`

**Problem**: Extra closing brace `}` at line 74 causes syntax error. The cleanup function is orphaned outside the useEffect.

**Code Proof**:
```typescript
// Line 71-78 - EXTRA BRACE causing syntax error
    }
  }   // ← EXTRA BRACE! Should only be one closing brace here

    return () => {           // ← This return statement is orphaned!
      authSubscription.unsubscribe()
      if (channelRef.current) {
        channelRef.current.close()
      }
    }
  }, [router])  // ← Dependency array is orphaned too!
```

**Impact**: 
- TypeScript build fails
- AuthContext cleanup never runs (memory leak)
- Auth state may not sync properly between tabs

---

### Issue #4: Missing Credentials (DATA FETCH FAILURE)

**File**: `src/components/dashboard/contract-detail-view.tsx`

**Problem**: Fetch call doesn't include session cookies, causing 401 Unauthorized errors.

**Code Proof**:
```typescript
// Line ~94 in contract-detail-view.tsx
React.useEffect(() => {
  if (open && contractId) {
    setLoading(true)
    
    fetch(`/api/contracts/${contractId}`)  // ← MISSING credentials!
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch contract')
        return res.json()
      })
```

**Required Fix**:
```typescript
fetch(`/api/contracts/${contractId}`, {
  credentials: 'include'  // ← ADD THIS
})
```

**Impact**:
- Contract detail view always shows "Error Loading Contract"
- Users cannot view contract details
- Edit and Delete buttons non-functional

---

### Issue #5: Date Timezone Bug (RUNTIME DATE ISSUES)

**File**: `src/lib/db/contracts.ts`

**Problem**: `toUTCDateOnly()` uses `getFullYear()` (local timezone) instead of UTC, causing date shifts.

**Code Proof**:
```typescript
// Current buggy implementation
function toUTCDateOnly(date: Date): string {
  // Get date components in local timezone ← WRONG!
  const year = date.getFullYear()    // ← Uses LOCAL timezone
  const month = date.getMonth()      // ← Uses LOCAL timezone  
  const day = date.getDate()         // ← Uses LOCAL timezone
  
  // Create UTC date (midnight UTC)
  return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
}
```

**Example of Bug**:
- User in PST (UTC-8) selects December 31, 2024
- `getFullYear()` returns 2024 (local)
- But 11pm PST = 7am UTC next day (December 31, 2024 at 11pm PST)
- `Date.UTC(2024, 11, 31)` = January 1, 2025 in UTC!
- Database stores wrong date

**Required Fix**:
```typescript
// Option 1: Use UTC methods directly
function toUTCDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];  // ← Already UTC!
}

// OR Option 2: Use UTC getters
function toUTCDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

**Impact**:
- Contracts show wrong expiration dates (off by 1 day for many users)
- Status calculations incorrect
- Reminder schedules misaligned
- Different users see different dates for same contract

---

## Priority Fix Order

1. **Issue #2** (CRITICAL) - Build failure
2. **Issue #4** (HIGH) - Data fetch failure  
3. **Issue #5** (MEDIUM) - Wrong dates displayed

---

## Files to Modify

| File | Issue | Change Needed |
|------|-------|---------------|
| `src/contexts/AuthContext.tsx` | #2 | Remove extra `}` brace, fix cleanup return |
| `src/components/dashboard/contract-detail-view.tsx` | #4 | Add `credentials: 'include'` to fetch |
| `src/lib/db/contracts.ts` | #5 | Use UTC methods in `toUTCDateOnly()` |
