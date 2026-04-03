import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/validation/auth-schema'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'
import { mapSupabaseError } from '@/lib/errors/auth-errors'

function getHeaders(request: NextRequest) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/auth/reset-password')
      return getOriginErrorResponse()
    }

    const body = await request.json().catch(() => ({}))
    const validated = resetPasswordSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet requirements.',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: getHeaders(request),
        }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.updateUser({
      password: validated.data.password,
    })

    if (error) {
      const authError = mapSupabaseError(error)
      return NextResponse.json(
        {
          success: false,
          error: authError.message,
          code: authError.code,
        },
        {
          status: authError.statusCode,
          headers: getHeaders(request),
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: data.user ? { id: data.user.id, email: data.user.email } : null,
        },
        message: 'Password updated successfully. Please sign in with your new password.',
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Reset Password] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      {
        status: 500,
        headers: getHeaders(request),
      }
    )
  }
}
