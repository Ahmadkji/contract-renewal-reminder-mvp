import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateOrigin } from '@/lib/security/csrf'
import { checkAuthRateLimit, createAuthErrorResponse } from '@/lib/auth/middleware'
import {
  clearPasswordResetTokensForUser,
  consumePasswordResetToken,
  updateAppUserPassword,
} from '@/lib/auth/app-users'
import { clearAuthCookies, getTokensFromCookies } from '@/lib/auth/tokens'
import { deleteAllUserSessions } from '@/lib/auth/sessions'

const resetWithTokenSchema = z.object({
  token: z.string().min(20, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'reset-password')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  try {
    const body = await request.json().catch(() => ({}))
    const validation = resetWithTokenSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet requirements.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const user = await consumePasswordResetToken(validation.data.token)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset link. Please request a new password reset.',
        },
        { status: 400 }
      )
    }

    await updateAppUserPassword(user.id, validation.data.password)
    await deleteAllUserSessions(user.id)
    await clearPasswordResetTokensForUser(user.id)

    const tokens = await getTokensFromCookies().catch(() => ({ accessToken: null, refreshToken: null }))
    if (tokens.accessToken || tokens.refreshToken) {
      await clearAuthCookies()
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. Please sign in with your new password.',
    })
  } catch (error) {
    console.error('[v2/auth/reset-password] unexpected error', error)
    return createAuthErrorResponse('An error occurred. Please try again.', 500)
  }
}
