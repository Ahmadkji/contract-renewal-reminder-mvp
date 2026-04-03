import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { serverEnv as env } from '@/lib/env/server'
import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/validation/auth-schema'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRequestIp,
  type RateLimitOptions,
} from '@/lib/security/rate-limit'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'
import { mapSupabaseError } from '@/lib/errors/auth-errors'

const FORGOT_PASSWORD_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const FORGOT_PASSWORD_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

function hashEmail(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
}

function getHeaders(request: NextRequest, rateHeaders: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
    ...rateHeaders,
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/auth/forgot-password')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`auth:forgot-password:ip:${ip}`, FORGOT_PASSWORD_IP_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many reset requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(ipRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getHeaders(request, getRateLimitHeaders(ipRate, FORGOT_PASSWORD_IP_RATE_LIMIT)),
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validated = forgotPasswordSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid email address.',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: getHeaders(request),
        }
      )
    }

    const emailRate = await checkRateLimit(
      `auth:forgot-password:email:${hashEmail(validated.data.email)}`,
      FORGOT_PASSWORD_EMAIL_RATE_LIMIT
    )
    if (!emailRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many reset requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(emailRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getHeaders(request, getRateLimitHeaders(emailRate, FORGOT_PASSWORD_EMAIL_RATE_LIMIT)),
        }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(validated.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
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
        message: 'If an account exists with this email, you will receive a password reset link.',
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Forgot Password] Unexpected error:', error)
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
