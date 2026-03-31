/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */

/**
 * Subscription Production-Safety Integration Suite
 *
 * Runs exactly 10 high-value integration tests that validate:
 * - Checkout flow
 * - Recurring billing lifecycle
 * - Webhook security and idempotency
 * - Cross-user isolation
 * - Billing DB consistency + entitlement alignment
 */

require('../../scripts/load-env')

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { createClient } = require('@supabase/supabase-js')

const APP_HOST = '127.0.0.1'
const SUBSCRIPTION_TEST_LANE = (process.env.SUBSCRIPTION_TEST_LANE || 'deterministic').trim().toLowerCase()
const IS_LIVE_LANE = SUBSCRIPTION_TEST_LANE === 'live'
const SUPPORTED_LANES = new Set(['deterministic', 'live'])
const APP_PORT = Number(
  process.env.SUBSCRIPTION_TEST_APP_PORT || (IS_LIVE_LANE ? 3021 : 3020)
)
const APP_URL = `http://${APP_HOST}:${APP_PORT}`
const LIVE_PUBLIC_APP_URL = (
  process.env.SUBSCRIPTION_TEST_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
).trim()
const REQUEST_ORIGIN = (
  IS_LIVE_LANE
    ? process.env.SUBSCRIPTION_TEST_REQUEST_ORIGIN || LIVE_PUBLIC_APP_URL || APP_URL
    : APP_URL
).trim()
const MOCK_CREEM_PORT = Number(process.env.SUBSCRIPTION_TEST_CREEM_PORT || 4010)
const MOCK_CREEM_URL = `http://${APP_HOST}:${MOCK_CREEM_PORT}`
const TEST_TIMEOUT_MS = 120_000

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const CREEM_WEBHOOK_SECRET = requiredEnv('CREEM_WEBHOOK_SECRET')
const CREEM_MONTHLY_PRODUCT_ID = requiredEnv('CREEM_MONTHLY_PRODUCT_ID')
const CREEM_YEARLY_PRODUCT_ID = requiredEnv('CREEM_YEARLY_PRODUCT_ID')
const CRON_SECRET = requiredEnv('CRON_SECRET')

const COOKIE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

const ACTIVE_LIKE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'subscription.active',
  'subscription.paid',
  'subscription.trialing',
  'subscription.scheduled_cancel',
  'subscription.past_due',
  'subscription.unpaid',
])

const VALID_TRANSITIONS = {
  none: new Set([
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'canceled',
    'expired',
    'subscription.scheduled_cancel',
    'subscription.active',
    'subscription.paid',
    'subscription.trialing',
    'subscription.past_due',
    'subscription.unpaid',
  ]),
  active: new Set(['active', 'past_due', 'canceled', 'subscription.scheduled_cancel', 'subscription.paid']),
  trialing: new Set(['active', 'expired', 'canceled', 'trialing', 'subscription.paid']),
  past_due: new Set(['active', 'past_due', 'unpaid', 'canceled', 'subscription.paid']),
  unpaid: new Set(['active', 'unpaid', 'canceled', 'subscription.paid']),
  'subscription.scheduled_cancel': new Set(['subscription.scheduled_cancel', 'canceled', 'active', 'subscription.paid']),
  canceled: new Set(['canceled']),
  expired: new Set(['expired', 'active']),
}

const WEBHOOK_TERMINAL_STATUSES = new Set(['processed', 'ignored'])

let nextDevProcess = null
let mockCreemServer = null
const createdUserIds = new Set()
const pooledUsers = new Map()

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const mockCreemState = {
  checkouts: [],
  portals: [],
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function isTransientNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('fetch failed') ||
    message.includes('UND_ERR_CONNECT_TIMEOUT') ||
    message.includes('Connect Timeout') ||
    message.includes('network')
  )
}

function isLikelyExternalTransient(errorLike) {
  const message = String(errorLike || '').toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('und_err_connect_timeout') ||
    message.includes('connect timeout') ||
    message.includes('econnreset') ||
    message.includes('request_timeout') ||
    message.includes('billing_provider_unavailable') ||
    message.includes('creem network request failed')
  )
}

async function withRetries(label, fn, { attempts = 4, delayMs = 1500 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientNetworkError(error) || attempt === attempts) {
        throw error
      }

      console.warn(`[retry] ${label} failed on attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`)
      await sleep(delayMs * attempt)
    }
  }

  throw lastError || new Error(`Unknown retry failure in ${label}`)
}

function getPoolKey(label) {
  if (label.startsWith('sub-t10-a')) {
    return 'cross_user_a'
  }
  if (label.startsWith('sub-t10-b')) {
    return 'cross_user_b'
  }
  return 'default'
}

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createAuthCookie(session) {
  return `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(session))}`
}

function createWebhookSignature(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${rawBody}`
  const digest = crypto.createHmac('sha256', CREEM_WEBHOOK_SECRET).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${digest}`
}

function ensureNoSensitiveDataInJsonString(value, context) {
  const lowered = String(value).toLowerCase()
  const forbiddenSubstrings = [
    'card_number',
    'cvv',
    'cvc',
    '4242424242424242',
    'payment_method_details',
  ]

  for (const bad of forbiddenSubstrings) {
    assert.equal(
      lowered.includes(bad),
      false,
      `${context} should not contain sensitive payment token/field: ${bad}`
    )
  }
}

function isTransientSupabaseQueryError(message) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('connect timeout') ||
    normalized.includes('timeout')
  )
}

function isMissingSupabaseTableError(message) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('could not find the table') ||
    normalized.includes('relation') && normalized.includes('does not exist')
  )
}

async function startMockCreemServer() {
  mockCreemServer = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing URL' }))
        return
      }

      const body = await readRequestBody(req)
      const parsed = body ? JSON.parse(body) : {}

      if (req.method === 'POST' && req.url === '/v1/checkouts') {
        mockCreemState.checkouts.push(parsed)
        const id = uid('chk')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id,
            checkout_url: `https://checkout.creem.io/session/${id}`,
            status: 'created',
          })
        )
        return
      }

      if (req.method === 'POST' && req.url === '/v1/customers/billing') {
        mockCreemState.portals.push(parsed)
        const id = uid('portal')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id,
            customer_portal_link: `https://billing.creem.io/portal/${id}`,
          })
        )
        return
      }

      if (req.method === 'GET' && req.url.startsWith('/v1/subscriptions/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id: req.url.split('/').pop(), status: 'active' }))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'mock server error' }))
    }
  })

  await new Promise((resolve, reject) => {
    mockCreemServer.once('error', reject)
    mockCreemServer.listen(MOCK_CREEM_PORT, APP_HOST, () => resolve())
  })
}

