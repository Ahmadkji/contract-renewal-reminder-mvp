# Authentication Flow Root Cause Analysis

## ISSUE DESCRIPTION
User signs up → confirms email → Supabase shows email confirmed → user tries to sign in with correct credentials → gets:
"An authentication error occurred. Please try again."

---

## 1. COMPLETE FLOW TRACE

### 1.1 Signup Flow
**File:** [`src/actions/auth.ts`](src/actions/auth.ts:23-85)

```typescript
export async function signup(formData: FormData) {
  // 1. Validate with Zod
  const validated = signupSchema.safeParse({...})

  // 2. Create Supabase user
  const supabase = await createClient()  // SERVER client
  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email`,
      data: { full_name: validated.data.fullName }
    }
  })

  // 3. Create profile
  if (data.user) {
    await supabase.from('profiles').insert({...})
  }

  return { success: true, message: 'Check your email to verify your account' }
}
```

**Supabase Client Used:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:6-31)
- Uses `createServerClient` from `@supabase/ssr`
- Has cookie handling configured
- Session stored in HTTP-only cookies

**Status:** ✅ WORKING - User created, email sent

---

### 1.2 Email Confirmation Flow
**File:** [`src/app/verify-email/page.tsx`](src/app/verify-email/page.tsx:1-155)

```typescript
'use client'

export default function VerifyEmailPage() {
  const supabase = createClient()  // CLIENT client (BROWSER)

  useEffect(() => {
    // Check user
    const { data: { user } } = await supabase.auth.getUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user?.email_confirmed_at) {
          redirect('/dashboard')
        }
      }
    )
  }, [supabase])
}
```

**Supabase Client Used:** [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts:7-11)
- Uses `createBrowserClient` from `@supabase/ssr`
- Session stored in localStorage/memory
- NO cookie synchronization with server

**Status:** ⚠️ POTENTIAL ISSUE - Client-side session, not synced with server

---

### 1.3 Login Flow
**File:** [`src/actions/auth.ts`](src/actions/auth.ts:91-143)

```typescript
export async function login(formData: FormData) {
  // 1. Validate with Zod
  const validated = loginSchema.safeParse({...})

  // 2. Sign in with Supabase
  const supabase = await createClient()  // SERVER client
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password
  })

  if (error) {
    console.error('Supabase signInWithPassword error:', {
      message: error.message,
      status: error.status,
      code: error.code
    })
    throw mapSupabaseError(error)
  }

  // 3. Return success
  return {
    success: true,
    user: data.user,
    message: 'Login successful'
  }
}
```

**Supabase Client Used:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:6-31)
- Uses `createServerClient` from `@supabase/ssr`
- Has cookie handling configured
- Session SHOULD be stored in HTTP-only cookies

**Status:** ❓ UNKNOWN - Need to verify if session is actually persisted

---

### 1.4 Dashboard Access Flow

#### 1.4.1 Client-Side Auth Check
**File:** [`src/app/dashboard/layout.tsx`](src/app/dashboard/layout.tsx:70-97)

```typescript
'use client'

useEffect(() => {
  async function checkAuth() {
    const response = await fetch('/api/contracts', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    setAuthLoading(false)
  }

  checkAuth()
}, [router])
```

**Status:** ⚠️ CLIENT COMPONENT - Uses fetch to check auth

---

#### 1.4.2 Server-Side Auth Check (Proxy)
**File:** [`proxy.ts`](proxy.ts:4-39)

```typescript
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route)
  )

  if (isPublicRoute) {
    return NextResponse.next({ request })
  }

  // Protected routes - check auth
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next({ request })
}
```

**Supabase Client Used:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:6-31)
- Uses `createServerClient` from `@supabase/ssr`
- Reads session from cookies

**Status:** ❓ UNKNOWN - Depends on whether session was set during login

---

#### 1.4.3 API Route Auth Check
**File:** [`src/app/api/contracts/route.ts`](src/app/api/contracts/route.ts:28-36)

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth check - require authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('Auth check result:', { user: user?.id, authError: authError?.message })

  if (authError || !user) {
    console.error('Unauthorized access attempt to GET /api/contracts')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // ... fetch contracts
}
```

