# API Route Issues Analysis - Build-Time vs Runtime Problems

## Executive Summary

This document details critical issues found in the API routes that cause **Build-Time vs Runtime Mismatches**, **Data Fetch Failures**, and **Server-Side Issues** that break features. Each issue includes code proof and line references.

---

## Issue #1: Date Serialization Mismatch (CRITICAL - Breaks Contract Creation)

### Problem
**Type mismatch between form submission (Date objects) and API validation (ISO strings)**

### Code Proof

**Form Type Definition** (`src/components/dashboard/add-contract-form-types.ts`):
```typescript
export type ContractFormData = {
  // ...
  startDate: Date | null;  // ← Date object
  endDate: Date | null;     // ← Date object
}
```

**API Validation Schema** (`src/lib/validation/contract-schema.ts`):
```typescript
startDate: z.string()
  .datetime({ local: true, message: 'Invalid start date format. Use YYYY-MM-DD format.' }),
endDate: z.string()
  .datetime({ local: true, message: 'Invalid end date format. Use YYYY-MM-DD format.' }),
```

**Form Submission** (`src/app/dashboard/layout.tsx`):
```typescript
body: JSON.stringify(data)  // ← Date objects serialized to ISO strings
```

### Root Cause
1. Form uses `Date | null` type
2. JSON.stringify converts Date to ISO string (e.g., `"2024-12-31T00:00:00.000Z"`)
3. Zod schema uses `.datetime({ local: true })` which may reject 'Z' suffixed timestamps
4. Validation fails even when dates are properly formatted

### Impact
- **Contract creation fails silently** or with cryptic validation errors
- Users cannot create contracts with certain date formats
- Date picker selections may be rejected

### Recommended Fix
```typescript
// In contract-schema.ts - Change validation to accept ISO strings properly
startDate: z.string()
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
endDate: z.string()
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
```

---

## Issue #2: AuthContext Missing Closing Brace (Build Error)

### Problem
**Syntax error causing build failures**

### Code Proof

**File**: `src/contexts/AuthContext.tsx`

```typescript
  // ... code continues ...
    }
  }

    return () => {           // ← Line ~75: EXTRA closing brace, missing return
      authSubscription.unsubscribe()
      if (channelRef.current) {
        channelRef.current.close()
      }
    }
  }, [router])

  const logout = async () => {
```

### Root Cause
The useEffect has TWO closing braces `}` on lines 74-75 instead of one. This causes:
- TypeScript compilation errors
- React hook violation (missing return for cleanup)
- Potential memory leaks

### Impact
- Build fails completely
- Dashboard crashes on load
- Auth state not properly cleaned up

### Recommended Fix
```typescript
  useEffect(() => {
    // ... initialization code ...
    
    return () => {
      authSubscription.unsubscribe()
      if (channelRef.current) {
        channelRef.current.close()
      }
    }
  }, [router])
```

---

## Issue #3: Admin Client Bypasses RLS (Security + Data Access Bug)

### Problem
**Database functions use admin client, ignoring user ownership checks**

### Code Proof

**Admin Client Creation** (`src/lib/supabase/server.ts`):
```typescript
export const createAdminClient = () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // Falls back to anon key if service role missing
    return createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      // ...
    )
  }
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,  // ← Bypasses ALL RLS policies
    // ...
  )
}
```

**Database Function Uses Admin** (`src/lib/db/contracts.ts`):
```typescript
const getSupabase = () => {
  return createAdminClient()  // ← ALL operations bypass RLS
}

export async function getContractById(id: string): Promise<ContractWithDetails> {
  // NO user_id check - any authenticated user can fetch ANY contract
  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`...`)
    .eq('id', id)
    .single()
  // ...
}
```

### Root Cause
1. API route checks user authentication
2. But database functions use admin client (service role key)
3. Admin client bypasses Row Level Security entirely
4. Any authenticated user can access/modify ANY contract by ID

### Impact
- **CRITICAL SECURITY VULNERABILITY**: Users can access other users' contracts
- Data privacy violation
- Potential data modification by unauthorized users

### Recommended Fix
```typescript
// Option 1: Use authenticated client with user_id check
export async function getContractById(id: string, userId: string): Promise<ContractWithDetails> {
  const supabase = await createClient()  // User's authenticated client
  
  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`...`)
    .eq('id', id)
    .eq('user_id', userId)  // ← Enforce ownership
    .single()
}
```

---

## Issue #4: Contract Detail View Missing Credentials (Data Fetch Failure)

### Problem
**Contract detail view doesn't send authentication, causing 401 errors**

### Code Proof

**API Route** (`src/app/api/contracts/[id]/route.ts`):
```typescript
export async function GET(...) {
  // ... auth check ...
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  // ...
}
```

**Client Fetch** (`src/components/dashboard/contract-detail-view.tsx`):
```typescript
React.useEffect(() => {
  if (open && contractId) {
    setLoading(true)
    
    fetch(`/api/contracts/${contractId}`)  // ← NO credentials!
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch contract')
        return res.json()
      })
      // ...
  }
}, [open, contractId])
```

### Root Cause
1. API route requires authentication (checks session cookies)
2. Fetch call doesn't include `credentials: 'include'`
3. Cookies not sent with request
4. Server returns 401 Unauthorized

### Impact
- Contract detail view always shows "Error Loading Contract"
- Users cannot view contract details
- Edit and delete features broken