async function stopMockCreemServer() {
  if (!mockCreemServer) return
  await new Promise((resolve) => mockCreemServer.close(() => resolve()))
  mockCreemServer = null
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function startNextDev() {
  const env = {
    ...process.env,
    FORCE_COLOR: '0',
  }

  if (!IS_LIVE_LANE) {
    env.NEXT_PUBLIC_APP_URL = APP_URL
  } else if (LIVE_PUBLIC_APP_URL) {
    env.NEXT_PUBLIC_APP_URL = LIVE_PUBLIC_APP_URL
  }

  if (!IS_LIVE_LANE) {
    env.CREEM_API_BASE_URL = MOCK_CREEM_URL
    env.CREEM_API_KEY = process.env.CREEM_API_KEY || 'test-creem-key'
  }

  nextDevProcess = spawn('node', ['./node_modules/next/dist/bin/next', 'dev', '-p', String(APP_PORT)], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  nextDevProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[next] ${chunk}`)
  })

  nextDevProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[next:err] ${chunk}`)
  })

  await waitForAppReady()
}

async function stopNextDev() {
  if (!nextDevProcess) return

  const proc = nextDevProcess
  nextDevProcess = null

  await new Promise((resolve) => {
    const done = () => resolve()
    proc.once('exit', done)
    proc.kill('SIGINT')
    setTimeout(() => {
      proc.kill('SIGKILL')
      resolve()
    }, 8000)
  })
}