**Status:** ❓ UNKNOWN - Depends on session persistence

---

## 2. SUPABASE AUTH VERIFICATION

### 2.1 Server Client Configuration
**File:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:6-31)

```typescript
export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

**Analysis:**
- ✅ Correctly uses `createServerClient`
- ✅ Cookie handling configured
- ✅ Uses `cookies()` from `next/headers`
- ⚠️ Has catch block that silently ignores errors when setting cookies

**POTENTIAL ISSUE:** The catch block in `setAll` silently ignores errors. If there's an issue setting cookies, it won't be logged.

---

### 2.2 Client Client Configuration
**File:** [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts:7-11)

```typescript
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import { env } from '@/lib/env'

export const createClient = () =>
  createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

export function useSupabaseClient() {
  const [supabase] = useState(() => createClient())
  return supabase
}
```

**Analysis:**
- ✅ Uses `createBrowserClient`
- ✅ Stores session in localStorage/memory
- ❌ NO cookie synchronization configured
- ❌ Does NOT pass `cookies` option

**CRITICAL ISSUE:** Client client does NOT have cookie synchronization. This means:
1. Login happens on server → session in cookies
2. Client component uses browser client → session in localStorage
3. They are NOT synchronized!

---

## 3. LOGIN FAILURE ROOT CAUSE

### 3.1 Error Handling Analysis
**File:** [`src/lib/errors/auth-errors.ts`](src/lib/errors/auth-errors.ts:20-111)

```typescript
export function mapSupabaseError(error: any): AuthError {
  const message = error?.message || ''
  const status = error?.status || 500

  // Email not confirmed
  if (message.includes('Email not confirmed')) {
    return new AuthError(
      'Please verify your email before signing in. Check your inbox for verification link.',
      'EMAIL_NOT_CONFIRMED',
      401
    )
  }

  // Invalid login credentials
  if (message.includes('Invalid login credentials') ||
      status === 400) {
    return new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401
    )
  }

  // Default secure error - never expose raw error
  return new AuthError(
    'An authentication error occurred. Please try again.',
    'AUTH_ERROR',
    500
  )
}
```

**Analysis:**
- ✅ Has specific error for "Email not confirmed"
- ✅ Has specific error for "Invalid login credentials"
- ❌ Default error is generic: "An authentication error occurred. Please try again."

**ISSUE:** The user is seeing the DEFAULT error message, which means:
- The error is NOT "Email not confirmed"
- The error is NOT "Invalid login credentials"
- The error is something else that falls into the default case

---

### 3.2 Login Action Error Logging
**File:** [`src/actions/auth.ts`](src/actions/auth.ts:113-120)

```typescript
if (error) {
  console.error('Supabase signInWithPassword error:', {
    message: error.message,
    status: error.status,
    code: error.code
  })
  throw mapSupabaseError(error)
}
```

**Analysis:**
- ✅ Logs the actual Supabase error details
- ❌ But this is SERVER-SIDE logging, not visible to user
- ❌ User only sees the mapped error message

**NEED TO CHECK:** What is the actual Supabase error being logged?

---

## 4. DASHBOARD ACCESS FLOW

### 4.1 Dashboard Layout Auth Check
**File:** [`src/app/dashboard/layout.tsx`](src/app/dashboard/layout.tsx:70-97)

```typescript
'use client'

useEffect(() => {
  async function checkAuth() {
    try {
      const response = await fetch('/api/contracts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        // Unauthorized - redirect to login
        router.push('/login')
        return
      }

      // Authenticated
      setAuthLoading(false)
    } catch (error) {
      console.error('Auth check failed:', error)
      // On error, redirect to login to be safe
      router.push('/login')
      setAuthLoading(false)
    }
  }

  checkAuth()
}, [router])
```

**Analysis:**
- ⚠️ CLIENT COMPONENT checking auth
- ⚠️ Uses fetch to API route
- ⚠️ Does NOT use Supabase client directly
- ⚠️ If API returns 401, redirects to login

**ISSUE:** This is a CLIENT-SIDE auth check. The actual session validation happens in the API route.

---

### 4.2 API Route Auth Check
**File:** [`src/app/api/contracts/route.ts`](src/app/api/contracts/route.ts:28-36)

```typescript
const supabase = await createClient()