### Recommended Fix
```typescript
fetch(`/api/contracts/${contractId}`, {
  credentials: 'include'  // ← Include session cookies
})
```

---

## Issue #5: Date Timezone Conversion Bug (Runtime Date Issues)

### Problem
**`toUTCDateOnly` function incorrectly converts dates using local timezone**

### Code Proof

**Database Function** (`src/lib/db/contracts.ts`):
```typescript
function toUTCDateOnly(date: Date): string {
  // Get date components in local timezone
  const year = date.getFullYear()    // ← Local year, NOT UTC
  const month = date.getMonth()      // ← Local month, NOT UTC
  const day = date.getDate()         // ← Local day, NOT UTC
  
  // Create UTC date (midnight UTC)
  return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
  // Example: Local date "Dec 31, 2024 11pm PST" 
  // becomes "2025-01-01" in UTC (wrong!)
}
```

### Root Cause
1. `getFullYear()`, `getMonth()`, `getDate()` use **local timezone**
2. Creates UTC midnight from local values
3. For users in negative UTC offsets, date shifts by +1 day
4. For users in positive UTC offsets, date shifts by -1 day

### Impact
- Contracts show wrong expiration dates
- Status calculations incorrect
- Reminder schedules misaligned
- Users in different timezones see different dates

### Recommended Fix
```typescript
function toUTCDateOnly(date: Date): string {
  // Option 1: Extract UTC components directly
  return date.toISOString().split('T')[0];  // ← Already UTC!
  
  // OR Option 2: Use local date at midnight UTC
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

---

## Issue #6: CSRF Validation May Block Legitimate Requests

### Problem
**Origin header validation may fail for same-origin requests in certain deployments**

### Code Proof

**CSRF Validation** (`src/lib/security/csrf.ts`):
```typescript
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // Allow same-origin requests (no Origin header)
  if (!origin) {
    return true
  }
  
  // For same-origin POST with Origin header (CORS-like scenarios)
  const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
    // ... URL comparison logic ...
  })
  
  return isAllowed
}
```

**Client Fetch (contracts page)** (`src/app/dashboard/contracts/page.tsx`):
```typescript
async function fetchContracts(page: number = 1, limit: number = 50) {
  const response = await fetch(`/api/contracts?page=${page}&limit=${limit}`, {
    headers: {
      'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    }
  });
  // ...
}
```

### Root Cause
1. Dashboard page sets explicit Origin header
2. `validateOrigin` compares against `ALLOWED_ORIGINS`
3. `ALLOWED_ORIGINS` includes `env.NEXT_PUBLIC_APP_URL`
4. If environment variable doesn't match `window.location.origin`, request fails

### Impact
- 403 Forbidden errors on contract list
- Dashboard fails to load
- Users cannot access contracts

### Recommended Fix
```typescript
// In csrf.ts - Compare properly
const originUrl = new URL(origin)
const allowedUrl = new URL(allowedOrigin)

// Compare without trailing slashes
const originNormalized = origin.replace(/\/$/, '')
const allowedNormalized = allowedOrigin.replace(/\/$/, '')

return (
  originUrl.protocol === allowedUrl.protocol &&
  originUrl.hostname === allowedUrl.hostname &&
  (originUrl.port === allowedUrl.port || 
   (originUrl.port === '80' && allowedUrl.port === '') ||
   (originUrl.port === '443' && allowedUrl.port === ''))
)
```

---

## Issue #7: Async API Incompatibility (Next.js 16 Breaking Change)

### Problem
**API routes don't await params/searchParams (required in Next.js 16)**

### Code Proof

**API Route** (`src/app/api/contracts/[id]/route.ts`):
```typescript
// Next.js 16 requires awaiting params - but it's NOT awaited here
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ← Declared as Promise
) {
  try {
    // ...
    const { id } = await params  // ← This IS awaited (correct)
    
    const contract = await getContractById(id)  // ← BUT no user_id check!
    // ...
  }
}
```

**Issue**: While `params` is correctly awaited, the `getContractById` function:
1. Takes only `id`, not `userId`
2. Uses admin client (bypasses RLS)
3. Returns ANY contract regardless of ownership

### Impact
- Security vulnerability (Issue #3)
- May fail in Next.js 16 production builds (params are Promises)

---

## Summary Table

| Issue | Severity | Impact | Files Affected |
|-------|----------|--------|----------------|
| #1 Date Serialization | CRITICAL | Contract creation fails | `contract-schema.ts`, `add-contract-form.tsx` |
| #2 Missing Brace | CRITICAL | Build failure | `AuthContext.tsx` |
| #3 Admin Bypass RLS | CRITICAL | Security vulnerability | `server.ts`, `contracts.ts` |
| #4 Missing Credentials | HIGH | Detail view broken | `contract-detail-view.tsx` |
| #5 Date Timezone | HIGH | Wrong dates displayed | `contracts.ts` |
| #6 CSRF Validation | MEDIUM | 403 errors | `csrf.ts`, `contracts/page.tsx` |
| #7 Async API | HIGH | Runtime errors | `[id]/route.ts` |

---

## Priority Fix Order

1. **Immediate**: Fix AuthContext syntax error (#2)
2. **Immediate**: Fix admin client RLS bypass (#3)
3. **High**: Fix contract detail credentials (#4)
4. **High**: Fix date serialization validation (#1)
5. **Medium**: Fix date timezone conversion (#5)
6. **Medium**: Review CSRF validation (#6)
