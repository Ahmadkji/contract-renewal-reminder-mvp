import { createAdminClient } from '@/lib/supabase/server'
import { randomUUID } from 'node:crypto'

export interface ReconciliationResult {
  claimedEvents: number
  processedEvents: number
  recomputedUsers: number
  failedEvents: number
  deadLetteredEvents: number
}

export interface ReconciliationOptions {
  limit?: number
  concurrency?: number
  claimTimeoutSeconds?: number
  maxAttempts?: number
  maxBatches?: number
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(min, Math.min(Math.trunc(value as number), max))
}

function canFallbackToLegacyClaim(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('claim_pending_billing_webhook_events') ||
    normalized.includes('could not find the function') ||
    normalized.includes('processing_claimed_at') ||
    normalized.includes('processing_claim_token') ||
    normalized.includes('next_attempt_at') ||
    normalized.includes('attempt_count')
  )
}

function isTransientSupabaseTransportError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('connect timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('eai_again')
  )
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return

  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })

  await Promise.all(workers)
}

export async function reconcileBillingState(
  limitOrOptions: number | ReconciliationOptions = 200
): Promise<ReconciliationResult> {
  const admin = createAdminClient()
  const options: ReconciliationOptions =
    typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions
  const limit = clamp(options.limit, 1, 1000, 200)
  const concurrency = clamp(options.concurrency, 1, 50, 10)
  const claimTimeoutSeconds = clamp(options.claimTimeoutSeconds, 30, 3600, 300)
  const maxAttempts = clamp(options.maxAttempts, 1, 20, 8)
  const maxBatches = clamp(options.maxBatches, 1, 30, 5)

  let claimedEventsCount = 0
  let processedEvents = 0
  let failedEvents = 0
  let deadLetteredEvents = 0

  const { processStoredCreemWebhookEvent } = await import('@/lib/billing/webhook-processor')
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const claimToken = randomUUID()
    const { data: claimedEvents, error: claimError } = await admin.rpc(
      'claim_pending_billing_webhook_events',
      {
        p_reference_time: new Date().toISOString(),
        p_limit: limit,
        p_claim_token: claimToken,
        p_claim_timeout_seconds: claimTimeoutSeconds,
      }
    )

    let pendingEvents: string[] = []
    let processingClaimToken: string | null = claimToken

    if (claimError) {
      if (!canFallbackToLegacyClaim(claimError.message)) {
        throw new Error(`Failed to claim pending billing webhook events: ${claimError.message}`)
      }

      const { data: fallbackRows, error: fallbackError } = await admin
        .from('billing_webhook_inbox')
        .select('provider_event_id')
        .in('processing_status', ['pending', 'failed'])
        .order('received_at', { ascending: true })
        .limit(limit)

      if (fallbackError) {
        throw new Error(`Failed to load pending billing webhook events: ${fallbackError.message}`)
      }

      pendingEvents = (fallbackRows || [])
        .map((row) => row.provider_event_id || null)
        .filter((value): value is string => Boolean(value))
      processingClaimToken = null
    } else {
      pendingEvents = ((claimedEvents || []) as Array<{ provider_event_id?: string | null }>)
        .map((row) => row.provider_event_id || null)
        .filter((value): value is string => Boolean(value))
    }

    if (pendingEvents.length === 0) {
      break
    }

    claimedEventsCount += pendingEvents.length

    await mapWithConcurrency(pendingEvents, concurrency, async (providerEventId) => {
      try {
        const outcome = await processStoredCreemWebhookEvent(providerEventId, {
          claimToken: processingClaimToken,
          maxAttempts,
        })

        if (outcome.status === 'processed') {
          processedEvents += 1
          return
        }

        if (outcome.status === 'dead_lettered') {
          deadLetteredEvents += 1
          return
        }

        if (outcome.status === 'failed') {
          failedEvents += 1
          return
        }
      } catch {
        failedEvents += 1
      }
    })
  }

  const { data: usersToRecompute, error: usersError } = await admin
    .from('billing_subscriptions')
    .select('user_id')
    .order('updated_at', { ascending: false })
    .limit(limit * maxBatches)

  if (usersError) {
    if (isTransientSupabaseTransportError(usersError.message)) {
      return {
        claimedEvents: claimedEventsCount,
        processedEvents,
        recomputedUsers: 0,
        failedEvents,
        deadLetteredEvents,
      }
    }

    throw new Error(`Failed to load users for entitlement reconciliation: ${usersError.message}`)
  }

  const distinctUserIds = Array.from(new Set((usersToRecompute || []).map((row) => row.user_id)))
  let recomputedUsers = 0

  for (const userId of distinctUserIds) {
    const { error } = await admin.rpc('recompute_entitlement_snapshot', {
      p_user_id: userId,
      p_reason: 'scheduled_reconciliation',
      p_source_subscription_id: null,
    })

    if (!error) {
      recomputedUsers += 1
    }
  }

  return {
    claimedEvents: claimedEventsCount,
    processedEvents,
    recomputedUsers,
    failedEvents,
    deadLetteredEvents,
  }
}
