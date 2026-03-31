import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { serverEnv as env } from '@/lib/env/server'
import { serializeUser } from '@/lib/serializers/user'

type SupabaseClaims = Record<string, unknown> & {
  sub?: string
  email?: string
  role?: string
}

let claimsMode: 'unknown' | 'supported' | 'unsupported' = 'unknown'
const SESSION_VALIDATION_CACHE_TTL_MS = (() => {
  const configured = Number.parseInt(process.env.SESSION_VALIDATION_CACHE_TTL_MS || '30000', 10)
  if (!Number.isFinite(configured)) {
    return 30_000
  }
  return Math.max(1_000, Math.min(configured, 300_000))
})()
const SESSION_VALIDATION_CACHE_MAX_ENTRIES = 1_500
const sessionValidationCache = new Map<string, { user: any; expiresAt: number }>()

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

function buildSessionCacheKey(cookieValues: Array<{ name: string; value: string }>): string | null {
  const authCookies = cookieValues
    .filter((cookie) => cookie.name.includes('-auth-token'))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (authCookies.length === 0) {
    return null
  }

  const raw = authCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(';')
  if (!raw) {
    return null
  }

  return createHash('sha256').update(raw).digest('hex')
}

function getCachedValidatedSession(cacheKey: string): any | null {
  const now = Date.now()
  const cached = sessionValidationCache.get(cacheKey)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= now) {
    sessionValidationCache.delete(cacheKey)
    return null
  }

  return cached.user
}

function setCachedValidatedSession(cacheKey: string, user: any): void {
  const now = Date.now()
  sessionValidationCache.set(cacheKey, {
    user,
    expiresAt: now + SESSION_VALIDATION_CACHE_TTL_MS,
  })

  while (sessionValidationCache.size > SESSION_VALIDATION_CACHE_MAX_ENTRIES) {
    const oldestKey = sessionValidationCache.keys().next().value as string | undefined
    if (!oldestKey) {
      break
    }
    sessionValidationCache.delete(oldestKey)
  }
}

/**
 * Create Supabase server client with enhanced error handling for Next.js 16
 * 
 * Key fixes for Next.js 16 + Turbopack:
 * 1. Proper async cookie handling with error recovery
 * 2. Session validation before queries
 * 3. Better logging for debugging
 * 4. Cookie errors during auth operations should propagate
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
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: options.httpOnly ?? true,
                secure: options.secure ?? process.env.NODE_ENV === 'production',
                sameSite: options.sameSite ?? 'lax'
              })
            })
          } catch (error) {
            console.error('[Supabase Server] Cookie set failed:', error)
            throw error
          }
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
 * as it properly handles expired/invalid sessions
 * 
 * @returns {Promise<{user: SupabaseUser | null, error: string | null}>}
 *   - user: The authenticated user or null
 *   - error: Error message string or null (always a string for easy handling)
 */
export async function validateSession(): Promise<{
  user: any | null
  error: string | null
}> {
  try {
    const cookieStore = await cookies()
    const cookieValues = cookieStore.getAll()
    const sessionCacheKey = buildSessionCacheKey(cookieValues)

    if (sessionCacheKey) {
      const cachedUser = getCachedValidatedSession(sessionCacheKey)
      if (cachedUser) {
        return { user: cachedUser, error: null }
      }
    }

    const supabase = await createClient()

    // Claims verification is cheaper at the network boundary and avoids unnecessary session refresh calls.
    const authWithClaims = supabase.auth as unknown as {
      getClaims?: () => Promise<{
        data: { claims?: SupabaseClaims | null }
        error: { message?: string } | null
      }>
    }

    if (typeof authWithClaims.getClaims === 'function' && claimsMode !== 'unsupported') {
      try {
        // Invoke via auth object to preserve method binding for internal auth state access.
        const { data, error } = await authWithClaims.getClaims()
        claimsMode = 'supported'

        if (!error && data?.claims) {
          const claimsUser = userFromClaims(data.claims)
          if (claimsUser) {
            if (sessionCacheKey) {
              setCachedValidatedSession(sessionCacheKey, claimsUser)
            }
            return { user: claimsUser, error: null }
          }
        } else if (error?.message) {
          console.warn('[Supabase Server] getClaims error:', error.message)
        }
      } catch (claimsError) {
        claimsMode = 'unsupported'
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

    const serializedUser = serializeUser(user)
    if (sessionCacheKey) {
      setCachedValidatedSession(sessionCacheKey, serializedUser)
    }

    return { user: serializedUser, error: null }
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