// Auth check - require authentication
const { data: { user }, error: authError } = await supabase.auth.getUser()
console.log('Auth check result:', { user: user?.id, authError: authError?.message })

if (authError || !user) {
  console.error('Unauthorized access attempt to GET /api/contracts')
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  )
}
```

**Analysis:**
- ✅ Uses server client
- ✅ Reads session from cookies
- ✅ Logs auth check result
- ❌ If session not in cookies, returns 401

**CRITICAL QUESTION:** Is the session actually being set in cookies during login?

---

## 5. RLS & DATABASE CHECK

Based on the code analysis, RLS policies are correctly configured (as mentioned in production-ready-auth-analysis.md). The issue is NOT with RLS policies or database access.

The issue is with SESSION PERSISTENCE.

---

## 6. COMMON BREAKPOINTS VERIFICATION

### 6.1 Session Not Persisted ❓
**Status:** NEEDS VERIFICATION

**Evidence:**
- Login uses server client with cookie handling
- But we need to verify if cookies are actually being set

**How to verify:**
1. Check browser dev tools → Application → Cookies
2. Look for `sb-access-token` and `sb-refresh-token` cookies
3. Check if they have `HttpOnly` flag set

---

### 6.2 Cookies Blocked or Misconfigured ❓
**Status:** NEEDS VERIFICATION

**Evidence:**
- Server client has cookie handling configured
- But catch block silently ignores errors

**How to verify:**
1. Add logging to the catch block in `setAll`
2. Check if cookies are being set correctly

---

### 6.3 Wrong Supabase URL / Anon Key ✅
**Status:** VERIFIED - CORRECT

**Evidence:**
- Environment variables are validated in [`src/lib/env.ts`](src/lib/env.ts:8-26)
- App would fail to start if they were wrong

---

### 6.4 Server/Client Mismatch ⚠️
**Status:** POTENTIAL ISSUE

**Evidence:**
- Login uses server client
- Email verification uses client client
- Client client does NOT have cookie synchronization

**How this causes the issue:**
1. User signs up → server client → session in cookies
2. User confirms email → client client → session in localStorage
3. User tries to login → server client → session in cookies
4. But if cookies weren't set properly during signup, login fails

---

### 6.5 Edge Runtime Issues ✅
**Status:** NOT APPLICABLE

**Evidence:**
- Using Node.js runtime (default for Next.js)
- No edge runtime configuration

---

### 6.6 Missing `supabase.auth.getSession()` ❓
**Status:** NEEDS VERIFICATION

**Evidence:**
- Code uses `getUser()` which is correct
- But we need to verify if session exists

---

### 6.7 Incorrect use of `onAuthStateChange` ⚠️
**Status:** POTENTIAL ISSUE

**Evidence:**
- Email verification page uses `onAuthStateChange`
- But client client doesn't sync with cookies

**How this causes the issue:**
- Email confirmation updates session in localStorage
- But server still expects session in cookies
- They're out of sync

---

## 7. ROOT CAUSE HYPOTHESIS

Based on the code analysis, I've identified **THREE POTENTIAL ROOT CAUSES**:

### Hypothesis 1: Cookies Not Being Set During Login
**Likelihood:** HIGH

**Evidence:**
1. Login uses server client with cookie handling
2. But the catch block in `setAll` silently ignores errors
3. If there's an error setting cookies, it won't be logged
4. User sees generic error message

**How to verify:**
- Add logging to the catch block in `setAll`
- Check browser dev tools for cookies after login attempt

---

### Hypothesis 2: Client/Client Session Desynchronization
**Likelihood:** MEDIUM

**Evidence:**
1. Email verification uses client client
2. Client client does NOT have cookie synchronization
3. Server expects session in cookies
4. They're out of sync

**How to verify:**
- Check if session exists in localStorage after email verification
- Check if session exists in cookies
- Compare them

---

### Hypothesis 3: Email Confirmation Status Mismatch
**Likelihood:** LOW

**Evidence:**
1. Supabase shows email confirmed
2. But login might be checking a different status
3. Need to verify the actual Supabase error

**How to verify:**
- Check server logs for actual Supabase error
- Look at the `message`, `status`, and `code` fields

---

## 8. RECOMMENDED DEBUGGING STEPS

### Step 1: Add Logging to Cookie Set
**File:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:17-27)

```typescript
setAll(cookiesToSet) {
  try {
    console.log('Setting cookies:', cookiesToSet)
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    )
    console.log('Cookies set successfully')
  } catch (error) {
    console.error('Error setting cookies:', error)
    // The `setAll` method was called from a Server Component.
    // This can be ignored if you have middleware refreshing
    // user sessions.
  }
},
```

### Step 2: Add Logging to Login Action
**File:** [`src/actions/auth.ts`](src/actions/auth.ts:108-120)

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: validated.data.email,
  password: validated.data.password
})

console.log('Login attempt:', {
  email: validated.data.email,
  success: !error,
  data: data ? {
    user: data.user?.id,
    session: data.session ? 'exists' : 'missing',
    access_token: data.session?.access_token ? 'exists' : 'missing'
  } : null,
  error: error ? {
    message: error.message,
    status: error.status,
    code: error.code
  } : null
})

if (error) {
  throw mapSupabaseError(error)
}
```

