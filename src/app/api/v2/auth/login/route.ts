/**
 * Secure Login API Route
 *
 * Security Features:
 * - Rate limiting (IP + email)
 * - CSRF protection
 * - bcrypt password verification (12 salt rounds)
 * - JWT access token (15 min expiry) + rotating refresh token (7 days)
 * - Session tracking with device & IP info
 * - Generic failure responses to reduce user enumeration
 */

import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validation/auth-schema'
import { validateOrigin } from '@/lib/security/csrf'
import { getRequestIp } from '@/lib/security/rate-limit'
import { checkAuthRateLimit, createAuthErrorResponse, requireAuth } from '@/lib/auth/middleware'
import { createAccessToken, createInitialTokens, setAuthCookies } from '@/lib/auth/tokens'
import { createSession } from '@/lib/auth/sessions'
import { markAppUserLogin, verifyAppUserPassword, toPublicAppUser } from '@/lib/auth/app-users'

const AUTH_ERROR_MESSAGE = 'Invalid email or password'

export async function POST(request: NextRequest) {
  const clientIp = getRequestIp(request)

  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'login')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  try {
    const body = await request.json().catch(() => ({}))
    const validation = loginSchema.safeParse(body)

    if (!validation.success) {
      console.warn('[v2/auth/login] validation failed', {
        issues: validation.error.issues,
        ip: clientIp,
      })
      return createAuthErrorResponse(AUTH_ERROR_MESSAGE, 401)
    }

    const { email, password } = validation.data
    const user = await verifyAppUserPassword(email, password)

    if (!user) {
      console.warn('[v2/auth/login] failed login attempt', {
        email,
        ip: clientIp,
      })
      return createAuthErrorResponse(AUTH_ERROR_MESSAGE, 401)
    }

    await markAppUserLogin(user.id)

    const sessionSeed = await createInitialTokens(user.id, user.email, '')
    const session = await createSession(
      user.id,
      sessionSeed.hashedRefreshToken,
      sessionSeed.tokenFamily,
      sessionSeed.expiresAt
    )

    const accessToken = await createAccessToken(user.id, user.email, session.id)
    await setAuthCookies(accessToken, sessionSeed.refreshToken)

    console.info('[v2/auth/login] user authenticated', {
      userId: user.id,
      sessionId: session.id,
      ip: clientIp,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          user: toPublicAppUser(user),
          sessionId: session.id,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('[v2/auth/login] unexpected error', error)
    return createAuthErrorResponse('Authentication failed', 500)
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)

  if (!auth.success) {
    return auth.response!
  }

  return NextResponse.json({
    success: true,
    data: {
      isAuthenticated: true,
      userId: auth.context.userId,
      email: auth.context.email,
      sessionId: auth.context.sessionId,
    },
  })
}
