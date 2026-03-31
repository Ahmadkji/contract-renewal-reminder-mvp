import { NextRequest, NextResponse, connection } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { validateSession, createAdminClient } from '@/lib/supabase/server'
import { getContractLimit, getOrCreateEntitlementSnapshot } from '@/lib/billing/entitlements'
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'

const STATUS_RATE_LIMIT = {
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
    const ipRate = await checkRateLimit(`billing-status:ip:${ip}`, STATUS_RATE_LIMIT)
    if (!ipRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(ipRate, STATUS_RATE_LIMIT),
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

    const userRate = await checkRateLimit(`billing-status:user:${user.id}`, STATUS_RATE_LIMIT)
    if (!userRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(userRate, STATUS_RATE_LIMIT),
            'X-Request-Id': requestId,
          },
        }
      )
    }

    const snapshot = await getOrCreateEntitlementSnapshot(user.id, 'billing_status_read')

    const admin = createAdminClient()
    const { data: latestSubscription, error: subError } = await admin
      .from('billing_subscriptions')
      .select('plan_code, status, current_period_end, current_period_start, cancel_at_period_end, canceled_at, trial_end, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError && subError.code !== 'PGRST116') {
      throw new Error(subError.message)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          planCode: latestSubscription?.plan_code || null,
          subscriptionStatus: latestSubscription?.status || 'none',
          isPremium: snapshot.is_premium,
          features: {
            emailReminders: snapshot.features_json?.emailReminders === true,
            csvExport: snapshot.features_json?.csvExport === true,
          },
          usage: {
            contractsLimit: getContractLimit(snapshot),
          },
          effectiveTo: snapshot.effective_to,
          currentPeriodEndDate: latestSubscription?.current_period_end || null,
          currentPeriodStartDate: latestSubscription?.current_period_start || null,
          cancelAtPeriodEnd: latestSubscription?.cancel_at_period_end || false,
          canceledAt: latestSubscription?.canceled_at || null,
          trialEnd: latestSubscription?.trial_end || null,
          computedAt: snapshot.computed_at,
        },
      },
      {
        headers: {
          ...getRateLimitHeaders(userRate, STATUS_RATE_LIMIT),
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Request-Id': requestId,
        },
      }
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error('[Billing Status] Failed to fetch billing status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing status',
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
