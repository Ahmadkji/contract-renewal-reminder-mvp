import { createAdminClient } from '@/lib/supabase/server'
import { inferPlanCodeFromProductId } from '@/lib/billing/plans'

interface NormalizedSubscriptionEvent {
  providerEventId: string
  eventType: string
  eventCreatedAt: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  userId: string | null
  status: string | null
  planCode: string | null
  productId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  canceledAt: string | null
  trialEnd: string | null
  payload: Record<string, unknown>
}

export interface ProcessStoredWebhookEventOptions {
  claimToken?: string | null
  maxAttempts?: number
  referenceTime?: Date
}

export interface ProcessStoredWebhookEventResult {
  providerEventId: string
  status: 'processed' | 'failed' | 'dead_lettered' | 'skipped'
  attemptCount: number
  nextAttemptAt: string | null
  error?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEFAULT_MAX_ATTEMPTS = 8
const RETRY_BACKOFF_SECONDS = [30, 60, 300, 3600]

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function asIsoTimestamp(value: unknown): string | null {
  const asText = asString(value)
  if (!asText) return null

  const parsed = new Date(asText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function isUuid(value: string | null): boolean {
  if (!value) return false
  return UUID_PATTERN.test(value)
}

function mapStatusFromEventType(eventType: string, fallbackStatus: string | null): string | null {
  if (fallbackStatus) {
    return fallbackStatus
  }

  const normalized = eventType.toLowerCase()

  if (normalized.includes('subscription.paid')) return 'active'
  if (normalized.includes('subscription.active')) return 'active'
  if (normalized.includes('subscription.trial')) return 'trialing'
  if (normalized.includes('subscription.canceled')) return 'canceled'
  if (normalized.includes('subscription.expired')) return 'expired'
  if (normalized.includes('subscription.past_due')) return 'past_due'
  if (normalized.includes('subscription.unpaid')) return 'unpaid'
  if (normalized.includes('subscription.refund')) return 'refunded'
  if (normalized.includes('subscription.dispute')) return 'disputed'

  return null
}

async function resolveUserIdByCustomerId(providerCustomerId: string | null): Promise<string | null> {
  if (!providerCustomerId) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('billing_customers')
    .select('user_id')
    .eq('provider_customer_id', providerCustomerId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to resolve customer mapping: ${error.message}`)
  }

  return asString(data?.user_id)
}

function normalizeIncomingEvent(payload: Record<string, unknown>): NormalizedSubscriptionEvent {
  const eventType = asString(payload.type) || asString(payload.event_type) || 'unknown'
  const providerEventId = asString(payload.id) || asString(payload.event_id)

  if (!providerEventId) {
    throw new Error('Webhook payload does not include an event ID')
  }

  const data = asObject(payload.data)
  const dataObject = asObject(data.object)
  const nestedSubscription = asObject(payload.subscription)

  const object = Object.keys(dataObject).length > 0
    ? dataObject
    : (Object.keys(nestedSubscription).length > 0 ? nestedSubscription : payload)

  const metadata = asObject(object.metadata)
  const payloadMetadata = asObject(payload.metadata)
  const mergedMetadata = { ...payloadMetadata, ...metadata }

  const customerValue = object.customer
  const customerObj = asObject(customerValue)

  const providerCustomerId =
    asString(object.customer_id) ||
    asString(customerObj.id) ||
    (typeof customerValue === 'string' ? customerValue : null) ||
    asString(payload.customer_id) ||
    asString(data.customer_id)

  const providerSubscriptionId =
    asString(object.subscription_id) ||
    asString(object.id) ||
    asString(payload.subscription_id)

  const productValue = object.product
  const productObj = asObject(productValue)

  const productId =
    asString(object.product_id) ||
    asString(productObj.id) ||
    (typeof productValue === 'string' ? productValue : null) ||
    asString(payload.product_id)

  const userId =
    asString(mergedMetadata.userId) ||
    asString(mergedMetadata.user_id) ||
    asString(data.user_id)

  const status = mapStatusFromEventType(eventType, asString(object.status))

  const planCode =
    asString(mergedMetadata.planCode) ||
    asString(mergedMetadata.plan_code) ||
    inferPlanCodeFromProductId(productId)

  const eventCreatedAt =
    asIsoTimestamp(payload.created_at) ||
    asIsoTimestamp(payload.created) ||
    asIsoTimestamp(payload.timestamp) ||
    asIsoTimestamp(data.created_at)

  return {
    providerEventId,
    eventType,
    eventCreatedAt,
    providerCustomerId,
    providerSubscriptionId,
    userId,
    status,
    planCode,
    productId,
    currentPeriodStart: asIsoTimestamp(object.current_period_start) || asIsoTimestamp(object.current_period_start_date),
    currentPeriodEnd: asIsoTimestamp(object.current_period_end) || asIsoTimestamp(object.current_period_end_date),
    cancelAtPeriodEnd: asBoolean(object.cancel_at_period_end),
    canceledAt: asIsoTimestamp(object.canceled_at),
    trialEnd: asIsoTimestamp(object.trial_end),
    payload,
  }
}

function getRetryDelaySeconds(attemptCount: number): number {
  if (attemptCount <= RETRY_BACKOFF_SECONDS.length) {
    return RETRY_BACKOFF_SECONDS[attemptCount - 1] || RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1]
  }

  const overflowAttempt = attemptCount - RETRY_BACKOFF_SECONDS.length
  const lastBase = RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1]
  const computed = lastBase * Math.pow(2, overflowAttempt)
  return Math.min(computed, 21_600)
}

interface WebhookErrorClassification {
  tag: string
  nonRetryable: boolean
}

function classifyWebhookProcessingError(message: string): WebhookErrorClassification {
  const normalized = message.toLowerCase()

  if (normalized.includes('idx_billing_subscriptions_one_active_per_user')) {
    return { tag: 'ACTIVE_SUBSCRIPTION_CONFLICT', nonRetryable: true }
  }

  if (normalized.includes('billing_customers_user_id_fkey')) {
    return { tag: 'CUSTOMER_FK_MISSING', nonRetryable: true }
  }

  if (
    normalized.includes('missing event id') ||
    normalized.includes('missing_event_id') ||
    normalized.includes('missing_subscription_id')
  ) {
    return { tag: 'INVALID_WEBHOOK_PAYLOAD', nonRetryable: true }
  }

  return { tag: 'TRANSIENT_PROCESSING_FAILURE', nonRetryable: false }
}

function formatProcessingError(
  classification: WebhookErrorClassification,
  message: string,
  context: 'retry' | 'dead_letter_non_retryable' | 'dead_letter_max_attempts'
): string {
  return `tag=${classification.tag}; context=${context}; message=${message}`
}

function webhookClaimColumnsMissing(message: string): boolean {
  return (
    message.includes('attempt_count') ||
    message.includes('next_attempt_at') ||
    message.includes('processing_claimed_at') ||
    message.includes('processing_claim_token')
  )
}

async function updateWebhookInboxState(
  admin: ReturnType<typeof createAdminClient>,
  providerEventId: string,
  values: Record<string, unknown>,
  claimToken: string | null
): Promise<void> {
  let updateQuery = admin
    .from('billing_webhook_inbox')
    .update(values)
    .eq('provider_event_id', providerEventId)

  if (claimToken) {
    updateQuery = updateQuery.eq('processing_claim_token', claimToken)
  }

  const { error } = await updateQuery
  if (!error) {
    return
  }

  if (!webhookClaimColumnsMissing(error.message)) {
    throw new Error(`Failed to update webhook inbox status: ${error.message}`)
  }

  const fallbackValues = {
    processing_status: values.processing_status,
    processed_at: values.processed_at,
    processing_error: values.processing_error,
  }

  let fallbackUpdateQuery = admin
    .from('billing_webhook_inbox')
    .update(fallbackValues)
    .eq('provider_event_id', providerEventId)

  if (claimToken) {
    fallbackUpdateQuery = fallbackUpdateQuery.eq('processing_claim_token', claimToken)
  }

  const { error: fallbackError } = await fallbackUpdateQuery
  if (fallbackError) {
    throw new Error(`Failed to update webhook inbox status: ${fallbackError.message}`)
  }
}

export async function processStoredCreemWebhookEvent(
  providerEventId: string,
  options: ProcessStoredWebhookEventOptions = {}
): Promise<ProcessStoredWebhookEventResult> {
  const admin = createAdminClient()
  const claimToken = options.claimToken?.trim() || null
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const now = options.referenceTime ?? new Date()
  const nowIso = now.toISOString()

  const { data: inboxEvent, error: inboxError } = await admin
    .from('billing_webhook_inbox')
    .select('*')
    .eq('provider_event_id', providerEventId)
    .single()

  if (inboxError) {
    throw new Error(`Failed to load webhook inbox event: ${inboxError.message}`)
  }

  if (!inboxEvent) {
    throw new Error('Webhook inbox event not found')
  }

  const currentAttemptCount = Math.max(Number(inboxEvent.attempt_count || 0), 0)

  if (claimToken && inboxEvent.processing_claim_token && inboxEvent.processing_claim_token !== claimToken) {
    return {
      providerEventId,
      status: 'skipped',
      attemptCount: currentAttemptCount,
      nextAttemptAt: inboxEvent.next_attempt_at || null,
      error: 'claim_token_mismatch',
    }
  }

  if (inboxEvent.processing_status === 'processed' || inboxEvent.processing_status === 'ignored') {
    return {
      providerEventId,
      status: 'skipped',
      attemptCount: currentAttemptCount,
      nextAttemptAt: inboxEvent.next_attempt_at || null,
    }
  }

  try {
    const normalized = normalizeIncomingEvent(asObject(inboxEvent.payload_json))

    let resolvedUserId = normalized.userId
    if (!isUuid(resolvedUserId)) {
      resolvedUserId = await resolveUserIdByCustomerId(normalized.providerCustomerId)
    }

    const { error: rpcError } = await admin.rpc('apply_creem_subscription_event', {
      p_provider_event_id: normalized.providerEventId,
      p_event_type: normalized.eventType,
      p_event_created_at: normalized.eventCreatedAt,
      p_provider_customer_id: normalized.providerCustomerId,
      p_provider_subscription_id: normalized.providerSubscriptionId,
      p_user_id: isUuid(resolvedUserId) ? resolvedUserId : null,
      p_status: normalized.status,
      p_plan_code: normalized.planCode,
      p_product_id: normalized.productId,
      p_current_period_start: normalized.currentPeriodStart,
      p_current_period_end: normalized.currentPeriodEnd,
      p_cancel_at_period_end: normalized.cancelAtPeriodEnd,
      p_canceled_at: normalized.canceledAt,
      p_trial_end: normalized.trialEnd,
      p_payload: normalized.payload,
    })

    if (rpcError) {
      throw new Error(`Failed to apply subscription event: ${rpcError.message}`)
    }

    await updateWebhookInboxState(
      admin,
      providerEventId,
      {
        processing_status: 'processed',
        processed_at: nowIso,
        processing_error: null,
        processing_claimed_at: null,
        processing_claim_token: null,
        next_attempt_at: nowIso,
      },
      claimToken
    )

    return {
      providerEventId,
      status: 'processed',
      attemptCount: currentAttemptCount,
      nextAttemptAt: nowIso,
    }
  } catch (error) {
    const nextAttemptCount = currentAttemptCount + 1
    const message = error instanceof Error ? error.message : 'Unknown webhook processing failure'
    const classification = classifyWebhookProcessingError(message)
    const deadLettered = classification.nonRetryable || nextAttemptCount >= maxAttempts
    const nextDelaySeconds = getRetryDelaySeconds(nextAttemptCount)
    const nextAttemptAtIso = new Date(now.getTime() + nextDelaySeconds * 1000).toISOString()
    const context: 'retry' | 'dead_letter_non_retryable' | 'dead_letter_max_attempts' = deadLettered
      ? classification.nonRetryable
        ? 'dead_letter_non_retryable'
        : 'dead_letter_max_attempts'
      : 'retry'

    await updateWebhookInboxState(
      admin,
      providerEventId,
      {
        processing_status: deadLettered ? 'ignored' : 'failed',
        processed_at: nowIso,
        processing_error: formatProcessingError(classification, message, context),
        processing_claimed_at: null,
        processing_claim_token: null,
        attempt_count: nextAttemptCount,
        next_attempt_at: deadLettered ? nowIso : nextAttemptAtIso,
      },
      claimToken
    )

    if (deadLettered) {
      return {
        providerEventId,
        status: 'dead_lettered',
        attemptCount: nextAttemptCount,
        nextAttemptAt: nowIso,
        error: formatProcessingError(classification, message, context),
      }
    }

    return {
      providerEventId,
      status: 'failed',
      attemptCount: nextAttemptCount,
      nextAttemptAt: nextAttemptAtIso,
      error: formatProcessingError(classification, message, context),
    }
  }
}
