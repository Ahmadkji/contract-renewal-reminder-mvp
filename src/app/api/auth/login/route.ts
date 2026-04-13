import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { ensureProfileForUser } from '@/lib/db/profiles'
import { loginSchema } from '@/lib/validation/auth-schema'
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

const LOGIN_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const LOGIN_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

function hashEmail(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
}

function readBody(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}))
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
      logInvalidOriginAttempt(request, 'POST /api/auth/login')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`auth:login:ip:${ip}`, LOGIN_IP_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(ipRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getResponseHeaders(request, getRateLimitHeaders(ipRate, LOGIN_IP_RATE_LIMIT)),
        }
      )
    }

    const body = await readBody(request)
    const validated = loginSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password.',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: getResponseHeaders(request),
        }
      )
    }

    const emailRate = await checkRateLimit(
      `auth:login:email:${hashEmail(validated.data.email)}`,
      LOGIN_EMAIL_RATE_LIMIT
    )

    if (!emailRate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(1, Math.trunc(emailRate.retryAfterSeconds || 30)),
        },
        {
          status: 429,
          headers: getResponseHeaders(request, getRateLimitHeaders(emailRate, LOGIN_EMAIL_RATE_LIMIT)),
        }
      )
    }

    const supabase = await createWritableClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.data.email,
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
          headers: getResponseHeaders(request),
        }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to establish a login session. Please try again.',
        },
        {
          status: 500,
          headers: getResponseHeaders(request),
        }
      )
    }

    try {
      await ensureProfileForUser({
        user_id: data.user.id,
        full_name:
          typeof data.user.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name
            : data.user.email?.split('@')[0] || null,
        timezone: 'UTC',
        email_notifications: true,
      })
    } catch (bootstrapError) {
      console.warn('[Auth Login] Failed to bootstrap profile:', bootstrapError)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: serializeUser(data.user),
        },
      },
      {
        headers: getResponseHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Login] Unexpected error:', error)
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
