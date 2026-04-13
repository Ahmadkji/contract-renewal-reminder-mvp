import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next.js Proxy — Supabase Auth Session Refresh
 *
 * This is the Next.js 16 entry point (replaces deprecated middleware.ts).
 * It runs on every matched request to automatically refresh expired Supabase
 * Auth tokens via the proxy utility.
 *
 * Official docs: https://supabase.com/docs/guides/auth/server-side/nextjs
 * Next.js 16 proxy convention: https://nextjs.org/docs/app/building-your-application/routing/middleware
 *
 * What it does:
 * 1. Reads auth cookies from the incoming request
 * 2. Calls supabase.auth.getClaims() to validate and potentially refresh the JWT
 * 3. Propagates refreshed tokens to both the request (for server-side use)
 *    and the response (for the browser to store)
 * 4. Sets Cache-Control headers to prevent CDN session leakage
 *
 * What it does NOT do:
 * - It does NOT enforce auth redirects for all routes
 * - It does NOT block unauthenticated requests
 * - Auth gating is handled by page layouts and API route handlers
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     *
     * This ensures the session refresh runs on all page loads, API calls,
     * and server actions — but skips static assets for performance.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
