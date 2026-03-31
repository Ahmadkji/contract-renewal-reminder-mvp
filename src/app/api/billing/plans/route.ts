import { NextRequest, NextResponse, connection } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { validateSession } from '@/lib/supabase/server'
import { getBillingPricingSnapshot } from '@/lib/billing/pricing'
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'

const PLANS_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers)
  try {
    await connection()

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`billing-plans:ip:${ip}`, PLANS_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(ipRate, PLANS_RATE_LIMIT),
            'X-Request-Id': requestId,
          },
        }
      )
    }

    const { user, error: sessionError } = await validateSession()
    if (sessionError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'X-Request-Id': requestId,
          },
        }
      )
    }

    const userRate = await checkRateLimit(`billing-plans:user:${user.id}`, PLANS_RATE_LIMIT)
    if (!userRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(userRate, PLANS_RATE_LIMIT),
            'X-Request-Id': requestId,
          },
        }
      )
    }

    const snapshot = await getBillingPricingSnapshot()

    return NextResponse.json(
      {
        success: true,
        data: snapshot,
      },
      {
        headers: {
          ...getRateLimitHeaders(userRate, PLANS_RATE_LIMIT),
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Request-Id': requestId,
        },
      }
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error('[Billing Plans] Failed to fetch plan pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing plans',
      },
      {
        status: 500,
        headers: {
          'X-Request-Id': requestId,
        },
      }
    )
  }
}
