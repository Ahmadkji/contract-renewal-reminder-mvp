import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { serializeUser } from '@/lib/serializers/user'
import type { SerializedUser } from '@/lib/serializers/user'
import { serverEnv as env } from '@/lib/env/server'

type SupabaseClaims = Record<string, unknown> & {
  sub?: string
  email?: string
  role?: string
}

type SessionUser = SerializedUser | { id: string; email?: string; role?: string }

function userFromClaims(claims: SupabaseClaims): { id: string; email?: string; role?: string } | null {
  if (typeof claims.sub !== 'string' || !claims.sub.trim()) {
    return null
  }

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    role: typeof claims.role === 'string' ? claims.role : undefined,
  }
}

/**
 * Create Supabase server client with proper cookie handling for Next.js 16
 *
 * Key design decisions:
 * 1. Proper async cookie handling with error recovery
 * 2. setAll accepts headers param from @supabase/ssr v0.10+ for CDN safety
 * 3. No module-level session cache (unsafe in Vercel Fluid compute)
 * 4. Cookie errors during auth operations should propagate
 *
 * Note: Session validation and token refresh is handled by the proxy
 * (proxy.ts) which runs on every request. The server client benefits from
 * the proxy's token refresh. The setAll catch is needed for Server Components
 * that cannot write cookies — the proxy handles it instead.
 */
export const createClient = async () => {
  // Await cookies() - required in Next.js 16 (async API)
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: options.httpOnly ?? true,
                secure: options.secure ?? process.env.NODE_ENV === 'production',
                sameSite: options.sameSite ?? 'lax',
              })
            })
          } catch (error) {
            // Server Components cannot write cookies (Next.js design).
            // The proxy handles session refresh instead.
            // Route Handlers should use createWritableClient() which
            // rethrows — this catch exists only for Server Component callers.
            console.error('[Supabase Server] Cookie set failed (read-only client):', error)
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase server client that propagates cookie-write failures.
 *
 * Use this in Route Handlers that perform auth mutations (login, signup,
 * logout, password reset, callback code exchange) where a swallowed
 * cookie-write failure would leave the session in an inconsistent state.
 *
 * Server Components should continue using createClient() because they
 * cannot write cookies — the proxy handles it instead.
 */
export const createWritableClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          // No try/catch — let cookie-write errors propagate so the
          // caller (Route Handler) can return a proper error response
          // instead of silently succeeding with no session.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: options.httpOnly ?? true,
              secure: options.secure ?? process.env.NODE_ENV === 'production',
              sameSite: options.sameSite ?? 'lax',
            })
          })
        },
      },
    }
  )
}

/**
 * Validate user session
 * Returns the user if session is valid, null otherwise
 *
 * This is the recommended way to check authentication in API routes
 * as it properly handles expired/invalid sessions.
 *
 * Note: The proxy (proxy.ts) handles automatic token refresh on every
 * request. This function validates the already-refreshed session.
 *
 * @returns {Promise<{user: SessionUser | null, error: string | null}>}
 *   - user: The authenticated user or null
 *   - error: Error message string or null (always a string for easy handling)
 */
export async function validateSession(): Promise<{
  user: SessionUser | null
  error: string | null
}> {
  try {
    const supabase = await createClient()

    // Claims verification is cheaper at the network boundary and avoids
    // unnecessary session refresh calls.
    const authWithClaims = supabase.auth as unknown as {
      getClaims?: () => Promise<{
        data: { claims?: SupabaseClaims | null }
        error: { message?: string } | null
      }>
    }

    if (typeof authWithClaims.getClaims === 'function') {
      try {
        const { data, error } = await authWithClaims.getClaims()

        if (!error && data?.claims) {
          const claimsUser = userFromClaims(data.claims)
          if (claimsUser) {
            return { user: claimsUser, error: null }
          }
        } else if (error?.message) {
          console.warn('[Supabase Server] getClaims error:', error.message)
        }
      } catch (claimsError) {
        console.warn('[Supabase Server] getClaims threw, falling back to getUser:', claimsError)
      }
    }

    // Fallback path for environments/tokens where claims are unavailable.
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('[Supabase Server] getUser error:', userError)
      const errorMsg = typeof userError === 'object' && 'message' in userError
        ? String(userError.message)
        : 'Session validation failed'
      return { user: null, error: errorMsg }
    }

    if (!user) {
      return { user: null, error: null }
    }

    return { user: serializeUser(user), error: null }
  } catch (error) {
    console.error('[Supabase Server] Session validation error:', error)
    // Return string error for consistent API handling
    const errorMsg = error instanceof Error ? error.message : 'Unknown session error'
    return { user: null, error: errorMsg }
  }
}

/**
 * Refresh user session to ensure it's valid
 * @deprecated Use validateSession() instead for better error handling
 */
export async function refreshSession() {
  const { user } = await validateSession()
  return user
}

// Create admin client with service role key (bypasses RLS)
// This allows the application to function without authentication while keeping RLS policies intact
export const createAdminClient = () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to create an admin client')
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
