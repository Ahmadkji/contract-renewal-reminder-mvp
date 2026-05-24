import { NextRequest, NextResponse } from 'next/server'
import { signupSchema } from '@/lib/validation/auth-schema'
import { validateOrigin } from '@/lib/security/csrf'
import { getRequestIp } from '@/lib/security/rate-limit'
import { checkAuthRateLimit, createAuthErrorResponse } from '@/lib/auth/middleware'
import { createAccessToken, createInitialTokens, setAuthCookies } from '@/lib/auth/tokens'
import { createSession } from '@/lib/auth/sessions'
import { createAppUser, toPublicAppUser } from '@/lib/auth/app-users'

export async function POST(request: NextRequest) {
  const clientIp = getRequestIp(request)

  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'signup')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  try {
    const body = await request.json().catch(() => ({}))
    const validation = signupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signup details',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const user = await createAppUser({
      email: validation.data.email,
      password: validation.data.password,
      fullName: validation.data.fullName || null,
    })

    const sessionSeed = await createInitialTokens(user.id, user.email, '')
    const session = await createSession(
      user.id,
      sessionSeed.hashedRefreshToken,
      sessionSeed.tokenFamily,
      sessionSeed.expiresAt
    )
    const accessToken = await createAccessToken(user.id, user.email, session.id)

    await setAuthCookies(accessToken, sessionSeed.refreshToken)

    console.info('[v2/auth/signup] user created', {
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
        message: 'Account created and signed in successfully.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create account'

    if (message.includes('User already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists',
        },
        { status: 409 }
      )
    }

    console.error('[v2/auth/signup] unexpected error', error)
    return createAuthErrorResponse('Failed to create account', 500)
  }
}
