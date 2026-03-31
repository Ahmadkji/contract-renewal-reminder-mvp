/* eslint-disable no-console */

require('../../scripts/load-env')

const assert = require('node:assert/strict')
const { createClient } = require('@supabase/supabase-js')
const { createHash, randomUUID } = require('node:crypto')

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const TEST_LIMIT = 5
const TEST_WINDOW_SECONDS = 300
const TEST_KEY = `rate-limit-persistence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientA = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const clientB = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const clientC = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function buildAuditBucketId(key, windowSeconds, bucketEpochSeconds) {
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24)
  return `rl:${windowSeconds}:${hash}:${bucketEpochSeconds}`
}

async function consumeRateLimitViaRpc(admin, referenceTimeIso) {
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_limiter_key: TEST_KEY,
    p_limit: TEST_LIMIT,
    p_window_seconds: TEST_WINDOW_SECONDS,
    p_reference_time: referenceTimeIso,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    backend: 'rpc',
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining || 0),
    retryAfterSeconds: Number(row?.retry_after_seconds || 0),
    bucketId: null,
  }
}

async function consumeRateLimitViaAuditFallback(admin, referenceTimeMs) {
  const bucketEpochSeconds =
    Math.floor(referenceTimeMs / 1000 / TEST_WINDOW_SECONDS) * TEST_WINDOW_SECONDS
  const bucketId = buildAuditBucketId(TEST_KEY, TEST_WINDOW_SECONDS, bucketEpochSeconds)

  const { error: insertError } = await admin
    .from('billing_audit_logs')
    .insert({
      actor_type: 'system',
      actor_id: 'rate_limiter_test',
      action: 'rate_limit_consume',
      request_id: `${bucketId}:${randomUUID()}`,
      provider_event_id: bucketId,
      metadata: {
        source: 'integration_test',
        limiter_key: TEST_KEY,
        window_seconds: TEST_WINDOW_SECONDS,
      },
    })

  if (insertError) {
    throw new Error(insertError.message)
  }

  const { count, error: countError } = await admin
    .from('billing_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('provider_event_id', bucketId)
    .eq('action', 'rate_limit_consume')

  if (countError) {
    throw new Error(countError.message)
  }

  const currentCount = Math.max(0, Math.trunc(Number(count || 0)))
  const allowed = currentCount <= TEST_LIMIT
  const remaining = Math.max(TEST_LIMIT - currentCount, 0)
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, bucketEpochSeconds + TEST_WINDOW_SECONDS - Math.floor(referenceTimeMs / 1000))

  return {
    backend: 'audit_fallback',
    allowed,
    remaining,
    retryAfterSeconds,
    bucketId,
  }
}

function shouldUseAuditFallback(error) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  return (
    message.includes('consume_rate_limit') ||
    message.includes('could not find the function') ||
    message.includes('function public.consume_rate_limit') ||
    message.includes('schema cache')
  )
}

function isTransientNetworkError(error) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('enotfound') ||
    message.includes('connect timeout') ||
    message.includes('timed out') ||
    message.includes('eai_again')
  )
}

async function withRetries(label, fn, { attempts = 4, delayMs = 400 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientNetworkError(error) || attempt === attempts) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw lastError || new Error(`Unknown retry failure: ${label}`)
}

async function consumeRateLimit(admin, referenceTimeMs) {
  const referenceTimeIso = new Date(referenceTimeMs).toISOString()
  return withRetries('consume rate limit', async () => {
    try {
      return await consumeRateLimitViaRpc(admin, referenceTimeIso)
    } catch (error) {
      if (!shouldUseAuditFallback(error)) {
        throw error
      }
      return consumeRateLimitViaAuditFallback(admin, referenceTimeMs)
    }
  })
}

async function cleanupAuditRows(bucketId) {
  if (!bucketId) return
  await clientA
    .from('billing_audit_logs')
    .delete()
    .eq('provider_event_id', bucketId)
    .eq('action', 'rate_limit_consume')
}

async function run() {
  let fallbackBucketId = null
  const referenceTimeMs = Date.now()

  try {
    for (let index = 1; index <= TEST_LIMIT; index += 1) {
      const result = await consumeRateLimit(clientA, referenceTimeMs)
      if (result.backend === 'audit_fallback') {
        fallbackBucketId = result.bucketId
      }
      assert.equal(result.allowed, true, `request ${index} should be allowed`)
      assert.equal(result.remaining >= 0, true, `request ${index} should report non-negative remaining`)
    }

    const blockedViaSecondClient = await consumeRateLimit(clientB, referenceTimeMs)
    if (blockedViaSecondClient.backend === 'audit_fallback') {
      fallbackBucketId = blockedViaSecondClient.bucketId
    }
    assert.equal(
      blockedViaSecondClient.allowed,
      false,
      'request after limit should be blocked, even from a separate client'
    )
    assert.equal(
      blockedViaSecondClient.retryAfterSeconds >= 1,
      true,
      'blocked request should include retryAfterSeconds'
    )

    const blockedViaThirdClient = await consumeRateLimit(clientC, referenceTimeMs)
    if (blockedViaThirdClient.backend === 'audit_fallback') {
      fallbackBucketId = blockedViaThirdClient.bucketId
    }
    assert.equal(
      blockedViaThirdClient.allowed,
      false,
      'blocking state should persist across independent clients'
    )

    console.log(
      `PASS: rate limit persistence (${blockedViaThirdClient.backend}) with distributed storage`
    )
  } finally {
    await cleanupAuditRows(fallbackBucketId)
  }
}

run().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
