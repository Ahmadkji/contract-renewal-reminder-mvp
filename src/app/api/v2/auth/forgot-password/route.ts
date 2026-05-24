import { NextRequest, NextResponse } from 'next/server'
import { serverEnv as env } from '@/lib/env/server'
import { getResendClient, getFormattedFromAddress } from '@/lib/resend'
import { forgotPasswordSchema } from '@/lib/validation/auth-schema'
import { validateOrigin } from '@/lib/security/csrf'
import { checkAuthRateLimit, createAuthErrorResponse } from '@/lib/auth/middleware'
import { createPasswordResetRequest } from '@/lib/auth/app-users'

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403)
  }

  const rateLimitResult = await checkAuthRateLimit(request, 'forgot-password')
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }

  try {
    const body = await request.json().catch(() => ({}))
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid email address.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const resetRequest = await createPasswordResetRequest(validation.data.email)
    if (!resetRequest) {
      return NextResponse.json(
        {
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const resetUrl = new URL('/auth/reset-password', env.NEXT_PUBLIC_APP_URL)
    resetUrl.searchParams.set('token', resetRequest.resetToken)

    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: getFormattedFromAddress(),
      to: [resetRequest.user.email],
      subject: 'Reset your DocRenewal Pro password',
      html: `
        <p>We received a password reset request for your account.</p>
        <p><a href="${resetUrl.toString()}">Reset your password</a></p>
        <p>This link expires in 1 hour.</p>
      `,
      text: `Reset your password: ${resetUrl.toString()}\n\nThis link expires in 1 hour.`,
    })

    if (error) {
      console.error('[v2/auth/forgot-password] failed to send reset email', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to send password reset email right now.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('[v2/auth/forgot-password] unexpected error', error)
    return createAuthErrorResponse('An error occurred. Please try again.', 500)
  }
}
