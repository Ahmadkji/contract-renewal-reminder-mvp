import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

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
 * Validate and refresh user session
 * Returns the user if session is valid, null otherwise
 * 
 * This is the recommended way to check authentication in API routes
 * as it properly handles expired/invalid sessions
 * 
 * @returns {Promise<{user: SupabaseUser | null, error: string | null, session?: Session | null}>}
 *   - user: The authenticated user or null
 *   - error: Error message string or null (always a string for easy handling)
 *   - session: The session object if available
 */
export async function validateSession(): Promise<{
  user: any | null
  error: string | null
  session?: any | null
}> {
  try {
    const supabase = await createClient()
    
    // First try to get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('[Supabase Server] getUser error:', userError)
      // Return string error message for consistent handling
      const errorMsg = typeof userError === 'object' && 'message' in userError 
        ? String(userError.message)
        : 'Session validation failed'
      return { user: null, error: errorMsg }
    }
    
    if (!user) {
      return { user: null, error: null }
    }
    
    // Optionally refresh the session to extend it
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.warn('[Supabase Server] Session refresh warning:', sessionError)
      // Still return user if we have one
    }
    
    return { user, error: null, session }
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
    console.warn('SUPABASE_SERVICE_ROLE_KEY not configured - admin client will use anon key')
    return createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
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
