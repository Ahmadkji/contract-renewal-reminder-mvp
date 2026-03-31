import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, validateSession } from '@/lib/supabase/server'
import { createCreemCustomerBillingPortal } from '@/lib/billing/creem-client'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit'

const PORTAL_RATE_LIMIT = {
  limit: 12,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const ALLOWED_CREEM_HOST_SUFFIXES = ['creem.io']

function parseRequestId(request: NextRequest): string {
  const requestId = request.headers.get('x-request-id')?.trim()
  if (!requestId) {
    return randomUUID()
  }

  const normalized = requestId.slice(0, 128)
  return normalized || randomUUID()
}

function isAllowedCreemUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') {
      return false
    }

    return ALLOWED_CREEM_HOST_SUFFIXES.some((suffix) =>
      parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`)
    )
  } catch {
    return false
  }
}

function extractPortalUrl(responsePayload: unknown): string | null {
  if (!responsePayload || typeof responsePayload !== 'object') {
    return null
  }

  const payload = responsePayload as Record<string, unknown>
  const directUrl =
    payload.customer_portal_link ||
    payload.portal_url ||
    payload.url

  if (typeof directUrl === 'string' && directUrl.trim()) {
    return directUrl.trim()
  }

  const nestedData =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null
  const dataUrl =
    nestedData?.customer_portal_link ||
    nestedData?.portal_url ||
    nestedData?.url

  if (typeof dataUrl === 'string' && dataUrl.trim()) {
    return dataUrl.trim()
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/billing/portal')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`billing-portal:ip:${ip}`, PORTAL_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: getRateLimitHeaders(ipRate, PORTAL_RATE_LIMIT),
        }
      )
    }

    const { user, error: sessionError } = await validateSession()
    if (sessionError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRate = await checkRateLimit(`billing-portal:user:${user.id}`, PORTAL_RATE_LIMIT)
    if (!userRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: getRateLimitHeaders(userRate, PORTAL_RATE_LIMIT),
        }
      )
    }

    const admin = createAdminClient()
    const { data: customer, error: customerError } = await admin
      .from('billing_customers')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (customerError) {
      throw new Error(customerError.message)
    }

    if (!customer?.provider_customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'No billing customer found for this account',
        },
        { status: 404 }
      )
    }

    const requestId = parseRequestId(request)
    const portalResponse = await createCreemCustomerBillingPortal({
      customer_id: customer.provider_customer_id,
    })

    const portalUrl = extractPortalUrl(portalResponse)
    if (!portalUrl || !isAllowedCreemUrl(portalUrl)) {
      throw new Error('Creem billing portal response did not include a trusted portal URL')
    }

    await admin
      .from('billing_audit_logs')
      .insert({
        user_id: user.id,
        actor_type: 'user',
        actor_id: user.id,
        action: 'billing_portal_session_created',
        request_id: requestId,
        metadata: {
          hasCustomerMapping: true,
        },
      })

    return NextResponse.json(
      {
        success: true,
        data: {
          portalUrl,
          requestId,
        },
      },
      {
        headers: getRateLimitHeaders(userRate, PORTAL_RATE_LIMIT),
      }
    )
  } catch (error) {
    console.error('[Billing Portal] Failed to create billing portal session:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create billing portal session',
      },
      { status: 500 }
    )
  }
}
