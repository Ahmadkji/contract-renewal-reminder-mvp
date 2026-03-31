import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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
    if (!hasRequestCookies) {
      console.warn('[Proxy] Missing Supabase session cookie')
      return getLoginRedirect(request, pathname, requestId)
    }

    // Create Supabase client and pass the incoming request
    const supabase = await createSupabaseServerClient(request)
    
    // Prefer claims verification for route protection at the network boundary.
    const getClaims = (supabase.auth as unknown as {
      getClaims?: () => Promise<{ data: { claims?: Record<string, unknown> | null }; error: { message: string } | null }>
    }).getClaims

    let isAuthenticated = false

    if (typeof getClaims === 'function') {
      const { data, error } = await getClaims()
      if (error) {
        console.warn('[Proxy] getClaims error:', error.message)
      }

      const claims = data?.claims || null
      isAuthenticated = Boolean(claims && typeof claims.sub === 'string' && claims.sub.length > 0)
    } else {
      const { data: { user }, error } = await supabase.auth.getUser()
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
    return continueRequest(request, requestId)
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
async function createSupabaseServerClient(request: NextRequest) {
  // Get cookie store for setting cookies (server-side)
  const cookieStore = await cookies()
  
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          // Read from the INCOMING REQUEST headers (the cookies the browser sent)
          const cookieHeader = request.headers.get('cookie')
          if (!cookieHeader) return []
          
          return cookieHeader.split(';').reduce((cookies, part) => {
            const [name, ...rest] = part.trim().split('=')
            if (name) {
              cookies.push({
                name,
                value: rest.join('=')
              })
            }
            return cookies
          }, [] as { name: string; value: string }[])
        },
        setAll(cookiesToSet) {
          // For middleware, we mainly read cookies, but handle setAll if needed
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: options?.httpOnly ?? true,
                secure: options?.secure ?? process.env.NODE_ENV === 'production',
                sameSite: options?.sameSite ?? 'lax'
              })
            } catch (_error) {
              // Ignore cookie setting errors in middleware
              console.warn('[Proxy] Could not set cookie:', name)
            }
          })
        }
      }
    }
  )
}
