import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'

function getHeaders(request: NextRequest) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/auth/logout')
      return getOriginErrorResponse()
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn('[Auth Logout] signOut failed:', error.message)
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Logout] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout. Please try again.',
      },
      {
        status: 500,
        headers: getHeaders(request),
      }
    )
  }
}
