import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

/**
 * Proxy/Middleware - Authentication & Routing Handler
 * 
 * Next.js 16 - Network boundary handler (renamed from middleware.ts)
 * Reads cookies from INCOMING REQUEST to validate authentication
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes - no auth required
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/verify-email',
    '/api/auth',
    '/api/route',
  ]
  
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  )

  if (isPublicRoute) {
    return NextResponse.next({ request })
  }

  // Protected routes - validate session from request cookies
  try {
    // Create Supabase client and pass the incoming request
    const supabase = await createSupabaseServerClient(request)
    
    // Get user from the client (reads cookies from request)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.warn('[Proxy] getUser error:', userError.message)
    }
    
    if (!user) {
      console.warn('[Proxy] No user found in session')
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // User authenticated - allow access
    return NextResponse.next({ request })
  } catch (error) {
    console.error('[Proxy] Unexpected error during session validation:', error)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
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
            } catch (error) {
              // Ignore cookie setting errors in middleware
              console.warn('[Proxy] Could not set cookie:', name)
            }
          })
        }
      }
    }
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
