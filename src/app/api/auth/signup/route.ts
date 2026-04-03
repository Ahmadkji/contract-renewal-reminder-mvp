import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { serverEnv as env } from '@/lib/env/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfileForUser } from '@/lib/db/profiles'
import { signupSchema } from '@/lib/validation/auth-schema'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRequestIp,
  type RateLimitOptions,
} from '@/lib/security/rate-limit'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'
import { serializeUser } from '@/lib/serializers/user'
import { mapSupabaseError } from '@/lib/errors/auth-errors'

const SIGNUP_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const SIGNUP_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

function hashEmail(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
}

function getResponseHeaders(request: NextRequest, rateHeaders: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
    ...rateHeaders,
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/auth/signup')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`auth:signup:ip:${ip}`, SIGNUP_IP_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many signup attempts. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(ipRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getResponseHeaders(request, getRateLimitHeaders(ipRate, SIGNUP_IP_RATE_LIMIT)),
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validated = signupSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signup details.',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: getResponseHeaders(request),
        }
      )
    }

    const emailRate = await checkRateLimit(
      `auth:signup:email:${hashEmail(validated.data.email)}`,
      SIGNUP_EMAIL_RATE_LIMIT
    )
    if (!emailRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many signup attempts. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(emailRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getResponseHeaders(request, getRateLimitHeaders(emailRate, SIGNUP_EMAIL_RATE_LIMIT)),
        }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: validated.data.email,
      password: validated.data.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
        data: {
          full_name: validated.data.fullName || undefined,
        },
      },
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
          headers: getResponseHeaders(request),
        }
      )
    }

    if (data.user) {
      try {
        await ensureProfileForUser({
          user_id: data.user.id,
          full_name: validated.data.fullName || data.user.email?.split('@')[0] || null,
          timezone: 'UTC',
          email_notifications: true,
        })
      } catch (bootstrapError) {
        console.warn('[Auth Signup] Failed to bootstrap profile:', bootstrapError)
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: data.user ? serializeUser(data.user) : null,
        },
        message: data.session
          ? 'Account created and signed in successfully.'
          : 'Check your email to verify your account.',
      },
      {
        headers: getResponseHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Signup] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An authentication error occurred. Please try again.',
      },
      {
        status: 500,
        headers: getResponseHeaders(request),
      }
    )
  }
}