async function waitForAppReady() {
  const start = Date.now()
  let lastError = null

  while (Date.now() - start < TEST_TIMEOUT_MS) {
    try {
      const response = await fetch(`${APP_URL}/api`, {
        method: 'GET',
      })

      if (response.ok) {
        return
      }

      lastError = new Error(`Health check returned status ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await sleep(1200)
  }

  throw new Error(`Next app did not become ready in time: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createTestUser(label) {
  const password = 'TestPassword123!'
  const poolKey = getPoolKey(label)

  let userRecord = null
  if (!IS_LIVE_LANE) {
    userRecord = pooledUsers.get(poolKey) || null
  }

  if (!userRecord) {
    const email = `${label}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.com`
    const { data: created, error: createError } = await withRetries(
      `create user ${email}`,
      () => admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    )

    if (createError || !created.user) {
      throw new Error(`Failed to create user: ${createError?.message || 'unknown'}`)
    }

    userRecord = {
      userId: created.user.id,
      email,
      password,
    }

    createdUserIds.add(created.user.id)
    if (!IS_LIVE_LANE) {
      pooledUsers.set(poolKey, userRecord)
    }
  }

  if (!IS_LIVE_LANE) {
    await resetBillingStateForUser(userRecord.userId)
  }

  const { data: signedIn, error: signInError } = await withRetries(
    `sign in user ${userRecord.email}`,
    () => anon.auth.signInWithPassword({
      email: userRecord.email,
      password: userRecord.password,
    })
  )

  if (signInError || !signedIn.session) {
    throw new Error(`Failed to sign in user: ${signInError?.message || 'unknown'}`)
  }

  return {
    userId: userRecord.userId,
    email: userRecord.email,
    password: userRecord.password,
    session: signedIn.session,
    cookie: createAuthCookie(signedIn.session),
    accessToken: signedIn.session.access_token,
  }
}

async function resetBillingStateForUser(userId) {
  const deleteTargets = [
    ['billing_subscriptions', 'user_id'],
    ['billing_customers', 'user_id'],
    ['entitlement_snapshots', 'user_id'],
  ]

  for (const [table, column] of deleteTargets) {
    const { error } = await withRetries(
      `reset ${table} for ${userId}`,
      () => admin.from(table).delete().eq(column, userId)
    )

    if (error && !isTransientSupabaseQueryError(error.message)) {
      if (isMissingSupabaseTableError(error.message)) {
        continue
      }
      throw new Error(`Failed resetting ${table} for user ${userId}: ${error.message}`)
    }
  }
}

async function deleteTestUser(userId, options = {}) {
  const { force = false } = options

  if (!force && !IS_LIVE_LANE) {
    const isPooled = Array.from(pooledUsers.values()).some((entry) => entry.userId === userId)
    if (isPooled) {
      return
    }
  }

  const { error } = await withRetries(
    `delete user ${userId}`,
    () => admin.auth.admin.deleteUser(userId)
  )

  if (error) {
    console.warn(`[cleanup] Failed to delete user ${userId}: ${error.message}`)
    return
  }

  createdUserIds.delete(userId)
}

async function cleanupAllUsers() {
  const ids = Array.from(createdUserIds)
  for (const id of ids) {
    await deleteTestUser(id, { force: true })
  }
}

async function apiJson(path, options = {}) {
  const method = options.method || 'GET'
  const headers = {
    ...(options.headers || {}),
  }

  if (options.sessionCookie) {
    headers.Cookie = options.sessionCookie
  }

  if (method !== 'GET' && method !== 'HEAD') {
    headers.Origin = headers.Origin || REQUEST_ORIGIN
  }

  let body
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  const response = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body,
  })

  const text = await response.text()
  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
  }
}

async function sendWebhook(payload, { validSignature = true, timestamp } = {}) {
  const rawBody = JSON.stringify(payload)
  const signature = validSignature
    ? createWebhookSignature(rawBody, timestamp)
    : 't=1,v1=invalidsignature'

  return apiJson('/api/webhooks/creem', {
    method: 'POST',
    headers: {
      'creem-signature': signature,
    },
    body: rawBody,
  })
}

function assertWebhookAccepted(response, label = 'webhook') {
  const acceptedStatus = response.status === 200 || response.status === 202
  assert.equal(acceptedStatus, true, `${label} should return 200 or 202; got ${response.status}`)
  assert.equal(response.json?.success, true, `${label} should return success=true`)
  assert.equal(response.json?.accepted, true, `${label} should return accepted=true`)
}

async function triggerBillingReconcile(options = {}) {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 200),
    concurrency: String(options.concurrency ?? 10),
    maxAttempts: String(options.maxAttempts ?? 8),
  })

  const attempts = 4
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await apiJson(`/api/internal/billing/reconcile?${query.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    })

    if (response.status === 200 && response.json?.success === true) {
      return response.json?.data || null
    }

    const message = String(response.text || '')
    const transient =
      message.toLowerCase().includes('fetch failed') ||
      message.toLowerCase().includes('enotfound') ||
      message.toLowerCase().includes('timeout')

    if (!transient || attempt === attempts) {
      throw new Error(
        `Billing reconcile failed: status=${response.status}, body=${response.text.slice(0, 500)}`
      )
    }

    await sleep(500 * attempt)
  }

  return null
}

async function waitForWebhookTerminalState(
  providerEventId,
  {
    timeoutMs = 90_000,
    pollMs = 300,
    expectedStatus = 'processed',
  } = {}
) {
  const deadline = Date.now() + timeoutMs
  let lastStatus = 'missing'
  let lastError = null

  while (Date.now() < deadline) {
    const inbox = await findSingle(
      'billing_webhook_inbox',
      { provider_event_id: providerEventId },
      'provider_event_id,processing_status,processing_error'
    )

    if (inbox) {
      lastStatus = inbox.processing_status || 'unknown'
      lastError = inbox.processing_error || null

      if (WEBHOOK_TERMINAL_STATUSES.has(inbox.processing_status)) {
        if (expectedStatus && inbox.processing_status !== expectedStatus) {
          throw new Error(
            `Webhook ${providerEventId} reached unexpected terminal status=${inbox.processing_status}; expected=${expectedStatus}; error=${inbox.processing_error || 'none'}`
          )
        }
        return inbox
      }
    }

    await triggerBillingReconcile({
      limit: 1000,
      concurrency: 25,
      maxAttempts: 8,
    })
    await sleep(pollMs)
  }

  throw new Error(
    `Timed out waiting for webhook ${providerEventId} terminal state; lastStatus=${lastStatus}; error=${lastError || 'none'}`
  )
}

async function sendWebhookAndAwaitProcessing(
  payload,
  {
    validSignature = true,
    timestamp,
    awaitProcessing = true,
    expectedStatus = 'processed',
  } = {}
) {
  const response = await sendWebhook(payload, { validSignature, timestamp })

  if (!validSignature || !awaitProcessing) {
    return { response, inbox: null }
  }

  assertWebhookAccepted(response, `webhook ${payload?.id || 'unknown'}`)
  const inbox = await waitForWebhookTerminalState(payload.id, { expectedStatus })

  return { response, inbox }
}

async function findSingle(table, filters, columns = '*') {
  const attempts = 4
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await withRetries(
      `findSingle ${table}`,
      async () => {
        let query = admin.from(table).select(columns)
        for (const [key, value] of Object.entries(filters || {})) {
          query = query.eq(key, value)
        }
        return query.maybeSingle()
      }
    )

    if (!error || error.code === 'PGRST116') {
      return data || null
    }

    if (attempt < attempts && isTransientSupabaseQueryError(error.message)) {
      await sleep(300 * attempt)
      continue
    }

    throw new Error(`Failed query ${table}: ${error.message}`)
  }

  return null
}

async function findMany(table, filters, columns = '*') {
  const attempts = 4
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await withRetries(
      `findMany ${table}`,
      async () => {
        let query = admin.from(table).select(columns)
        for (const [key, value] of Object.entries(filters || {})) {
          query = query.eq(key, value)
        }
        return query
      }
    )

    if (!error) {
      return data || []
    }

    if (attempt < attempts && isTransientSupabaseQueryError(error.message)) {
      await sleep(300 * attempt)
      continue
    }

    throw new Error(`Failed query ${table}: ${error.message}`)
  }

  return []
}

function assertValidStatusTransition(previousStatus, nextStatus) {
  const prev = previousStatus || 'none'
  const allowed = VALID_TRANSITIONS[prev]
  if (!allowed) {
    return
  }

  assert.equal(
    allowed.has(nextStatus),
    true,
    `Invalid status transition: ${prev} -> ${nextStatus}`
  )
}

async function assertNoDuplicateSubscriptionRows(userId) {
  const subs = await findMany('billing_subscriptions', { user_id: userId }, 'id,provider_subscription_id,status')

  const byProvider = new Set()
  for (const sub of subs) {
    assert.equal(byProvider.has(sub.provider_subscription_id), false, `Duplicate provider_subscription_id detected: ${sub.provider_subscription_id}`)
    byProvider.add(sub.provider_subscription_id)
  }

  const activeLikeCount = subs.filter((sub) => ACTIVE_LIKE_STATUSES.has(sub.status)).length
  assert.equal(activeLikeCount <= 1, true, `Expected <=1 active-like subscription rows; got ${activeLikeCount}`)
}

function expectedPremiumFor(status, currentPeriodEnd) {
  const normalized = status || 'none'
  if (['active', 'trialing', 'subscription.active', 'subscription.paid', 'subscription.trialing', 'subscription.scheduled_cancel'].includes(normalized)) {
    return true
  }

  if (['past_due', 'unpaid', 'subscription.past_due', 'subscription.unpaid', 'canceled', 'subscription.canceled'].includes(normalized)) {
    if (!currentPeriodEnd) {
      return normalized.startsWith('subscription.') || normalized === 'past_due' || normalized === 'unpaid'
    }

    return new Date(currentPeriodEnd).getTime() > Date.now()
  }

  return false
}

async function assertEntitlementMatchesSubscription(userId) {
  const sub = await withRetries(
    `load latest subscription for entitlement ${userId}`,
    () => admin
      .from('billing_subscriptions')
      .select('status,current_period_end,last_event_created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  if (sub.error && sub.error.code !== 'PGRST116') {
    throw new Error(`Failed to load subscription for entitlement assertion: ${sub.error.message}`)
  }

  const snapshot = await findSingle('entitlement_snapshots', { user_id: userId }, 'is_premium,features_json,effective_to')
  assert.ok(snapshot, `Missing entitlement snapshot for user ${userId}`)

  const status = sub.data?.status || 'none'
  const currentPeriodEnd = sub.data?.current_period_end || null
  const expectedPremium = expectedPremiumFor(status, currentPeriodEnd)

  assert.equal(snapshot.is_premium, expectedPremium, `Entitlement mismatch for status=${status}`)

  if (expectedPremium) {
    assert.equal(snapshot.features_json?.emailReminders === true, true, 'Premium snapshot should enable emailReminders')
    assert.equal(snapshot.features_json?.csvExport === true, true, 'Premium snapshot should enable csvExport')
  } else {
    assert.equal(snapshot.features_json?.emailReminders === false, true, 'Free snapshot should disable emailReminders')
    assert.equal(snapshot.features_json?.csvExport === false, true, 'Free snapshot should disable csvExport')
  }
}

async function createActiveSubscriptionViaWebhook(userId, options = {}) {
  const eventId = options.eventId || uid('evt_active')
  const providerCustomerId = options.providerCustomerId || uid('cus')
  const providerSubscriptionId = options.providerSubscriptionId || uid('sub')
  const periodStart = options.periodStart || nowIso(-60_000)
  const periodEnd = options.periodEnd || nowIso(1000 * 60 * 60 * 24 * 30)
  const createdAt = options.createdAt || nowIso(-30_000)

  const payload = {
    id: eventId,
    type: 'subscription.active',
    created_at: createdAt,
    data: {
      object: {
        id: providerSubscriptionId,
        customer_id: providerCustomerId,
        product_id: options.productId || CREEM_MONTHLY_PRODUCT_ID,
        status: options.status || 'active',
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: options.cancelAtPeriodEnd || false,
        canceled_at: options.canceledAt || null,
        trial_end: options.trialEnd || null,
        metadata: {
          userId,
          planCode: options.planCode || 'monthly',
        },
      },
    },
  }

  const { response: webhookRes } = await sendWebhookAndAwaitProcessing(payload, { validSignature: true })
  assertWebhookAccepted(webhookRes, 'active seed webhook')

  return {
    eventId,
    providerCustomerId,
    providerSubscriptionId,
    periodStart,
    periodEnd,
  }
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), TEST_TIMEOUT_MS)
    }),
  ])
}

async function runSuite() {
  if (!SUPPORTED_LANES.has(SUBSCRIPTION_TEST_LANE)) {
    throw new Error(
      `Unsupported SUBSCRIPTION_TEST_LANE="${SUBSCRIPTION_TEST_LANE}". Expected one of: deterministic, live`
    )
  }

  if (!IS_LIVE_LANE) {
    await startMockCreemServer()
  }
  await startNextDev()

  const tests = buildTests()
  assert.equal(tests.length, 10, 'Suite must contain exactly 10 tests')

  const startedAt = new Date().toISOString()
  const results = []

  for (const test of tests) {
    const testStart = Date.now()
    let passed = false
    let actual = []
    let errorMessage = null

    try {
      actual = await withTimeout(test.run(), test.title)
      passed = true
    } catch (error) {
      passed = false
      errorMessage = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error)
    }

    const durationMs = Date.now() - testStart
    const externalTransient = !passed && IS_LIVE_LANE && isLikelyExternalTransient(errorMessage)
    results.push({
      id: test.id,
      title: test.title,
      passed,
      externalTransient,
      durationMs,
      errorMessage,
      actual,
      metadata: {
        riskAddressed: test.riskAddressed,
        setup: test.setup,
        testSteps: test.testSteps,
        expectedApiBehavior: test.expectedApiBehavior,
        expectedDatabaseMutations: test.expectedDatabaseMutations,
        expectedEntitlementAccessResult: test.expectedEntitlementAccessResult,
        expectedWebhookBehavior: test.expectedWebhookBehavior,
        cleanup: test.cleanup,
      },
    })

    const icon = passed ? 'PASS' : externalTransient ? 'WARN' : 'FAIL'
    console.log(`[${icon}] ${test.id} ${test.title} (${durationMs}ms)`)
    if (!passed) {
      console.error(errorMessage)
    }
  }

  const finishedAt = new Date().toISOString()
  await writeReport({ startedAt, finishedAt, results })

  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  const transientFailures = results.filter((r) => !r.passed && r.externalTransient).length
  const hardFailures = results.filter((r) => !r.passed && !r.externalTransient).length
  console.log(
    `\nSuite summary [lane=${SUBSCRIPTION_TEST_LANE}]: ${passedCount}/${results.length} passed, ${failedCount} failed (${hardFailures} hard, ${transientFailures} external transient)`
  )

  if (hardFailures > 0) {
    process.exitCode = 1
    return
  }

  if (!IS_LIVE_LANE && failedCount > 0) {
    process.exitCode = 1
  }
}

function buildTests() {
  return [
    {
      id: 'T01',
      title: 'Successful subscription creation (checkout + active webhook)',
      riskAddressed: 'Revenue loss when checkout succeeds but subscription state is never activated.',
      setup: [
        'Create a clean user account with no prior billing rows.',
        'Use local mock Creem API for checkout session creation.',
      ],
      testSteps: [
        'POST /api/billing/checkout with monthly plan using authenticated session.',
        'POST signed subscription.active webhook for same user/customer/subscription.',
        'GET /api/billing/status as the same user.',
      ],
      expectedApiBehavior: [
        'Checkout returns 200 with success=true and trusted creem.io URL.',
        'Webhook returns 200 with accepted=true.',
        'Billing status returns subscriptionStatus=active and isPremium=true.',
      ],
      expectedDatabaseMutations: [
        'Exactly one billing_customers row linked to user.',
        'Exactly one billing_subscriptions row for provider_subscription_id.',
        'Webhook inbox row persisted as processed.',
        'Invoice/payment IDs from payload are preserved in webhook payload JSON.',
      ],
      expectedEntitlementAccessResult: 'Premium features enabled and contract limit is unrestricted.',
      expectedWebhookBehavior: 'Event is accepted, processed once, and audit trail records applied event.',
      cleanup: ['Delete test user (cascade billing rows), leave immutable webhook inbox for traceability.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t01')

        try {
          const checkout = await apiJson('/api/billing/checkout', {
            method: 'POST',
            sessionCookie: user.cookie,
            headers: {
              'x-request-id': uid('req_checkout_success'),
            },
            body: { planCode: 'monthly' },
          })

          assert.equal(checkout.status, 200)
          assert.equal(checkout.json?.success, true)
          assert.equal(typeof checkout.json?.data?.checkoutUrl, 'string')
          assert.equal(checkout.json.data.checkoutUrl.includes('creem.io'), true)
          ensureNoSensitiveDataInJsonString(checkout.text, 'checkout response')

          const eventId = uid('evt_t01')
          const subscriptionId = uid('sub_t01')
          const customerId = uid('cus_t01')
          const invoiceId = uid('inv_t01')
          const paymentId = uid('pay_t01')

          const webhookPayload = {
            id: eventId,
            type: 'subscription.active',
            created_at: nowIso(),
            data: {
              object: {
                id: subscriptionId,
                customer_id: customerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-60_000),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 30),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
                invoice: {
                  id: invoiceId,
                },
                payment: {
                  id: paymentId,
                  amount: 1900,
                  currency: 'USD',
                },
              },
            },
          }

          const { response: webhook } = await sendWebhookAndAwaitProcessing(webhookPayload, {
            validSignature: true,
          })
          assertWebhookAccepted(webhook, `webhook ${eventId}`)

          const customer = await findSingle('billing_customers', { user_id: user.userId }, 'provider_customer_id,user_id')
          assert.ok(customer)
          assert.equal(customer.user_id, user.userId)
          assert.equal(customer.provider_customer_id, customerId)

          const sub = await findSingle('billing_subscriptions', { provider_subscription_id: subscriptionId }, '*')
          assert.ok(sub)
          assert.equal(sub.user_id, user.userId)
          assert.equal(sub.plan_code, 'monthly')
          assert.equal(sub.status, 'active')

          const inbox = await findSingle('billing_webhook_inbox', { provider_event_id: eventId }, '*')
          assert.ok(inbox)
          assert.equal(inbox.processing_status, 'processed')
          assert.equal(inbox.signature_valid, true)
          assert.equal(inbox.payload_json?.data?.object?.invoice?.id, invoiceId)
          assert.equal(inbox.payload_json?.data?.object?.payment?.id, paymentId)

          const status = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(status.status, 200)
          assert.equal(status.json?.success, true)
          assert.equal(status.json?.data?.subscriptionStatus, 'active')
          assert.equal(status.json?.data?.isPremium, true)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Checkout API returned trusted checkout URL and request metadata.')
          actual.push('Active webhook created customer + subscription linkage and processed inbox row.')
          actual.push('Billing status API and entitlement snapshot both reflect premium active state.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T02',
      title: 'Failed initial payment marks subscription unpaid and revokes entitlement',
      riskAddressed: 'Revenue leakage from granting premium access when first invoice payment fails.',
      setup: [
        'Create new user with no existing billing rows.',
        'Use checkout API then simulate failed payment webhook.',
      ],
      testSteps: [
        'POST /api/billing/checkout monthly.',
        'POST signed subscription.unpaid webhook with period end in the past.',
        'GET /api/billing/status for same user.',
      ],
      expectedApiBehavior: [
        'Checkout returns 200.',
        'Webhook returns 200 accepted.',
        'Status API returns subscriptionStatus=unpaid and isPremium=false.',
      ],
      expectedDatabaseMutations: [
        'Single billing subscription row persists with status unpaid.',
        'No duplicate subscriptions for same user/provider subscription.',
      ],
      expectedEntitlementAccessResult: 'Premium features disabled after failed initial payment with expired period.',
      expectedWebhookBehavior: 'Failed-payment event is processed and recorded once in inbox/audit logs.',
      cleanup: ['Delete user and dependent billing records.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t02')

        try {
          const checkout = await apiJson('/api/billing/checkout', {
            method: 'POST',
            sessionCookie: user.cookie,
            body: { planCode: 'monthly' },
          })

          assert.equal(checkout.status, 200)

          const eventId = uid('evt_t02')
          const subId = uid('sub_t02')
          const customerId = uid('cus_t02')

          const { response: unpaid } = await sendWebhookAndAwaitProcessing({
            id: eventId,
            type: 'subscription.unpaid',
            created_at: nowIso(),
            data: {
              object: {
                id: subId,
                customer_id: customerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'unpaid',
                current_period_start: nowIso(-1000 * 60 * 60 * 24 * 14),
                current_period_end: nowIso(-1000 * 60 * 60),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(unpaid, `webhook ${eventId}`)

          const sub = await findSingle('billing_subscriptions', { provider_subscription_id: subId }, '*')
          assert.ok(sub)
          assertValidStatusTransition(null, sub.status)
          assert.equal(sub.status, 'unpaid')

          const status = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(status.status, 200)
          assert.equal(status.json?.data?.subscriptionStatus, 'unpaid')
          assert.equal(status.json?.data?.isPremium, false)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Failed initial-payment webhook persisted unpaid status.')
          actual.push('Entitlements were revoked (premium=false) after expired unpaid state.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T03',
      title: 'Trial start and trial expiration transition correctly',
      riskAddressed: 'Broken trial lifecycle causing unauthorized premium access after trial expiry.',
      setup: [
        'Create a user and issue trialing webhook event.',
      ],
      testSteps: [
        'POST subscription.trialing webhook with future trial_end/current_period_end.',
        'Verify status API returns trialing + premium access.',
        'POST subscription.expired webhook with later event timestamp.',
        'Verify status API returns expired + no premium access.',
      ],
      expectedApiBehavior: [
        'Both webhooks accepted with 200.',
        'Status API follows latest event state.',
      ],
      expectedDatabaseMutations: [
        'Single subscription row updated in place (no duplicate row).',
        'last_event_id and timestamps move forward to expiration event.',
      ],
      expectedEntitlementAccessResult: 'Premium true during trialing, false after expiration.',
      expectedWebhookBehavior: 'Trial and expiry events processed in chronological order.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t03')

        try {
          const subId = uid('sub_t03')
          const customerId = uid('cus_t03')

          const trialEventAt = nowIso(-1000 * 60 * 15)
          const expiredEventAt = nowIso(-1000 * 60)

          const trialEventId = uid('evt_t03_trial')
          const { response: trialWebhook } = await sendWebhookAndAwaitProcessing({
            id: trialEventId,
            type: 'subscription.trialing',
            created_at: trialEventAt,
            data: {
              object: {
                id: subId,
                customer_id: customerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'trialing',
                current_period_start: nowIso(-1000 * 60 * 60),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 7),
                trial_end: nowIso(1000 * 60 * 60 * 24 * 7),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(trialWebhook, `webhook ${trialEventId}`)

          const statusDuringTrial = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(statusDuringTrial.status, 200)
          assert.equal(statusDuringTrial.json?.data?.subscriptionStatus, 'trialing')
          assert.equal(statusDuringTrial.json?.data?.isPremium, true)

          const expiryEventId = uid('evt_t03_expired')
          const { response: expiryWebhook } = await sendWebhookAndAwaitProcessing({
            id: expiryEventId,
            type: 'subscription.expired',
            created_at: expiredEventAt,
            data: {
              object: {
                id: subId,
                customer_id: customerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'expired',
                current_period_start: nowIso(-1000 * 60 * 60 * 24 * 14),
                current_period_end: nowIso(-1000 * 60 * 60),
                trial_end: nowIso(-1000 * 60 * 60),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(expiryWebhook, `webhook ${expiryEventId}`)

          const sub = await findSingle('billing_subscriptions', { provider_subscription_id: subId }, '*')
          assert.ok(sub)
          assertValidStatusTransition('trialing', sub.status)
          assert.equal(sub.status, 'expired')
          assert.equal(new Date(sub.last_event_created_at).getTime() >= new Date(expiredEventAt).getTime(), true)

          const statusAfterExpiry = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(statusAfterExpiry.status, 200)
          assert.equal(statusAfterExpiry.json?.data?.subscriptionStatus, 'expired')
          assert.equal(statusAfterExpiry.json?.data?.isPremium, false)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Trial start granted premium access as expected.')
          actual.push('Trial expiration revoked premium access and preserved single subscription row.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T04',
      title: 'Successful renewal extends current period without duplicate subscription',
      riskAddressed: 'Renewal events creating duplicate subscriptions or failing to extend entitlement window.',
      setup: [
        'Create active monthly subscription through webhook seed event.',
      ],
      testSteps: [
        'POST subscription.paid renewal event with later period boundaries and invoice/payment IDs.',
        'Verify subscription row updated in place and period_end advanced.',
      ],
      expectedApiBehavior: ['Webhook accepted with 200/202 and status API remains active.'],
      expectedDatabaseMutations: [
        'Same provider_subscription_id row receives updated period dates.',
        'Webhook payload retains invoice/payment references for reconciliation.',
      ],
      expectedEntitlementAccessResult: 'Premium remains enabled with new effective period end.',
      expectedWebhookBehavior: 'Renewal event applied exactly once and inbox row processed.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t04')

        try {
          const seeded = await createActiveSubscriptionViaWebhook(user.userId, {
            periodEnd: nowIso(1000 * 60 * 60 * 24 * 5),
          })

          const pre = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(pre)

          const renewalEventId = uid('evt_t04_renew')
          const renewalEnd = nowIso(1000 * 60 * 60 * 24 * 35)
          const invoiceId = uid('inv_t04')
          const paymentId = uid('pay_t04')

          const { response: renewalWebhook } = await sendWebhookAndAwaitProcessing({
            id: renewalEventId,
            type: 'subscription.paid',
            created_at: nowIso(),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-1000 * 60 * 5),
                current_period_end: renewalEnd,
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
                invoice: { id: invoiceId },
                payment: { id: paymentId, amount: 1900 },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(renewalWebhook, `webhook ${renewalEventId}`)

          const post = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(post)
          assertValidStatusTransition(pre.status, post.status)
          assert.equal(post.status, 'active')
          assert.equal(new Date(post.current_period_end).getTime() > new Date(pre.current_period_end).getTime(), true)

          const inbox = await findSingle('billing_webhook_inbox', { provider_event_id: renewalEventId }, '*')
          assert.ok(inbox)
          assert.equal(inbox.payload_json?.data?.object?.invoice?.id, invoiceId)
          assert.equal(inbox.payload_json?.data?.object?.payment?.id, paymentId)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Renewal advanced billing period on existing subscription record.')
          actual.push('Invoice/payment identifiers persisted in webhook inbox payload for reconciliation.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T05',
      title: 'Failed renewal enters past_due (dunning) while preserving grace access',
      riskAddressed: 'Incorrect dunning behavior causing premature lockout or uncontrolled free access.',
      setup: ['Create active subscription with current period still in the future.'],
      testSteps: [
        'POST subscription.past_due webhook with current_period_end still in future.',
        'GET billing status to confirm user sees past_due.',
      ],
      expectedApiBehavior: [
        'Webhook returns 200/202 accepted.',
        'Status API returns subscriptionStatus=past_due.',
      ],
      expectedDatabaseMutations: [
        'Subscription status transitions active -> past_due without duplicate rows.',
      ],
      expectedEntitlementAccessResult: 'Premium remains true during current paid period grace window.',
      expectedWebhookBehavior: 'Past_due event applied and logged once.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t05')

        try {
          const seeded = await createActiveSubscriptionViaWebhook(user.userId, {
            periodEnd: nowIso(1000 * 60 * 60 * 24 * 3),
          })

          const before = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(before)

          const pastDueEventId = uid('evt_t05_past_due')
          const { response: webhook } = await sendWebhookAndAwaitProcessing({
            id: pastDueEventId,
            type: 'subscription.past_due',
            created_at: nowIso(),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'past_due',
                current_period_start: before.current_period_start,
                current_period_end: before.current_period_end,
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(webhook, `webhook ${pastDueEventId}`)

          const after = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(after)
          assertValidStatusTransition(before.status, after.status)
          assert.equal(after.status, 'past_due')

          const status = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(status.status, 200)
          assert.equal(status.json?.data?.subscriptionStatus, 'past_due')
          assert.equal(status.json?.data?.isPremium, true)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Renewal failure placed subscription into past_due dunning state.')
          actual.push('Entitlement remained premium while current_period_end is still in the future.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T06',
      title: 'Cancellation behavior: scheduled cancel then final cancellation',
      riskAddressed: 'Access control drift during cancellation lifecycle (too early or too late revocation).',
      setup: ['Create active subscription first.'],
      testSteps: [
        'POST scheduled-cancel webhook (cancel_at_period_end=true).',
        'POST cancellation webhook with period already ended.',
        'Read billing status after final cancellation.',
      ],
      expectedApiBehavior: [
        'Both webhook deliveries accepted.',
        'Status API returns canceled in final state.',
      ],
      expectedDatabaseMutations: [
        'Single subscription row tracks cancel flags and canceled_at timestamp.',
      ],
      expectedEntitlementAccessResult: 'Premium true until period end, then false once canceled period is over.',
      expectedWebhookBehavior: 'Sequential cancellation events processed in order by event timestamp.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t06')

        try {
          const seeded = await createActiveSubscriptionViaWebhook(user.userId, {
            periodEnd: nowIso(1000 * 60 * 60 * 24 * 2),
          })

          const scheduledEventId = uid('evt_t06_sched')
          const { response: scheduled } = await sendWebhookAndAwaitProcessing({
            id: scheduledEventId,
            type: 'subscription.scheduled_cancel',
            created_at: nowIso(-1000 * 20),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'subscription.scheduled_cancel',
                current_period_start: nowIso(-1000 * 60 * 60 * 24 * 5),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 2),
                cancel_at_period_end: true,
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(scheduled, `webhook ${scheduledEventId}`)

          const scheduledSub = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(scheduledSub)
          assert.equal(scheduledSub.cancel_at_period_end, true)
          assert.equal(scheduledSub.status, 'subscription.scheduled_cancel')

          const canceledAt = nowIso(-1000 * 30)
          const cancelEventId = uid('evt_t06_cancel')
          const { response: canceledWebhook } = await sendWebhookAndAwaitProcessing({
            id: cancelEventId,
            type: 'subscription.canceled',
            created_at: nowIso(),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'canceled',
                current_period_start: nowIso(-1000 * 60 * 60 * 24 * 30),
                current_period_end: nowIso(-1000 * 60 * 60),
                cancel_at_period_end: false,
                canceled_at: canceledAt,
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })

          assertWebhookAccepted(canceledWebhook, `webhook ${cancelEventId}`)

          const finalSub = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(finalSub)
          assertValidStatusTransition('subscription.scheduled_cancel', finalSub.status)
          assert.equal(finalSub.status, 'canceled')
          assert.ok(finalSub.canceled_at)

          const status = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })

          assert.equal(status.status, 200)
          assert.equal(status.json?.data?.subscriptionStatus, 'canceled')
          assert.equal(status.json?.data?.isPremium, false)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Scheduled cancellation set cancel_at_period_end=true and kept record consistent.')
          actual.push('Final cancellation after period end revoked premium access.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T07',
      title: 'Plan upgrade and downgrade update plan linkage without extra subscription rows',
      riskAddressed: 'Plan changes creating duplicate subscriptions or stale entitlements.',
      setup: ['Seed active monthly subscription.'],
      testSteps: [
        'POST upgrade event to yearly plan/product.',
        'POST downgrade event back to monthly.',
        'Verify single subscription row reflects latest plan code/product.',
      ],
      expectedApiBehavior: ['Both events accepted.', 'Status API remains premium/active.'],
      expectedDatabaseMutations: [
        'plan_code/product_id are updated in place on same provider_subscription_id.',
        'No additional subscription rows are created for the user.',
      ],
      expectedEntitlementAccessResult: 'Premium remains true throughout plan transitions.',
      expectedWebhookBehavior: 'Upgrade/downgrade events applied in event_created_at order.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t07')

        try {
          const seeded = await createActiveSubscriptionViaWebhook(user.userId, {
            planCode: 'monthly',
            productId: CREEM_MONTHLY_PRODUCT_ID,
          })

          const upgradeEventId = uid('evt_t07_upgrade')
          const { response: upgrade } = await sendWebhookAndAwaitProcessing({
            id: upgradeEventId,
            type: 'subscription.paid',
            created_at: nowIso(-1000 * 20),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_YEARLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-1000 * 60),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 365),
                metadata: {
                  userId: user.userId,
                  planCode: 'yearly',
                },
              },
            },
          }, { validSignature: true })
          assertWebhookAccepted(upgrade, `webhook ${upgradeEventId}`)

          let sub = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(sub)
          assert.equal(sub.plan_code, 'yearly')
          assert.equal(sub.product_id, CREEM_YEARLY_PRODUCT_ID)

          const downgradeEventId = uid('evt_t07_downgrade')
          const { response: downgrade } = await sendWebhookAndAwaitProcessing({
            id: downgradeEventId,
            type: 'subscription.paid',
            created_at: nowIso(),
            data: {
              object: {
                id: seeded.providerSubscriptionId,
                customer_id: seeded.providerCustomerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-1000 * 60),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 30),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }, { validSignature: true })
          assertWebhookAccepted(downgrade, `webhook ${downgradeEventId}`)

          sub = await findSingle('billing_subscriptions', { provider_subscription_id: seeded.providerSubscriptionId }, '*')
          assert.ok(sub)
          assert.equal(sub.plan_code, 'monthly')
          assert.equal(sub.product_id, CREEM_MONTHLY_PRODUCT_ID)

          const status = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: user.cookie,
          })
          assert.equal(status.status, 200)
          assert.equal(status.json?.data?.isPremium, true)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Upgrade changed plan_code/product_id to yearly on existing row.')
          actual.push('Downgrade reverted plan mapping without creating extra subscriptions.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T08',
      title: 'Webhook signature validation rejects invalid signatures',
      riskAddressed: 'Unauthorized webhook forgery mutating billing state.',
      setup: [
        'Prepare payload containing fake sensitive card fields to test non-exposure on rejection.',
      ],
      testSteps: [
        'POST webhook with invalid signature header.',
        'Verify API rejection and zero DB mutation for that event/subscription.',
      ],
      expectedApiBehavior: ['Returns 401 with Invalid webhook signature error and no sensitive echo.'],
      expectedDatabaseMutations: [
        'No billing_webhook_inbox row for rejected event id.',
        'No subscription row created from rejected payload.',
      ],
      expectedEntitlementAccessResult: 'No entitlement change because event is rejected.',
      expectedWebhookBehavior: 'Rejected before persistence/processing stage.',
      cleanup: ['Delete user if created.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t08')

        try {
          const eventId = uid('evt_t08_invalid_sig')
          const subId = uid('sub_t08_invalid_sig')

          const payload = {
            id: eventId,
            type: 'subscription.active',
            created_at: nowIso(),
            data: {
              object: {
                id: subId,
                customer_id: uid('cus_t08'),
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-1000 * 60),
                current_period_end: nowIso(1000 * 60 * 60),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
                card_number: '4242424242424242',
                cvv: '123',
              },
            },
          }

          const res = await sendWebhook(payload, { validSignature: false })
          assert.equal(res.status, 401)
          assert.equal(res.json?.success, false)
          assert.equal(typeof res.json?.error, 'string')
          assert.equal(res.json.error.toLowerCase().includes('invalid webhook signature'), true)
          ensureNoSensitiveDataInJsonString(res.text, 'invalid-signature response')

          const inbox = await findSingle('billing_webhook_inbox', { provider_event_id: eventId }, '*')
          assert.equal(inbox, null)

          const sub = await findSingle('billing_subscriptions', { provider_subscription_id: subId }, '*')
          assert.equal(sub, null)

          const audits = await findMany('billing_audit_logs', { provider_event_id: eventId }, '*')
          assert.equal(audits.length, 0)

          actual.push('Invalid webhook signature was rejected with 401 before persistence.')
          actual.push('Sensitive card fields were not echoed in API response and no billing state changed.')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T09',
      title: 'Webhook idempotency prevents duplicate event application',
      riskAddressed: 'Duplicate billing mutations causing double grants/duplicate billing state changes.',
      setup: ['Create clean user and craft one valid active event id.'],
      testSteps: [
        'POST signed webhook event once.',
        'POST same event id a second time (duplicate delivery).',
        'Verify duplicate path reports duplicate and DB mutation not re-applied.',
      ],
      expectedApiBehavior: [
        'First delivery returns accepted=true.',
        'Second delivery returns duplicate=true with 200.',
      ],
      expectedDatabaseMutations: [
        'Exactly one inbox row for provider_event_id.',
        'Exactly one subscription_event_applied audit entry for event id.',
      ],
      expectedEntitlementAccessResult: 'Entitlement stays correct and is not re-mutated by replay.',
      expectedWebhookBehavior: 'Duplicate delivery handled idempotently and not applied twice.',
      cleanup: ['Delete user.'],
      run: async () => {
        const actual = []
        const user = await createTestUser('sub-t09')

        try {
          const eventId = uid('evt_t09_dup')
          const subId = uid('sub_t09_dup')
          const customerId = uid('cus_t09_dup')

          const payload = {
            id: eventId,
            type: 'subscription.active',
            created_at: nowIso(),
            data: {
              object: {
                id: subId,
                customer_id: customerId,
                product_id: CREEM_MONTHLY_PRODUCT_ID,
                status: 'active',
                current_period_start: nowIso(-1000 * 60),
                current_period_end: nowIso(1000 * 60 * 60 * 24 * 30),
                metadata: {
                  userId: user.userId,
                  planCode: 'monthly',
                },
              },
            },
          }

          const { response: first } = await sendWebhookAndAwaitProcessing(payload, {
            validSignature: true,
          })
          assertWebhookAccepted(first, `webhook ${eventId}`)

          const second = await sendWebhook(payload, { validSignature: true })
          assertWebhookAccepted(second, `duplicate webhook ${eventId}`)
          assert.equal(second.json?.duplicate, true)

          const inboxRows = await findMany('billing_webhook_inbox', { provider_event_id: eventId }, '*')
          assert.equal(inboxRows.length, 1)
          assert.equal(inboxRows[0].processing_status, 'processed')

          const appliedAudits = await withRetries(
            `load applied audits for ${eventId}`,
            () => admin
              .from('billing_audit_logs')
              .select('id,action,provider_event_id')
              .eq('provider_event_id', eventId)
              .eq('action', 'subscription_event_applied')
          )

          if (appliedAudits.error) {
            throw new Error(appliedAudits.error.message)
          }

          assert.equal((appliedAudits.data || []).length, 1)

          const subs = await findMany('billing_subscriptions', { user_id: user.userId }, '*')
          assert.equal(subs.length, 1)

          await assertNoDuplicateSubscriptionRows(user.userId)
          await assertEntitlementMatchesSubscription(user.userId)

          actual.push('Duplicate webhook delivery returned duplicate=true on second attempt.')
          actual.push('Event was applied exactly once (single inbox row and single applied audit log).')

          return actual
        } finally {
          await deleteTestUser(user.userId)
        }
      },
    },
    {
      id: 'T10',
      title: 'Cross-user authorization and tenant isolation for subscription data',
      riskAddressed: 'Unauthorized access/mutation across tenant boundaries.',
      setup: [
        'Create User A and User B.',
        'Create active subscription for User A only.',
      ],
      testSteps: [
        'GET /api/billing/status as User B.',
        'Attempt direct RLS query as User B for User A subscription rows.',
        'POST /api/billing/portal as User B (should not get User A portal).',
      ],
      expectedApiBehavior: [
        'User B status response does not expose User A plan/subscription.',
        'Portal request for User B returns 404 (no customer mapping).',
      ],
      expectedDatabaseMutations: [
        'No cross-tenant mutation in User A subscription state caused by User B actions.',
        'RLS query by User B returns zero rows for User A user_id filter.',
      ],
      expectedEntitlementAccessResult: 'User A remains premium; User B remains free.',
      expectedWebhookBehavior: 'N/A (no webhook event replay in this test).',
      cleanup: ['Delete both users.'],
      run: async () => {
        const actual = []
        const userA = await createTestUser('sub-t10-a')
        const userB = await createTestUser('sub-t10-b')

        try {
          await createActiveSubscriptionViaWebhook(userA.userId, {
            planCode: 'monthly',
            productId: CREEM_MONTHLY_PRODUCT_ID,
          })

          const statusA = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: userA.cookie,
          })
          assert.equal(statusA.status, 200)
          assert.equal(statusA.json?.data?.isPremium, true)

          const statusB = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: userB.cookie,
          })
          assert.equal(statusB.status, 200)
          assert.equal(statusB.json?.data?.planCode, null)
          assert.equal(statusB.json?.data?.subscriptionStatus, 'none')
          assert.equal(statusB.json?.data?.isPremium, false)

          const userBClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              headers: {
                Authorization: `Bearer ${userB.accessToken}`,
              },
            },
          })

          const bQuery = await withRetries(
            `user B RLS query against user A ${userA.userId}`,
            () => userBClient
              .from('billing_subscriptions')
              .select('id,user_id,status')
              .eq('user_id', userA.userId)
          )

          assert.equal(Boolean(bQuery.error), false, bQuery.error?.message || 'Unexpected RLS query error')
          assert.equal((bQuery.data || []).length, 0)

          const portalB = await apiJson('/api/billing/portal', {
            method: 'POST',
            sessionCookie: userB.cookie,
            body: {},
          })

          assert.equal(portalB.status, 404)
          assert.equal(portalB.json?.success, false)
          assert.equal(String(portalB.json?.error || '').toLowerCase().includes('no billing customer'), true)

          const statusAAfter = await apiJson('/api/billing/status', {
            method: 'GET',
            sessionCookie: userA.cookie,
          })

          assert.equal(statusAAfter.status, 200)
          assert.equal(statusAAfter.json?.data?.isPremium, true)

          ensureNoSensitiveDataInJsonString(statusB.text, 'user B status response')
          ensureNoSensitiveDataInJsonString(portalB.text, 'user B portal response')

          await assertNoDuplicateSubscriptionRows(userA.userId)
          await assertEntitlementMatchesSubscription(userA.userId)

          actual.push('User B could not read or infer User A subscription state via API.')
          actual.push('RLS blocked direct table access to User A billing rows from User B token.')
          actual.push('User B portal access did not cross into User A customer mapping.')

          return actual
        } finally {
          await deleteTestUser(userA.userId)
          await deleteTestUser(userB.userId)
        }
      },
    },
  ]
}

async function writeReport({ startedAt, finishedAt, results }) {
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const transientFailures = results.filter((r) => !r.passed && r.externalTransient).length
  const hardFailures = results.filter((r) => !r.passed && !r.externalTransient).length

  const lines = []
  lines.push('# Subscription Production-Safety Test Report')
  lines.push('')
  lines.push(`- Lane: ${SUBSCRIPTION_TEST_LANE}`)
  lines.push(`- Started: ${startedAt}`)
  lines.push(`- Finished: ${finishedAt}`)
  lines.push(`- Total tests: ${results.length}`)
  lines.push(`- Passed: ${passed}`)
  lines.push(`- Failed: ${failed}`)
  lines.push(`- Hard failures: ${hardFailures}`)
  lines.push(`- External transient failures: ${transientFailures}`)
  lines.push('')

  for (const result of results) {
    lines.push(`## ${result.id} - ${result.title}`)
    lines.push('')
    lines.push(`- Result: ${result.passed ? 'PASS' : result.externalTransient ? 'WARN (external transient)' : 'FAIL'}`)
    lines.push(`- Duration: ${result.durationMs}ms`)
    lines.push(`- Risk addressed: ${result.metadata.riskAddressed}`)
    lines.push('')

    lines.push('### Setup')
    for (const item of result.metadata.setup) {
      lines.push(`- ${item}`)
    }

    lines.push('')
    lines.push('### Test Steps')
    for (const item of result.metadata.testSteps) {
      lines.push(`- ${item}`)
    }

    lines.push('')
    lines.push('### Expected API Behavior')
    for (const item of result.metadata.expectedApiBehavior) {
      lines.push(`- ${item}`)
    }

    lines.push('')
    lines.push('### Expected Database Mutations')
    for (const item of result.metadata.expectedDatabaseMutations) {
      lines.push(`- ${item}`)
    }

    lines.push('')
    lines.push('### Expected Entitlement/Access Result')
    lines.push(`- ${result.metadata.expectedEntitlementAccessResult}`)

    lines.push('')
    lines.push('### Expected Webhook Behavior')
    lines.push(`- ${result.metadata.expectedWebhookBehavior}`)

    lines.push('')
    lines.push('### Cleanup')
    for (const item of result.metadata.cleanup) {
      lines.push(`- ${item}`)
    }

    lines.push('')
    lines.push('### Actual Observations')
    if (Array.isArray(result.actual) && result.actual.length > 0) {
      for (const item of result.actual) {
        lines.push(`- ${item}`)
      }
    } else {
      lines.push('- (No observation notes recorded)')
    }

    if (!result.passed) {
      lines.push('')
      lines.push('### Failure Details')
      lines.push('```text')
      lines.push(result.errorMessage || 'Unknown error')
      lines.push('```')
    }

    lines.push('')
  }

  await fs.mkdir('test-results', { recursive: true })
  await fs.writeFile('test-results/subscription-production-safety-report.md', lines.join('\n'), 'utf8')
  await fs.writeFile('test-results/subscription-production-safety-report.json', JSON.stringify({ startedAt, finishedAt, results }, null, 2), 'utf8')
}

async function main() {
  try {
    await runSuite()
  } finally {
    await cleanupAllUsers()
    await stopNextDev()
    await stopMockCreemServer()
  }
}

main().catch(async (error) => {
  console.error(error)
  process.exitCode = 1

  await cleanupAllUsers().catch(() => undefined)
  await stopNextDev().catch(() => undefined)
  await stopMockCreemServer().catch(() => undefined)
})
