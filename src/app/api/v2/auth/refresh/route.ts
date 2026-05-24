import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from '@/lib/security/csrf'
import { checkAuthRateLimit, createAuthErrorResponse, requireAuth } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'refresh')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  const auth = await requireAuth(request)
  if (!auth.success) {
    return auth.response!
  }

  if (auth.response) {
    return auth.response
  }

  return NextResponse.json({
    success: true,
    data: {
      userId: auth.context.userId,
      email: auth.context.email,
      sessionId: auth.context.sessionId,
    },
  })
}
