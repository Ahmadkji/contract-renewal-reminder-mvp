import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from '@/lib/security/csrf'
import { checkAuthRateLimit, createAuthErrorResponse, requireAuth } from '@/lib/auth/middleware'
import { getUserSessions } from '@/lib/auth/sessions'

export async function GET(request: NextRequest) {
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'sessions')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  const auth = await requireAuth(request)
  if (!auth.success) {
    return auth.response!
  }

  const sessions = await getUserSessions(auth.context.userId!)

  return NextResponse.json({
    success: true,
    data: {
      currentSessionId: auth.context.sessionId,
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === auth.context.sessionId,
      })),
    },
  })
}
