import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'

const PUBLIC_PAGE_EXACT_ROUTES = new Set([
  '/',
  '/login',
  '/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/verify-email',
])

// Public APIs intentionally exposed without Supabase session cookies.
const PUBLIC_API_EXACT_ROUTES = new Set([
  '/api/health',
  '/api/webhooks/creem',
])

// Session-exempt APIs guarded by dedicated bearer token auth at route level.
const SESSION_EXEMPT_API_EXACT_ROUTES = new Set([
  '/api/internal/reminders/process',
  '/api/internal/billing/reconcile',
])

/**
 * Proxy/Middleware - Authentication & Routing Handler
 * 
 * Next.js 16 - Network boundary handler (renamed from middleware.ts)
 * Reads cookies from INCOMING REQUEST to validate authentication
 */
export async function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  const pathname = normalizePathname(request.nextUrl.pathname)
  const isApiRequest = isApiPath(pathname)
  const hasRequestCookies = hasRequestCookiesHeader(request)
  const isPublicPageRoute = PUBLIC_PAGE_EXACT_ROUTES.has(pathname)
  const isPublicApiRoute =
    isApiRequest &&
    (PUBLIC_API_EXACT_ROUTES.has(pathname) ||
      SESSION_EXEMPT_API_EXACT_ROUTES.has(pathname))

  if (isPublicPageRoute || isPublicApiRoute) {
    return continueRequest(request, requestId)
  }

  if (isApiRequest) {
    // API auth/rate-limit/telemetry is intentionally enforced in Route Handlers.
    // This prevents bypassing route-level abuse controls for unauthenticated API traffic.
    return continueRequest(request, requestId)
  }

  // Protected pages - validate session from request cookies
  try {
    const response = continueRequest(request, requestId)

    if (!hasRequestCookies) {
      console.warn('[Proxy] Missing Supabase session cookie')
      return getLoginRedirect(request, pathname, requestId)
    }

    // Create Supabase client and pass the incoming request
    const supabase = createSupabaseServerClient(request, response)
    
    // Prefer claims verification for route protection at the network boundary.
    let isAuthenticated = false
    const authWithClaims = supabase.auth as unknown as {
      getClaims?: () => Promise<{
        data: { claims?: Record<string, unknown> | null }
        error: { message: string } | null
      }>
    }

    if (typeof authWithClaims.getClaims === 'function') {
      try {
        // Call as a method to preserve auth instance binding.
        const { data, error } = await authWithClaims.getClaims()
        if (error) {
          console.warn('[Proxy] getClaims error:', error.message)
        }

        const claims = data?.claims || null
        isAuthenticated = Boolean(
          claims && typeof claims.sub === 'string' && claims.sub.length > 0
        )
      } catch (claimsError) {
        console.warn('[Proxy] getClaims threw, falling back to getUser:', claimsError)
      }
    }

    if (!isAuthenticated) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) {
        console.warn('[Proxy] getUser fallback error:', error.message)
      }
      isAuthenticated = Boolean(user)
    }

    if (!isAuthenticated) {
      console.warn('[Proxy] No user found in session')
      return getLoginRedirect(request, pathname, requestId)
    }

    // User authenticated - allow access
    return response
  } catch (error) {
    console.error('[Proxy] Unexpected error during session validation:', error)
    return getLoginRedirect(request, pathname, requestId)
  }
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function hasRequestCookiesHeader(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie')
  return Boolean(cookieHeader && cookieHeader.trim().length > 0)
}

function parseRequestId(value: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().slice(0, 128)
  return normalized || null
}

function getOrCreateRequestId(request: NextRequest): string {
  const existing = parseRequestId(request.headers.get('x-request-id'))
  if (existing) {
    return existing
  }

  return crypto.randomUUID()
}

function continueRequest(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set('x-request-id', requestId)
  return response
}

function getLoginRedirect(request: NextRequest, pathname: string, requestId: string) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  const response = NextResponse.redirect(loginUrl)
  response.headers.set('x-request-id', requestId)
  return response
}

/**
 * Create Supabase server client that reads cookies from the incoming request
 */
function createSupabaseServerClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              request.cookies.set(name, value)
              response.cookies.set(name, value, {
                ...options,
                httpOnly: options?.httpOnly ?? true,
                secure: options?.secure ?? process.env.NODE_ENV === 'production',
              sameSite: options?.sameSite ?? 'lax'
              })
            } catch (_error) {
              console.warn('[Proxy] Could not set cookie:', name)
            }
          })
        }
      }
    }
  )
}
