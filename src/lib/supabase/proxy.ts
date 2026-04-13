import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase Auth Session Proxy
 *
 * Refreshes expired Auth tokens and propagates the refreshed session to both
 * the server (via request cookies) and the browser (via response Set-Cookie).
 *
 * This is the officially recommended pattern from Supabase for SSR apps:
 * https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * Why this is needed:
 * - JWT tokens expire (default 1 hour). Without automatic refresh, server-side
 *   Supabase clients will use stale tokens, causing auth.uid() inside SECURITY
 *   INVOKER RPC functions to return NULL or an incorrect value.
 * - Without this proxy, every server client must manually call getUser() or
 *   getClaims() to initialize auth context — easy to miss and fragile.
 *
 * Security notes:
 * - Uses getClaims() which validates the JWT signature server-side every time.
 *   Never use getSession() in middleware — it doesn't revalidate the JWT.
 * - This proxy does NOT enforce auth redirects for all routes. Auth gating is
 *   handled by individual page layouts (e.g., DashboardAuthGate) and API route
 *   handlers (validateSession). This keeps the proxy focused on token refresh only.
 *
 * CDN/Vercel safety:
 * - Since @supabase/ssr v0.10.0, the setAll callback receives a second `headers`
 *   argument containing Cache-Control directives. Propagating these prevents
 *   CDN caching of responses that contain Set-Cookie headers, which would
 *   otherwise leak sessions between users.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Gracefully skip session refresh if env vars are missing (e.g., during build)
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment variable.
  // Always create a new one on each request.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        // 1. Update the request cookies so downstream server clients see the
        //    refreshed token without making a separate network call.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        // 2. Rebuild the response so it carries the updated request cookies.
        supabaseResponse = NextResponse.next({
          request,
        })

        // 3. Set the refreshed cookies on the outgoing response so the browser
        //    replaces its stored auth tokens.
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )

        // 4. Propagate cache-control headers from @supabase/ssr to prevent
        //    CDN/Vercel from caching responses containing Set-Cookie headers.
        //    Without this, users could receive another user's session.
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        )
      },
    } satisfies CookieMethodsServer,
  })

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  // getClaims() validates the JWT signature against the project's published
  // public keys every time — it's safe to trust.
  try {
    await supabase.auth.getClaims()
  } catch {
    // If getClaims() fails (e.g., malformed token), let the request through.
    // Individual route handlers will handle auth errors appropriately.
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make
  // sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
