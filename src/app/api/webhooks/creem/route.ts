import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { serverEnv as env } from '@/lib/env/server'
import { verifyCreemWebhookSignature } from '@/lib/billing/webhook-signature'
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit'

const WEBHOOK_RATE_LIMIT = {
  limit: 240,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const MAX_WEBHOOK_BODY_BYTES = 1_000_000

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function extractEventMetadata(payload: unknown): {
  eventId: string | null
  eventType: string
  eventCreatedAt: string | null
} {
  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}

  const eventIdRaw = record.id ?? record.event_id
  const eventTypeRaw = record.type ?? record.event_type
  const eventCreatedAtRaw = record.created_at ?? record.created ?? record.timestamp

  const eventId = typeof eventIdRaw === 'string' && eventIdRaw.trim()
    ? eventIdRaw.trim()
    : null

  const eventType = typeof eventTypeRaw === 'string' && eventTypeRaw.trim()
    ? eventTypeRaw.trim()
    : 'unknown'

  const eventCreatedAt = typeof eventCreatedAtRaw === 'string' && eventCreatedAtRaw.trim()
    ? eventCreatedAtRaw
    : null

  return {
    eventId,
    eventType,
    eventCreatedAt,
  }
}

function canFallbackToLegacyIngest(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase()
  return (
    normalized.includes('ingest_creem_webhook_event') ||
    normalized.includes('could not find the function')
  )
}

async function ingestWebhookLegacy(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    eventId: string
    eventType: string
    eventCreatedAt: string | null
    payloadSha: string
    payload: unknown
    signatureHeader: string | null
    request: NextRequest
  }
): Promise<{ duplicate: boolean; accepted: boolean; requeued: boolean; status: string }> {
  const { error: insertError } = await admin
    .from('billing_webhook_inbox')
    .insert({
      provider: 'creem',
      provider_event_id: params.eventId,
      event_type: params.eventType,
      event_created_at: params.eventCreatedAt,
      signature_valid: true,
      payload_sha256: params.payloadSha,
      payload_json: params.payload,
      headers_json: {
        user_agent: params.request.headers.get('user-agent') || null,
        content_type: params.request.headers.get('content-type') || null,
        signature_sha256: params.signatureHeader ? sha256Hex(params.signatureHeader) : null,
      },
      processing_status: 'pending',
    })

  if (!insertError) {
    return {
      duplicate: false,
      accepted: true,
      requeued: false,
      status: 'pending',
    }
  }

  if (insertError.code !== '23505') {
    throw new Error(insertError.message)
  }

  const { data: existingEvent, error: existingEventError } = await admin
    .from('billing_webhook_inbox')
    .select('processing_status')
    .eq('provider_event_id', params.eventId)
    .maybeSingle()

  if (existingEventError) {
    throw new Error(existingEventError.message)
  }

  if (existingEvent?.processing_status === 'pending' || existingEvent?.processing_status === 'failed') {
    const { error: requeueError } = await admin
      .from('billing_webhook_inbox')
      .update({
        processing_status: 'pending',
        processing_error: null,
      })
      .eq('provider_event_id', params.eventId)

    if (requeueError) {
      throw new Error(requeueError.message)
    }

    return {
      duplicate: true,
      accepted: true,
      requeued: true,
      status: 'pending',
    }
  }

  return {
    duplicate: true,
    accepted: true,
    requeued: false,
    status: existingEvent?.processing_status || 'unknown',
  }
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request)
  const ipRate = await checkRateLimit(`creem-webhook:ip:${ip}`, WEBHOOK_RATE_LIMIT)

  if (!ipRate.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: getRateLimitHeaders(ipRate, WEBHOOK_RATE_LIMIT),
      }
    )
  }

  try {
    const signatureHeader =
      request.headers.get('creem-signature') ||
      request.headers.get('x-creem-signature')
    const rawBody = await request.text()

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payload too large',
        },
        { status: 413 }
      )
    }

    const signatureCheck = verifyCreemWebhookSignature(
      rawBody,
      signatureHeader,
      env.CREEM_WEBHOOK_SECRET,
      300
    )

    if (!signatureCheck.valid) {
      console.warn('[Creem Webhook] Signature verification failed', {
        reason: signatureCheck.reason,
        ip,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid webhook signature',
        },
        { status: 401 }
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON payload',
        },
        { status: 400 }
      )
    }

    const metadata = extractEventMetadata(payload)
    if (!metadata.eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing event ID in webhook payload',
        },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const payloadSha = sha256Hex(rawBody)
    const { data: ingestData, error: ingestError } = await admin.rpc('ingest_creem_webhook_event', {
      p_provider_event_id: metadata.eventId,
      p_event_type: metadata.eventType,
      p_event_created_at: metadata.eventCreatedAt,
      p_payload_sha256: payloadSha,
      p_payload_json: payload,
      p_headers_json: {
        user_agent: request.headers.get('user-agent') || null,
        content_type: request.headers.get('content-type') || null,
        signature_sha256: signatureHeader ? sha256Hex(signatureHeader) : null,
      },
      p_signature_valid: true,
    })

    let ingestResult =
      ingestData && typeof ingestData === 'string'
        ? JSON.parse(ingestData)
        : (ingestData as { duplicate?: boolean; accepted?: boolean; requeued?: boolean; status?: string } | null)

    if (ingestError) {
      if (!canFallbackToLegacyIngest(ingestError.message)) {
        throw new Error(ingestError.message)
      }

      ingestResult = await ingestWebhookLegacy(admin, {
        eventId: metadata.eventId,
        eventType: metadata.eventType,
        eventCreatedAt: metadata.eventCreatedAt,
        payloadSha,
        payload,
        signatureHeader,
        request,
      })
    }

    const duplicate = Boolean(ingestResult?.duplicate)

    return NextResponse.json(
      {
        success: true,
        duplicate,
        accepted: ingestResult?.accepted ?? true,
        requeued: ingestResult?.requeued ?? false,
        processing: 'queued',
        eventId: metadata.eventId,
        status: ingestResult?.status || 'pending',
      },
      {
        status: duplicate ? 200 : 202,
        headers: getRateLimitHeaders(ipRate, WEBHOOK_RATE_LIMIT),
      }
    )
  } catch (error) {
    console.error('[Creem Webhook] Failed to process webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook',
      },
      { status: 500 }
    )
  }
}