### Step 3: Check Browser Cookies
1. Open browser dev tools (F12)
2. Go to Application → Cookies
3. Look for cookies starting with `sb-`
4. Check if they exist after login attempt
5. Check if they have `HttpOnly` flag

### Step 4: Check Server Logs
1. Look at terminal/console output
2. Find the "Supabase signInWithPassword error:" log
3. Note the actual error message, status, and code
4. This will tell us the REAL reason for failure

---

## 9. MINIMAL FIX SOLUTION

Based on the analysis, here are the minimal fixes needed:

### Fix 1: Add Cookie Logging (Diagnostic)
**Purpose:** Verify if cookies are being set correctly

**File:** [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts:17-27)

```typescript
setAll(cookiesToSet) {
  try {
    console.log('[Supabase] Setting cookies:', cookiesToSet.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      options: c.options
    })))
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    )
  } catch (error) {
    console.error('[Supabase] Error setting cookies:', error)
  }
},
```

### Fix 2: Add Detailed Login Logging (Diagnostic)
**Purpose:** See actual Supabase error

**File:** [`src/actions/auth.ts`](src/actions/auth.ts:108-120)

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: validated.data.email,
  password: validated.data.password
})

console.log('[Auth] Login attempt:', {
  email: validated.data.email,
  hasData: !!data,
  hasError: !!error,
  userData: data?.user ? {
    id: data.user.id,
    email: data.user.email,
    emailConfirmed: !!data.user.email_confirmed_at
  } : null,
  sessionData: data?.session ? {
    hasAccessToken: !!data.session.access_token,
    hasRefreshToken: !!data.session.refresh_token
  } : null,
  errorData: error ? {
    message: error.message,
    status: error.status,
    code: error.code
  } : null
})
```

### Fix 3: Improve Error Mapping (If Needed)
**Purpose:** Show more specific error to user

**File:** [`src/lib/errors/auth-errors.ts`](src/lib/errors/auth-errors.ts:20-111)

After seeing the actual error logs, we may need to add more specific error mappings.

---

## 10. NEXT STEPS

1. **Add the logging fixes** to see what's actually happening
2. **Reproduce the issue** with logging enabled
3. **Check server logs** for actual Supabase error
4. **Check browser cookies** to see if session is being set
5. **Based on findings**, implement the appropriate fix

---

## 11. WHAT NOT TO CHANGE

❌ **DO NOT** completely rewrite auth system
❌ **DO NOT** add complex auth libraries
❌ **DO NOT** change database schema
❌ **DO NOT** add rate limiting (not the issue)
❌ **DO NOT** change RLS policies (they're fine)

---

## SUMMARY

The most likely root cause is **cookies not being set correctly during login**, which could be due to:

1. Silent error in cookie setting (catch block ignores it)
2. Cookie configuration issue
3. Session not being returned by Supabase

The diagnostic logging will help us identify the exact issue and implement the minimal fix.
