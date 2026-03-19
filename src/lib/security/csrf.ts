/**
 * CSRF Protection - Origin Header Validation
 * 
 * This module provides origin header validation to prevent CSRF attacks
 * on API routes. It's a simple, server-side only solution that
 * requires no client-side changes or external dependencies.
 * 
 * Security Approach:
 * - Validates Origin header for cross-origin requests
 * - Allows same-origin requests (no Origin header)
 * - Compares against allowed origins from environment
 * - Returns 403 Forbidden for invalid origins
 * 
 * Why This Approach:
 * - Simple: No state management or database needed
 * - Secure: Origin headers can't be spoofed by browsers
 * - Scalable: No performance overhead
 * - Standard: Used by Stripe, Auth0, Vercel, Linear
 * 
 * References:
 * - OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 * - Next.js Security: https://nextjs.org/docs/app/building-your-application/routing/middleware
 * - Stripe API Security: https://stripe.com/docs/security/csrf
 */

import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

/**
 * Allowed origins for your application
 * Include all production, staging, and development URLs
 */
const ALLOWED_ORIGINS = [
  // Primary app URL (may be undefined in some setups)
  ...(env.NEXT_PUBLIC_APP_URL ? [env.NEXT_PUBLIC_APP_URL] : []),
  // Localhost variants for development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:3005',
  // Add your production URLs here
  // 'https://yourapp.com',
  // 'https://www.yourapp.com',
]

/**
 * Validate Origin header to prevent CSRF attacks
 * 
 * This function checks the Origin header of incoming requests
 * and ensures it matches one of the allowed origins.
 * 
 * Security Model:
 * 1. Same-origin requests don't send Origin header → Allow
 * 2. Cross-origin requests send Origin header → Validate
 * 3. Invalid Origin → Reject with 403 Forbidden
 * 
 * @param request - Next.js request object
 * @returns true if origin is valid, false otherwise
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   if (!validateOrigin(request)) {
 *     return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
 *   }
 *   // ... proceed with request
 * }
 * ```
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // Allow same-origin requests (no Origin header)
  // Browsers don't send Origin header for same-origin requests
  if (!origin) {
    return true
  }

  // Validate Origin header against allowed origins
  const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
    try {
      // Parse both URLs for comparison
      const allowedUrl = new URL(allowedOrigin)
      const originUrl = new URL(origin)

      // Compare protocol and hostname
      return (
        allowedUrl.protocol === originUrl.protocol &&
        allowedUrl.hostname === originUrl.hostname &&
        allowedUrl.port === originUrl.port
      )
    } catch {
      // Invalid URL format
      return false
    }
  })

  return isAllowed
}

/**
 * Get origin validation error response
 * 
 * Returns a standardized 403 Forbidden response for invalid origins
 * Uses NextResponse.json() for consistent error format
 * 
 * @returns NextResponse with 403 status
 */
export function getOriginErrorResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'Invalid origin. This request cannot be processed.'
    },
    {
      status: 403
    }
  )
}

/**
 * Middleware function for origin validation
 * 
 * Use this in API routes to automatically validate origin
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   if (!validateOriginMiddleware(request)) {
 *     return getOriginErrorResponse()
 *   }
 *   // ... proceed with request
 * }
 * ```
 */
export function validateOriginMiddleware(request: NextRequest): boolean {
  return validateOrigin(request)
}

/**
 * Log invalid origin attempts for security monitoring
 * 
 * This helps detect potential CSRF attacks
 * 
 * @param request - Next.js request object
 * @param reason - Reason for validation failure
 */
export function logInvalidOriginAttempt(
  request: NextRequest,
  reason: string
): void {
  console.warn('[CSRF Protection] Invalid origin attempt detected:', {
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           'unknown',
    reason,
    timestamp: new Date().toISOString()
  })
}
