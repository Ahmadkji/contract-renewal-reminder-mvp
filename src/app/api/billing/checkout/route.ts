import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, validateSession } from '@/lib/supabase/server'
import { resolvePlan } from '@/lib/billing/plans'
import { createCreemCheckoutSession, CreemRequestError } from '@/lib/billing/creem-client'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit'
import { serverEnv as env } from '@/lib/env/server'

const CHECKOUT_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const CHECKOUT_SESSION_DEDUPE_TTL_MS = (() => {
  const parsed = Number.parseInt(process.env.CHECKOUT_SESSION_DEDUPE_TTL_MS || '30000', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30_000
  }
  return Math.max(5_000, Math.min(parsed, 120_000))
})()
const CHECKOUT_SESSION_DEDUPE_MAX_ENTRIES = 1_000

const checkoutSessionDedupeCache = new Map<string, { checkoutUrl: string; requestId: string; expiresAt: number }>()

function parseRequestBody(value: unknown): { planCode?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as { planCode?: string }
}

function parseRequestId(request: NextRequest): string {
  const requestId = request.headers.get('x-request-id')?.trim()
  return requestId ? requestId.slice(0, 128) || randomUUID() : randomUUID()
}

function isAllowedCreemUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && (parsed.hostname === 'creem.io' || parsed.hostname.endsWith('.creem.io'))
  } catch {
    return false
  }
}

function extractCheckoutUrl(responsePayload: unknown): string | null {
  if (!responsePayload || typeof responsePayload !== 'object') {
    return null
  }

  const payload = responsePayload as Record<string, unknown>
  const directUrl = payload.checkout_url || payload.url
  if (typeof directUrl === 'string' && directUrl.trim()) {
    return directUrl.trim()
  }

  const nestedData =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null
  const dataUrl = nestedData?.checkout_url || nestedData?.url
  if (typeof dataUrl === 'string' && dataUrl.trim()) {
    return dataUrl.trim()
  }

  return null
}

function getProviderUnavailableResponse(retryAfterSeconds: number = 30): NextResponse {
  const safeRetryAfterSeconds = Math.max(1, Math.min(300, Math.trunc(retryAfterSeconds)))
  return NextResponse.json(
    {
      success: false,
      code: 'BILLING_PROVIDER_UNAVAILABLE',
      error: 'Billing provider is temporarily unavailable. Please try again shortly.',
      retryAfterSeconds: safeRetryAfterSeconds,
    },
    {
      status: 503,
      headers: {
        'Retry-After': String(safeRetryAfterSeconds),
      },
    }
  )
}

function getCheckoutRateLimitedResponse(
  rateResult: { retryAfterSeconds: number; remaining: number }
): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.min(300, Math.trunc(rateResult.retryAfterSeconds || 30)))
  return NextResponse.json(
    {
      success: false,
      code: 'CHECKOUT_RATE_LIMITED',
      error: 'Too many checkout attempts. Please try again shortly.',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(
        {
          allowed: false,
          remaining: Math.max(0, Math.trunc(rateResult.remaining || 0)),
          retryAfterSeconds,
        },
        CHECKOUT_RATE_LIMIT
      ),
    }
  )
}

function getCachedCheckoutSession(cacheKey: string): { checkoutUrl: string; requestId: string } | null {
  const cached = checkoutSessionDedupeCache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    checkoutSessionDedupeCache.delete(cacheKey)
    return null
  }

  return {
    checkoutUrl: cached.checkoutUrl,
    requestId: cached.requestId,
  }
}

function setCachedCheckoutSession(
  cacheKey: string,
  data: { checkoutUrl: string; requestId: string }
): void {
  checkoutSessionDedupeCache.set(cacheKey, {
    ...data,
    expiresAt: Date.now() + CHECKOUT_SESSION_DEDUPE_TTL_MS,
  })

  while (checkoutSessionDedupeCache.size > CHECKOUT_SESSION_DEDUPE_MAX_ENTRIES) {
    const oldestKey = checkoutSessionDedupeCache.keys().next().value as string | undefined
    if (!oldestKey) {
      break
    }
    checkoutSessionDedupeCache.delete(oldestKey)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/billing/checkout')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`billing-checkout:ip:${ip}`, CHECKOUT_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getCheckoutRateLimitedResponse(ipRate)
    }

    const { user, error: sessionError } = await validateSession()
    if (sessionError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRate = await checkRateLimit(`billing-checkout:user:${user.id}`, CHECKOUT_RATE_LIMIT)
    if (!userRate.allowed) {
      return getCheckoutRateLimitedResponse(userRate)
    }

    const requestBody = parseRequestBody(await request.json().catch(() => ({})))
    const plan = resolvePlan(requestBody.planCode || '')
    const cacheKey = `${user.id}:${plan.code}`
    const cachedCheckoutSession = getCachedCheckoutSession(cacheKey)

    if (cachedCheckoutSession) {
      return NextResponse.json(
        {
          success: true,
          data: {
            checkoutUrl: cachedCheckoutSession.checkoutUrl,
            requestId: cachedCheckoutSession.requestId,
          },
        },
        {
          headers: getRateLimitHeaders(userRate, CHECKOUT_RATE_LIMIT),
        }
      )
    }

    const admin = createAdminClient()
    const { data: existingCustomer, error: existingCustomerError } = await admin
      .from('billing_customers')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingCustomerError) {
      throw new Error(existingCustomerError.message)
    }

    const requestId = parseRequestId(request)
    const checkoutResponse = await createCreemCheckoutSession({
      product_id: plan.productId,
      request_id: requestId,
      customer: existingCustomer?.provider_customer_id
        ? { id: existingCustomer.provider_customer_id }
        : undefined,
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?billing=checkout_success`,
      metadata: {
        userId: user.id,
        planCode: plan.code,
        requestId,
      },
    })

    const checkoutUrl = extractCheckoutUrl(checkoutResponse)
    if (!checkoutUrl || !isAllowedCreemUrl(checkoutUrl)) {
      throw new Error('Creem checkout response did not include a trusted checkout URL')
    }

    setCachedCheckoutSession(cacheKey, {
      checkoutUrl,
      requestId,
    })

    await admin.from('billing_audit_logs').insert({
      user_id: user.id,
      actor_type: 'user',
      actor_id: user.id,
      action: 'checkout_session_created',
      request_id: requestId,
      metadata: {
        planCode: plan.code,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          checkoutUrl,
          requestId,
        },
      },
      {
        headers: getRateLimitHeaders(userRate, CHECKOUT_RATE_LIMIT),
      }
    )
  } catch (error) {
    console.error('[Billing Checkout] Failed to create checkout session:', error)

    const message = error instanceof Error ? error.message : 'Failed to create checkout session'
    if (message.includes('Invalid plan selected')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    if (message.includes('Billing product ID is not configured')) {
      return NextResponse.json(
        { success: false, error: 'Billing is not configured for this plan yet.' },
        { status: 500 }
      )
    }

    if (error instanceof CreemRequestError) {
      const providerUnavailable =
        error.retryable || error.status === null || (error.status !== null && error.status >= 500)

      if (providerUnavailable) {
        return getProviderUnavailableResponse(error.retryAfterSeconds ?? 30)
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Billing provider rejected the request. Please verify your plan and try again.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create checkout session',
      },
      { status: 500 }
    )
  }
}
