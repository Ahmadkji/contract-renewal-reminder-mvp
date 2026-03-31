/* eslint-disable no-console */

require('../../scripts/load-env')

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const RECONCILE_LOCK_KEY = 843910732451001n

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function insertPendingWebhookEvents(prefix, count) {
  const nowIso = new Date().toISOString()
  const firstClaimAt = '1970-01-01T00:00:00.000Z'
  const rows = []
  const eventIds = []

  for (let index = 0; index < count; index += 1) {
    const providerEventId = `${prefix}_evt_${index + 1}`
    const payload = {
      id: providerEventId,
      type: 'subscription.paid',
      created_at: nowIso,
      data: {
        object: {
          subscription_id: `${prefix}_sub_${index + 1}`,
          customer_id: `${prefix}_cus_${index + 1}`,
          status: 'active',
        },
      },
    }
    const payloadText = JSON.stringify(payload)

    rows.push({
      provider: 'creem',
      provider_event_id: providerEventId,
      event_type: 'subscription.paid',
      event_created_at: nowIso,
      signature_valid: true,
      payload_sha256: sha256Hex(payloadText),
      payload_json: payload,
      processing_status: 'pending',
      next_attempt_at: nowIso,
      attempt_count: 0,
      processing_claimed_at: null,
      processing_claim_token: null,
      processing_error: null,
      processed_at: null,
      received_at: firstClaimAt,
    })
    eventIds.push(providerEventId)
  }

  const { error } = await admin.from('billing_webhook_inbox').insert(rows)
  if (error) {
    throw new Error(`Failed to seed pending webhook events: ${error.message}`)
  }

  return eventIds
}

async function acquireReconcileLock() {
  const { data, error } = await admin.rpc('try_acquire_billing_reconcile_lock', {
    p_lock_key: RECONCILE_LOCK_KEY.toString(),
  })

  if (error) {
    throw new Error(`Failed to acquire reconcile advisory lock: ${error.message}`)
  }

  if (!data) {
    throw new Error('Could not acquire reconcile advisory lock for isolated claim test')
  }
}

async function releaseReconcileLock() {
  const { error } = await admin.rpc('release_billing_reconcile_lock', {
    p_lock_key: RECONCILE_LOCK_KEY.toString(),
  })

  if (error) {
    console.warn(`[cleanup] failed releasing reconcile advisory lock: ${error.message}`)
  }
}

async function cleanupWebhookEvents(eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return
  }

  const { error } = await admin
    .from('billing_webhook_inbox')
    .delete()
    .in('provider_event_id', eventIds)

  if (error) {
    console.warn(`[cleanup] failed deleting webhook claim test rows: ${error.message}`)
  }
}

async function claimPendingWebhookEvents(limit, claimToken) {
  const { data, error } = await admin.rpc('claim_pending_billing_webhook_events', {
    p_reference_time: new Date().toISOString(),
    p_limit: limit,
    p_claim_token: claimToken,
    p_claim_timeout_seconds: 300,
  })

  if (error) {
    throw new Error(`Failed claiming pending webhook events: ${error.message}`)
  }

  const rows =
    typeof data === 'string'
      ? JSON.parse(data)
      : data

  const providerEventIds = (Array.isArray(rows) ? rows : [])
    .map((row) => row?.provider_event_id)
    .filter((value) => typeof value === 'string' && value.length > 0)

  return {
    claimToken,
    providerEventIds,
  }
}

async function assertClaimedRows(eventIds, allowedClaimTokens) {
  const { data, error } = await admin
    .from('billing_webhook_inbox')
    .select('provider_event_id,processing_status,processing_claim_token,processing_claimed_at')
    .in('provider_event_id', eventIds)

  if (error) {
    throw new Error(`Failed reading claimed webhook rows: ${error.message}`)
  }

  const rows = data || []
  assert.equal(rows.length, eventIds.length, 'All seeded rows should still be present')

  for (const row of rows) {
    assert.equal(row.processing_status, 'pending', `Row ${row.provider_event_id} should remain pending`)
    assert.equal(
      allowedClaimTokens.has(row.processing_claim_token),
      true,
      `Row ${row.provider_event_id} should have one of the expected claim tokens`
    )
    assert.equal(Boolean(row.processing_claimed_at), true, `Row ${row.provider_event_id} should have processing_claimed_at set`)
  }
}

async function main() {
  await acquireReconcileLock()
  const runPrefix = uid('claim_concurrency')
  const seededEventIds = await insertPendingWebhookEvents(runPrefix, 24)

  try {
    const claimTokenA = uid('claim_a')
    const claimTokenB = uid('claim_b')

    const [claimA, claimB] = await Promise.all([
      claimPendingWebhookEvents(12, claimTokenA),
      claimPendingWebhookEvents(12, claimTokenB),
    ])

    assert.equal(claimA.providerEventIds.length > 0, true, 'Claim worker A should claim at least one event')
    assert.equal(claimB.providerEventIds.length > 0, true, 'Claim worker B should claim at least one event')

    const claimSetA = new Set(claimA.providerEventIds)
    const overlap = claimB.providerEventIds.filter((providerEventId) => claimSetA.has(providerEventId))
    assert.equal(overlap.length, 0, 'Concurrent claim workers must not claim the same provider_event_id')

    const totalClaimed = new Set([...claimA.providerEventIds, ...claimB.providerEventIds])
    assert.equal(totalClaimed.size, seededEventIds.length, 'Concurrent claims should cover the full seeded set')

    await assertClaimedRows(seededEventIds, new Set([claimTokenA, claimTokenB]))

    console.log('PASS: claim_pending_billing_webhook_events prevents overlap across concurrent workers')
    console.log(`claimed_a=${claimA.providerEventIds.length} claimed_b=${claimB.providerEventIds.length}`)
  } finally {
    await cleanupWebhookEvents(seededEventIds)
    await releaseReconcileLock()
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exit(1)
})
