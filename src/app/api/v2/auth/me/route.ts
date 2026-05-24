import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from '@/lib/security/csrf'
import { checkAuthRateLimit, createAuthErrorResponse, requireAuth } from '@/lib/auth/middleware'
import { getSession } from '@/lib/auth/sessions'
import { getAppUserById, toPublicAppUser } from '@/lib/auth/app-users'

export async function GET(request: NextRequest) {
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'me')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  const auth = await requireAuth(request)
  if (!auth.success) {
    return auth.response!
  }

  const { userId, sessionId } = auth.context;

  const [user, session] = await Promise.all([
    getAppUserById(userId!),
    getSession(sessionId!),
  ])

  if (!user || !session) {
    return NextResponse.json(
      {
        success: false,
        error: 'Session not found',
      },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      user: toPublicAppUser(user),
      session: {
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
      },
    },
  })
}
