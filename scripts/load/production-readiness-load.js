/* eslint-disable no-console */

require('../load-env')

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { spawn, execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { performance } = require('node:perf_hooks')
const { createClient } = require('@supabase/supabase-js')

const execFileAsync = promisify(execFile)

const APP_HOST = '127.0.0.1'
const APP_PORT = Number(process.env.LOAD_TEST_APP_PORT || 3100)
const APP_URL = `http://${APP_HOST}:${APP_PORT}`
const LOAD_TEST_APP_MODE = (process.env.LOAD_TEST_APP_MODE || 'production').trim().toLowerCase()
const MOCK_CREEM_PORT = Number(process.env.LOAD_TEST_CREEM_PORT || 4110)
const MOCK_CREEM_URL = `http://${APP_HOST}:${MOCK_CREEM_PORT}`
const TEST_TIMEOUT_MS = Number(process.env.LOAD_TEST_TIMEOUT_MS || 180_000)
const RUN_SOAK = process.env.LOAD_TEST_RUN_SOAK !== '0'
const LOAD_TEST_ONLY_CAPACITY = process.env.LOAD_TEST_ONLY_CAPACITY === '1'
const LOAD_TEST_MAX_CONCURRENCY_RAW = Number(process.env.LOAD_TEST_MAX_CONCURRENCY || 50)
const SOAK_DURATION_MS = Number(process.env.LOAD_TEST_SOAK_DURATION_MS || 3_600_000)
const SOAK_CONCURRENCY = Number(process.env.LOAD_TEST_SOAK_CONCURRENCY || 50)
const SOAK_SMOKE_DURATION_MS = Number(process.env.LOAD_TEST_SOAK_SMOKE_DURATION_MS || 120_000)
const CAPACITY_STAGE_DURATION_MS = Number(process.env.LOAD_TEST_CAPACITY_STAGE_DURATION_MS || 15_000)
const DB_DIAGNOSTIC_POLL_MS = Number(process.env.LOAD_TEST_DB_DIAGNOSTIC_POLL_MS || 10_000)
const DB_DIAGNOSTIC_CLAIM_TIMEOUT_SECONDS = Number(
  process.env.LOAD_TEST_DIAGNOSTIC_CLAIM_TIMEOUT_SECONDS || 900
)

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const CREEM_WEBHOOK_SECRET = requiredEnv('CREEM_WEBHOOK_SECRET')
const CRON_SECRET = requiredEnv('CRON_SECRET')

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const COOKIE_KEY = `sb-${PROJECT_REF}-auth-token`

const createdUserIds = new Set()
const createdSignupUserIds = new Set()
const sessionRefreshInFlight = new Map()

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let nextDevProcess = null
let mockCreemServer = null
const mockState = {
  mode: 'normal',
  checkouts: 0,
  portals: 0,
  products: 0,
}

const report = {
  generatedAt: new Date().toISOString(),
  appUrl: APP_URL,
  scenarios: [],
  setup: {},
  teardown: {},
  notes: [],
}

const SESSION_REFRESH_MAX_AGE_MS = Number(
  process.env.LOAD_TEST_SESSION_REFRESH_MAX_AGE_MS || 180_000
)

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.trunc(value)
  return Math.max(min, Math.min(max, normalized))
}

function isTransientSupabaseErrorMessage(message) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('connect timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('eai_again')
  )
}

function getMaxScenarioConcurrency() {
  return clampNumber(LOAD_TEST_MAX_CONCURRENCY_RAW, 1, 5000, 50)
}

function parseCapacityStages(maxScenarioConcurrency) {
  const defaultStages = [10, 20, 30, 40, 50]
  const configured = (process.env.LOAD_TEST_CAPACITY_STAGES || '')
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)

  const baseStages = configured.length > 0 ? configured : defaultStages
  const deduped = Array.from(new Set(baseStages.map((value) => Math.trunc(value))))
  const capped = deduped
    .filter((value) => value <= maxScenarioConcurrency)
    .sort((left, right) => left - right)

  if (capped.length > 0) {
    return capped
  }

  return defaultStages.filter((value) => value <= maxScenarioConcurrency)
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createAuthCookie(session) {
  return `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(session))}`
}

function createWebhookSignature(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${rawBody}`
  const digest = crypto
    .createHmac('sha256', CREEM_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex')
  return `t=${timestamp},v1=${digest}`
}

function summarizeLatencies(latencies) {
  if (latencies.length === 0) {
    return { p50: null, p95: null, p99: null, min: null, max: null, avg: null }
  }

  const sorted = [...latencies].sort((a, b) => a - b)

  const percentile = (p) => {
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    )
    return Number(sorted[index].toFixed(2))
  }

  const sum = sorted.reduce((total, value) => total + value, 0)

  return {
    min: Number(sorted[0].toFixed(2)),
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
  }
}

function summarizeOperationStats(operationStats) {
  const summary = {}
  for (const [operation, stats] of Object.entries(operationStats)) {
    const requests = Math.max(0, Math.trunc(stats.requests || 0))
    const errors = Math.max(0, Math.trunc(stats.errors || 0))
    const successes = Math.max(0, Math.trunc(stats.successes || 0))
    const errorRate = requests > 0 ? (errors / requests) * 100 : 0

    summary[operation] = {
      requests,
      successes,
      errors,
      errorRate: Number(errorRate.toFixed(2)),
      statusCounts: stats.statusCounts || {},
      errorTypes: stats.errorTypes || {},
      latencyMs: summarizeLatencies(stats.latencies || []),
    }
  }

  return summary
}

function startResourceSampler(pid) {
  let running = true
  const samples = []

  async function sampleLoop() {
    while (running) {
      try {
        const { stdout } = await execFileAsync('ps', ['-o', '%cpu=,rss=', '-p', String(pid)])
        const line = stdout
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean)[0]

        if (line) {
          const [cpuRaw, rssRaw] = line.split(/\s+/)
          const cpu = Number.parseFloat(cpuRaw)
          const rssKb = Number.parseFloat(rssRaw)
          if (Number.isFinite(cpu) && Number.isFinite(rssKb)) {
            samples.push({ cpu, rssMb: rssKb / 1024 })
          }
        }
      } catch {
        // ignore transient sampling failures
      }

      await sleep(1000)
    }
  }

  const loopPromise = sampleLoop()

  return {
    async stop() {
      running = false
      await loopPromise

      if (samples.length === 0) {
        return {
          sampleCount: 0,
          maxCpuPercent: null,
          avgCpuPercent: null,
          maxRssMb: null,
          avgRssMb: null,
        }
      }

      const maxCpu = Math.max(...samples.map((sample) => sample.cpu))
      const maxRss = Math.max(...samples.map((sample) => sample.rssMb))
      const avgCpu =
        samples.reduce((total, sample) => total + sample.cpu, 0) / samples.length
      const avgRss =
        samples.reduce((total, sample) => total + sample.rssMb, 0) / samples.length

      return {
        sampleCount: samples.length,
        maxCpuPercent: Number(maxCpu.toFixed(2)),
        avgCpuPercent: Number(avgCpu.toFixed(2)),
        maxRssMb: Number(maxRss.toFixed(2)),
        avgRssMb: Number(avgRss.toFixed(2)),
      }
    },
  }
}

function parseDiagnosticPayload(data) {
  if (!data) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  if (typeof data === 'object') {
    return data
  }
  return null
}

function hasSustainedThreshold(samples, selector, threshold, minConsecutive) {
  let streak = 0
  for (const sample of samples) {
    const value = Number(selector(sample))
    if (Number.isFinite(value) && value >= threshold) {
      streak += 1
      if (streak >= minConsecutive) {
        return true
      }
      continue
    }
    streak = 0
  }
  return false
}

function summarizeDiagnostics(samples, pollMs) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      sampleCount: 0,
      maxConnectionUsagePercent: null,
      maxLockWaitSeconds: null,
      maxWebhookBacklog: null,
      maxReminderStuckClaims: null,
      alerts: {
        connectionPressure80PctFor5m: false,
        lockWaitOver2sSustained: false,
        webhookBacklogPersistsOver5m: false,
        reminderClaimsStuck: false,
      },
    }
  }

  const connectionValues = samples.map((sample) => Number(sample?.connections?.usagePercent || 0))
  const lockValues = samples.map((sample) => Number(sample?.locks?.maxWaitSeconds || 0))
  const webhookBacklogValues = samples.map((sample) => Number(sample?.webhooks?.backlog || 0))
  const reminderStuckValues = samples.map((sample) => Number(sample?.reminders?.stuckClaims || 0))

  const maxConnectionUsagePercent = Math.max(...connectionValues)
  const maxLockWaitSeconds = Math.max(...lockValues)
  const maxWebhookBacklog = Math.max(...webhookBacklogValues)
  const maxReminderStuckClaims = Math.max(...reminderStuckValues)

  const fiveMinuteSamples = Math.max(1, Math.ceil((5 * 60_000) / Math.max(pollMs, 1000)))
  const oneMinuteSamples = Math.max(1, Math.ceil(60_000 / Math.max(pollMs, 1000)))

  return {
    sampleCount: samples.length,
    maxConnectionUsagePercent: Number(maxConnectionUsagePercent.toFixed(2)),
    maxLockWaitSeconds: Number(maxLockWaitSeconds.toFixed(3)),
    maxWebhookBacklog: Math.trunc(maxWebhookBacklog),
    maxReminderStuckClaims: Math.trunc(maxReminderStuckClaims),
    alerts: {
      connectionPressure80PctFor5m: hasSustainedThreshold(
        samples,
        (sample) => sample?.connections?.usagePercent || 0,
        80,
        fiveMinuteSamples
      ),
      lockWaitOver2sSustained: hasSustainedThreshold(
        samples,
        (sample) => sample?.locks?.maxWaitSeconds || 0,
        2,
        oneMinuteSamples
      ),
      webhookBacklogPersistsOver5m: hasSustainedThreshold(
        samples,
        (sample) => sample?.webhooks?.backlog || 0,
        1,
        fiveMinuteSamples
      ),
      reminderClaimsStuck: hasSustainedThreshold(
        samples,
        (sample) => sample?.reminders?.stuckClaims || 0,
        1,
        oneMinuteSamples
      ),
    },
  }
}

function startDbDiagnosticsSampler({
  pollMs = DB_DIAGNOSTIC_POLL_MS,
  claimTimeoutSeconds = DB_DIAGNOSTIC_CLAIM_TIMEOUT_SECONDS,
} = {}) {
  let running = true
  let errorCount = 0
  const samples = []

  async function sampleLoop() {
    while (running) {
      try {
        const { data, error } = await admin.rpc('get_runtime_concurrency_diagnostics', {
          p_claim_timeout_seconds: claimTimeoutSeconds,
        })

        if (error) {
          errorCount += 1
        } else {
          const payload = parseDiagnosticPayload(data)
          if (payload) {
            samples.push(payload)
          }
        }
      } catch {
        errorCount += 1
      }

      await sleep(Math.max(1000, pollMs))
    }
  }

  const loopPromise = sampleLoop()

  return {
    async stop() {
      running = false
      await loopPromise
      const summary = summarizeDiagnostics(samples, pollMs)
      return {
        ...summary,
        errorCount,
      }
    },
  }
}

async function startMockCreemServer() {
  mockCreemServer = http.createServer(async (req, res) => {
    try {
      if (mockState.mode === 'offline') {
        req.socket.destroy()
        return
      }

      if (mockState.mode === 'error') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'mock provider outage' }))
        return
      }

      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing URL' }))
        return
      }

      const body = await readRequestBody(req)
      const parsed = body ? JSON.parse(body) : {}

      if (req.method === 'POST' && req.url === '/v1/checkouts') {
        mockState.checkouts += 1
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
        mockState.portals += 1
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

      if (req.method === 'GET' && req.url.startsWith('/v1/products')) {
        mockState.products += 1
        const query = new URL(`http://x${req.url}`).searchParams
        const productId = query.get('product_id') || 'prod_unknown'
        const isYearly = productId.toLowerCase().includes('year')

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id: productId,
            name: isYearly ? 'Yearly' : 'Monthly',
            price: isYearly ? 19000 : 1900,
            currency: 'USD',
            billing_period: isYearly ? 'every-year' : 'every-month',
          })
        )
        return
      }

      if (req.method === 'GET' && req.url.startsWith('/v1/subscriptions/')) {
        const subscriptionId = req.url.split('/').pop()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            id: subscriptionId,
            status: 'active',
          })
        )
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found', path: req.url, parsed }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({ error: error instanceof Error ? error.message : 'mock server error' })
      )
    }
  })

  await new Promise((resolve, reject) => {
    mockCreemServer.once('error', reject)
    mockCreemServer.listen(MOCK_CREEM_PORT, APP_HOST, () => resolve())
  })

  console.log(`[setup] Mock Creem server listening on ${MOCK_CREEM_URL}`)
}

async function stopMockCreemServer() {
  if (!mockCreemServer) return
  await new Promise((resolve) => mockCreemServer.close(() => resolve()))
  mockCreemServer = null
  console.log('[teardown] Mock Creem server stopped')
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function runProcess(command, args, { env, label, verbose = false } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: verbose ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'ignore'],
    })

    if (verbose) {
      child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`))
      child.stderr.on('data', (chunk) => process.stderr.write(`[${label}:err] ${chunk}`))
    }

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${label} exited with code ${code}`))
    })
  })
}

async function startNextDev() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_URL: APP_URL,
    CREEM_API_BASE_URL: MOCK_CREEM_URL,
    CREEM_API_KEY: process.env.CREEM_API_KEY || 'test_creem_key',
    FORCE_COLOR: '0',
    PORT: String(APP_PORT),
    HOSTNAME: APP_HOST,
  }

  const verboseServerLogs = process.env.LOAD_TEST_VERBOSE_SERVER === '1'
  const mode = LOAD_TEST_APP_MODE === 'dev' ? 'dev' : 'production'

  if (mode === 'production') {
    console.log('[setup] Building app for production load run...')
    await runProcess('node_modules/.bin/next', ['build'], {
      env: {
        ...env,
        NODE_ENV: 'production',
      },
      label: 'next-build',
      verbose: verboseServerLogs,
    })
  }

  const commandArgs =
    mode === 'dev'
      ? ['dev', '-p', String(APP_PORT)]
      : ['start', '-p', String(APP_PORT), '-H', APP_HOST]

  nextDevProcess = spawn('node_modules/.bin/next', commandArgs, {
    cwd: process.cwd(),
    env: {
      ...env,
      NODE_ENV: mode === 'dev' ? env.NODE_ENV : 'production',
    },
    stdio: verboseServerLogs ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'ignore'],
  })

  if (verboseServerLogs) {
    nextDevProcess.stdout.on('data', (chunk) => {
      process.stdout.write(`[next] ${chunk}`)
    })

    nextDevProcess.stderr.on('data', (chunk) => {
      process.stderr.write(`[next:err] ${chunk}`)
    })
  }

  console.log(`[setup] Started Next app in ${mode} mode on ${APP_URL}`)

  await waitForAppReady()
}

async function stopNextDev() {
  if (!nextDevProcess) return

  const processRef = nextDevProcess
  nextDevProcess = null

  await new Promise((resolve) => {
    const done = () => resolve()
    processRef.once('exit', done)
    processRef.kill('SIGINT')
    setTimeout(() => {
      processRef.kill('SIGKILL')
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
        console.log('[setup] Next app is ready')
        return
      }

      lastError = new Error(`Health check returned status ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await sleep(1200)
  }

  throw new Error(
    `Next app did not become ready in time: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

async function withRetries(label, fn, { attempts = 4, delayMs = 1500 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts) {
        throw error
      }
      console.warn(
        `[retry] ${label} failed on attempt ${attempt}/${attempts}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      await sleep(delayMs * attempt)
    }
  }

  throw lastError || new Error(`Unknown failure in ${label}`)
}

async function createTestUser(label) {
  const email = `${label}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.com`
  const password = 'LoadTestPassword123!'

  const { data, error } = await withRetries(`create user ${email}`, () =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
  )

  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to create user')
  }

  createdUserIds.add(data.user.id)

  const { data: signIn, error: signInError } = await withRetries(`sign in ${email}`, () =>
    anon.auth.signInWithPassword({ email, password })
  )

  if (signInError || !signIn.session || !signIn.user) {
    throw new Error(signInError?.message || 'Failed to sign in user')
  }

  return {
    userId: signIn.user.id,
    email,
    password,
    session: signIn.session,
    cookie: createAuthCookie(signIn.session),
    sessionRefreshedAtMs: Date.now(),
  }
}

async function refreshUserSession(user) {
  const { data: signIn, error: signInError } = await withRetries(`refresh session ${user.email}`, () =>
    anon.auth.signInWithPassword({ email: user.email, password: user.password })
  )

  if (signInError || !signIn.session || !signIn.user) {
    throw new Error(signInError?.message || `Failed to refresh session for ${user.email}`)
  }

  user.userId = signIn.user.id
  user.session = signIn.session
  user.cookie = createAuthCookie(signIn.session)
  user.sessionRefreshedAtMs = Date.now()
  return user
}

async function maybeRefreshUserSession(user, maxAgeMs = SESSION_REFRESH_MAX_AGE_MS) {
  const refreshedAt = Number(user.sessionRefreshedAtMs || 0)
  if (Date.now() - refreshedAt <= Math.max(30_000, maxAgeMs)) {
    return user
  }

  const key = user.email
  const existingPromise = sessionRefreshInFlight.get(key)
  if (existingPromise) {
    await existingPromise
    return user
  }

  const refreshPromise = refreshUserSession(user)
    .catch((error) => {
      throw error
    })
    .finally(() => {
      sessionRefreshInFlight.delete(key)
    })

  sessionRefreshInFlight.set(key, refreshPromise)
  await refreshPromise
  return user
}

async function cleanupUsers() {
  for (const userId of [...createdUserIds, ...createdSignupUserIds]) {
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch (error) {
      console.warn(
        `[cleanup] Failed to delete user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}

async function seedContracts(userId, count = 250) {
  const rows = []
  const today = new Date()

  for (let index = 0; index < count; index += 1) {
    const start = new Date(today)
    start.setDate(start.getDate() - (60 + index))

    const end = new Date(today)
    end.setDate(end.getDate() + (10 + (index % 120)))

    rows.push({
      user_id: userId,
      name: `Load Contract ${index + 1}`,
      vendor: `Vendor ${index % 15}`,
      type: ['license', 'service', 'support', 'subscription'][index % 4],
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      value: 1000 + index,
      currency: 'USD',
      auto_renew: index % 2 === 0,
      renewal_terms: null,
      notes: null,
      tags: [`tag-${index % 7}`],
      email_reminders: false,
    })
  }

  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100)
    const { error } = await admin.from('contracts').insert(batch)
    if (error) {
      throw new Error(`Failed seeding contracts: ${error.message}`)
    }
  }
}

async function seedDueReminderCase(user) {
  const today = new Date()
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + 1)

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: user.userId,
      full_name: 'Load Tester',
      email_notifications: true,
      timezone: 'UTC',
    },
    {
      onConflict: 'user_id',
    }
  )

  if (profileError) {
    throw new Error(`Failed to upsert profile for reminder case: ${profileError.message}`)
  }

  const { error: snapshotError } = await admin.from('entitlement_snapshots').upsert(
    {
      user_id: user.userId,
      is_premium: true,
      features_json: {
        emailReminders: true,
        csvExport: true,
        contractsLimit: null,
      },
      reason: 'load_test_seed',
      effective_from: new Date().toISOString(),
      effective_to: new Date(Date.now() + 86400000).toISOString(),
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  )

  if (snapshotError) {
    throw new Error(`Failed to upsert entitlement snapshot: ${snapshotError.message}`)
  }

  const { data: contractRow, error: contractError } = await admin
    .from('contracts')
    .insert({
      user_id: user.userId,
      name: 'Due Reminder Contract',
      vendor: 'Reminder Vendor',
      type: 'service',
      start_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
      end_date: dueDate.toISOString().slice(0, 10),
      value: 5000,
      currency: 'USD',
      auto_renew: false,
      email_reminders: true,
    })
    .select('id')
    .single()

  if (contractError || !contractRow) {
    throw new Error(contractError?.message || 'Failed to insert reminder test contract')
  }

  const { error: reminderError } = await admin.from('reminders').insert({
    contract_id: contractRow.id,
    days_before: 1,
    notify_emails: [user.email],
  })

  if (reminderError) {
    throw new Error(`Failed to insert due reminder seed row: ${reminderError.message}`)
  }

  return contractRow.id
}

async function loadMutationContractFixtures(userId, limit = 40) {
  const { data, error } = await admin
    .from('contracts')
    .select(
      'id,name,vendor,type,start_date,end_date,value,currency,auto_renew,renewal_terms,notes,tags'
    )
    .eq('user_id', userId)
    .order('end_date', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load contract mutation fixtures: ${error.message}`)
  }

  return data || []
}

async function assertAuthenticatedContracts(cookie) {
  const response = await fetch(`${APP_URL}/api/contracts?page=1&limit=5`, {
    headers: {
      Cookie: cookie,
      Origin: APP_URL,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Auth check failed with status ${response.status}: ${text.slice(0, 200)}`)
  }

  const payload = await response.json().catch(() => ({}))
  if (!payload?.success) {
    throw new Error(`Auth check returned unsuccessful payload: ${JSON.stringify(payload)}`)
  }
}

async function triggerBillingReconcile({
  limit = 500,
  concurrency = 20,
  maxAttempts = 8,
  maxBatches = 5,
} = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
    concurrency: String(concurrency),
    maxAttempts: String(maxAttempts),
    maxBatches: String(maxBatches),
  })

  return withRetries(
    'trigger billing reconcile',
    async () => {
      const response = await fetch(`${APP_URL}/api/internal/billing/reconcile?${query.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      })

      const text = await response.text().catch(() => '')
      let payload = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = null
      }

      if (response.status === 409) {
        return {
          lockBusy: true,
          retryAfterSeconds: Number(response.headers.get('retry-after') || 1),
        }
      }

      if (!response.ok || payload?.success !== true) {
        const failure = new Error(`Billing reconcile failed (${response.status}): ${text.slice(0, 500)}`)
        if (!isTransientSupabaseErrorMessage(text)) {
          throw failure
        }
        throw failure
      }

      return payload?.data || null
    },
    { attempts: 4, delayMs: 1200 }
  )
}

async function countWebhookStatus(status) {
  const { count, error } = await withRetries(
    `count webhook status ${status}`,
    () =>
      admin
        .from('billing_webhook_inbox')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', status),
    { attempts: 4, delayMs: 1200 }
  )

  if (error) {
    throw new Error(`Failed counting webhook inbox status=${status}: ${error.message}`)
  }

  return count || 0
}

async function getWebhookBacklog() {
  const [pending, failed, processed, ignored] = await Promise.all([
    countWebhookStatus('pending'),
    countWebhookStatus('failed'),
    countWebhookStatus('processed'),
    countWebhookStatus('ignored'),
  ])

  return {
    pending,
    failed,
    processed,
    ignored,
    backlog: pending + failed,
  }
}

async function waitForWebhookBacklogDrain({
  timeoutMs = 5 * 60_000,
  pollMs = 3_000,
  maxBacklog = 0,
} = {}) {
  const startedAt = Date.now()
  let lastSnapshot = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const reconcileResult = await triggerBillingReconcile()
      if (reconcileResult?.lockBusy) {
        const retryAfterMs = Math.max(
          pollMs,
          Math.trunc((reconcileResult.retryAfterSeconds || 1) * 1000)
        )
        await sleep(retryAfterMs)
        continue
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!isTransientSupabaseErrorMessage(message)) {
        throw error
      }
      await sleep(pollMs)
      continue
    }

    let snapshot = null
    try {
      snapshot = await getWebhookBacklog()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!isTransientSupabaseErrorMessage(message)) {
        throw error
      }
      await sleep(pollMs)
      continue
    }

    lastSnapshot = snapshot

    if (snapshot.backlog <= maxBacklog) {
      return {
        drained: true,
        elapsedMs: Date.now() - startedAt,
        snapshot,
      }
    }

    await sleep(pollMs)
  }

  return {
    drained: false,
    elapsedMs: Date.now() - startedAt,
    snapshot: lastSnapshot,
  }
}

async function runLoadScenario({
  name,
  description,
  category = 'capacity',
  concurrency,
  durationMs,
  timeoutMs = 15_000,
  buildRequest,
  successStatus = (status) => status >= 200 && status < 400,
}) {
  assert(nextDevProcess && nextDevProcess.pid, 'Next dev process must be running')

  console.log(`\n[scenario:start] [${category}] ${name} | concurrency=${concurrency}, duration=${durationMs}ms`)

  const sampler = startResourceSampler(nextDevProcess.pid)

  let requestCount = 0
  let successCount = 0
  let errorCount = 0
  let timeoutCount = 0
  const statusCounts = {}
  const errorTypes = {}
  const latencies = []
  const operationStats = {}

  const deadline = Date.now() + durationMs
  const startedAt = performance.now()

  const workers = Array.from({ length: concurrency }, (_, workerId) =>
    (async () => {
      let iteration = 0
      while (Date.now() < deadline) {
        iteration += 1
        const requestStarted = performance.now()
        let operationName = 'unlabeled'

        try {
          const req = await buildRequest({ workerId, iteration })
          operationName =
            typeof req?.operation === 'string' && req.operation.trim()
              ? req.operation.trim()
              : 'unlabeled'
          if (!operationStats[operationName]) {
            operationStats[operationName] = {
              requests: 0,
              successes: 0,
              errors: 0,
              statusCounts: {},
              errorTypes: {},
              latencies: [],
            }
          }

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)

          const response = await fetch(req.url, {
            method: req.method || 'GET',
            headers: req.headers,
            body: req.body,
            signal: controller.signal,
          })

          clearTimeout(timer)
          await response.text().catch(() => '')

          const duration = performance.now() - requestStarted
          latencies.push(duration)
          requestCount += 1
          operationStats[operationName].requests += 1
          operationStats[operationName].latencies.push(duration)

          statusCounts[response.status] = (statusCounts[response.status] || 0) + 1
          operationStats[operationName].statusCounts[response.status] =
            (operationStats[operationName].statusCounts[response.status] || 0) + 1

          if (successStatus(response.status, operationName)) {
            successCount += 1
            operationStats[operationName].successes += 1
          } else {
            errorCount += 1
            operationStats[operationName].errors += 1
          }
        } catch (error) {
          if (!operationStats[operationName]) {
            operationStats[operationName] = {
              requests: 0,
              successes: 0,
              errors: 0,
              statusCounts: {},
              errorTypes: {},
              latencies: [],
            }
          }

          const duration = performance.now() - requestStarted
          latencies.push(duration)
          requestCount += 1
          errorCount += 1
          operationStats[operationName].requests += 1
          operationStats[operationName].errors += 1
          operationStats[operationName].latencies.push(duration)

          const errorCode =
            error && typeof error === 'object' && 'name' in error
              ? String(error.name)
              : 'RequestError'
          errorTypes[errorCode] = (errorTypes[errorCode] || 0) + 1
          operationStats[operationName].errorTypes[errorCode] =
            (operationStats[operationName].errorTypes[errorCode] || 0) + 1

          if (errorCode === 'AbortError') {
            timeoutCount += 1
          }
        }
      }
    })()
  )

  await Promise.all(workers)
  const elapsedMs = performance.now() - startedAt
  const resource = await sampler.stop()

  const latencySummary = summarizeLatencies(latencies)
  const rps = requestCount > 0 ? requestCount / (elapsedMs / 1000) : 0
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0

  const result = {
    name,
    description,
    category,
    concurrency,
    durationMs,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    requests: requestCount,
    successes: successCount,
    errors: errorCount,
    timeoutErrors: timeoutCount,
    errorRate: Number((errorRate * 100).toFixed(2)),
    rps: Number(rps.toFixed(2)),
    statusCounts,
    errorTypes,
    operations: summarizeOperationStats(operationStats),
    latencyMs: latencySummary,
    resource,
  }

  report.scenarios.push(result)

  console.log(
    `[scenario:done] [${category}] ${name} | req=${result.requests} rps=${result.rps} p95=${result.latencyMs.p95}ms errorRate=${result.errorRate}%`
  )

  return result
}

async function runBurstScenario({
  name,
  description,
  category = 'capacity',
  count,
  buildRequest,
  successStatus = (status) => status >= 200 && status < 400,
}) {
  console.log(`\n[scenario:start] [${category}] ${name} | burst_count=${count}`)

  const startedAt = performance.now()
  const latencies = []
  let successCount = 0
  let errorCount = 0
  const statusCounts = {}
  const errorTypes = {}

  const tasks = Array.from({ length: count }, async (_, index) => {
    const requestStarted = performance.now()
    try {
      const req = await buildRequest({ index })
      const response = await fetch(req.url, {
        method: req.method || 'GET',
        headers: req.headers,
        body: req.body,
      })
      const bodyText = await response.text().catch(() => '')

      latencies.push(performance.now() - requestStarted)
      statusCounts[response.status] = (statusCounts[response.status] || 0) + 1

      if (successStatus(response.status, bodyText)) {
        successCount += 1
      } else {
        errorCount += 1
      }

      return { status: response.status, bodyText }
    } catch (error) {
      latencies.push(performance.now() - requestStarted)
      errorCount += 1
      const errorCode =
        error && typeof error === 'object' && 'name' in error
          ? String(error.name)
          : 'RequestError'
      errorTypes[errorCode] = (errorTypes[errorCode] || 0) + 1
      return null
    }
  })

  const responses = await Promise.all(tasks)
  const elapsedMs = performance.now() - startedAt

  const result = {
    name,
    description,
    category,
    count,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    requests: count,
    successes: successCount,
    errors: errorCount,
    errorRate: Number(((errorCount / Math.max(count, 1)) * 100).toFixed(2)),
    statusCounts,
    errorTypes,
    latencyMs: summarizeLatencies(latencies),
  }

  report.scenarios.push(result)

  console.log(
    `[scenario:done] [${category}] ${name} | success=${result.successes}/${result.requests} p95=${result.latencyMs.p95}ms errorRate=${result.errorRate}%`
  )

  return { result, responses }
}

function findFirstBreakingPoint(scenarios) {
  const ordered = scenarios.filter((scenario) =>
    scenario.name.startsWith('capacity_stage_') || scenario.name.startsWith('contracts_ramp_')
  )

  for (const scenario of ordered) {
    const p95 = scenario.latencyMs?.p95
    const errorRate = scenario.errorRate || 0

    if ((typeof p95 === 'number' && p95 > 1000) || errorRate > 1.0) {
      return {
        scenario: scenario.name,
        concurrency: scenario.concurrency,
        p95,
        errorRate,
        rps: scenario.rps,
      }
    }
  }

  return null
}

async function writeReportFiles() {
  await fs.mkdir('test-results', { recursive: true })

  const jsonPath = path.join('test-results', 'production-readiness-load-report.json')
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')

  const lines = []
  lines.push('# Production Readiness Load Report')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`App URL: ${report.appUrl}`)
  lines.push('')

  if (report.setup?.firstBreakingPoint) {
    const bp = report.setup.firstBreakingPoint
    lines.push('## First Breaking Point')
    lines.push(
      `- Scenario: ${bp.scenario} | Concurrency: ${bp.concurrency} | p95: ${bp.p95}ms | Error rate: ${bp.errorRate}% | Throughput: ${bp.rps} rps`
    )
    lines.push('')
  }

  lines.push('## Scenario Results')
  for (const scenario of report.scenarios) {
    lines.push(
      `- [${scenario.category || 'capacity'}] ${scenario.name}: req=${scenario.requests}, rps=${scenario.rps || '-'}, p95=${scenario.latencyMs?.p95 || '-'}ms, errorRate=${scenario.errorRate}%`
    )

    const operationEntries = Object.entries(scenario.operations || {})
      .sort((left, right) => right[1].errors - left[1].errors)
      .slice(0, 4)

    for (const [operationName, operationStats] of operationEntries) {
      lines.push(
        `  - op=${operationName}: req=${operationStats.requests}, p95=${operationStats.latencyMs?.p95 || '-'}ms, errorRate=${operationStats.errorRate}%`
      )
    }
  }
  lines.push('')

  if (report.notes.length > 0) {
    lines.push('## Notes')
    for (const note of report.notes) {
      lines.push(`- ${note}`)
    }
    lines.push('')
  }

  const mdPath = path.join('test-results', 'production-readiness-load-report.md')
  await fs.writeFile(mdPath, lines.join('\n'), 'utf8')

  console.log(`[output] Wrote ${jsonPath}`)
  console.log(`[output] Wrote ${mdPath}`)
}

async function main() {
  const setupStartedAt = performance.now()
  let diagnosticsSampler = null

  try {
    await startMockCreemServer()
    await startNextDev()

    const primaryUser = await createTestUser('load-primary')
    const checkoutUsers = []
    for (let i = 0; i < 30; i += 1) {
      // Stagger user creation to reduce auth API burst pressure
      checkoutUsers.push(await createTestUser(`checkout-${i}`))
      await sleep(30)
    }

    await seedContracts(primaryUser.userId, 300)
    await seedDueReminderCase(primaryUser)
    const mutationFixtures = await loadMutationContractFixtures(primaryUser.userId, 60)

    await assertAuthenticatedContracts(primaryUser.cookie)

    const maxScenarioConcurrency = getMaxScenarioConcurrency()
    const capacityStages = parseCapacityStages(maxScenarioConcurrency)

    report.setup = {
      setupDurationMs: Number((performance.now() - setupStartedAt).toFixed(2)),
      appMode: LOAD_TEST_APP_MODE === 'dev' ? 'dev' : 'production',
      onlyCapacity: LOAD_TEST_ONLY_CAPACITY,
      maxScenarioConcurrency,
      capacityStages,
      primaryUserId: primaryUser.userId,
      checkoutUserCount: checkoutUsers.length,
      seededContracts: 300,
      soakConfigured: {
        enabled: RUN_SOAK,
        durationMs: clampNumber(SOAK_DURATION_MS, 60_000, 7_200_000, 3_600_000),
        concurrency: clampNumber(SOAK_CONCURRENCY, 1, maxScenarioConcurrency, Math.min(50, maxScenarioConcurrency)),
      },
    }

    diagnosticsSampler = startDbDiagnosticsSampler()

    // Warmup
    await fetch(`${APP_URL}/api/contracts?page=1&limit=20`, {
      headers: {
        Cookie: primaryUser.cookie,
        Origin: APP_URL,
      },
    }).catch(() => null)

    const stageDurationMs = clampNumber(CAPACITY_STAGE_DURATION_MS, 5_000, 120_000, 15_000)

    for (const concurrency of capacityStages) {
      await runLoadScenario({
        name: `capacity_stage_${concurrency}`,
        description:
          'Mixed stage load (60% contracts list/search/upcoming, 15% contract mutation, 10% checkout, 10% webhook ingest, 5% auth login)',
        category: 'capacity',
        concurrency,
        durationMs: stageDurationMs,
        timeoutMs: 20_000,
        buildRequest: async ({ workerId, iteration }) => {
          const mixSelector = (workerId * 37 + iteration * 17) % 100

          if (mixSelector < 60) {
            await maybeRefreshUserSession(primaryUser)
            const routeVariant = (workerId + iteration) % 3
            const contractsUrl =
              routeVariant === 0
                ? `${APP_URL}/api/contracts?page=1&limit=20`
                : routeVariant === 1
                  ? `${APP_URL}/api/contracts?page=1&limit=20&search=Load`
                  : `${APP_URL}/api/contracts?page=1&limit=20&upcoming=true`

            return {
              operation:
                routeVariant === 0
                  ? 'contracts_list'
                  : routeVariant === 1
                    ? 'contracts_search'
                    : 'contracts_upcoming',
              method: 'GET',
              url: contractsUrl,
              headers: {
                Cookie: primaryUser.cookie,
                Origin: APP_URL,
                'x-forwarded-for': `198.51.${workerId % 200}.${(iteration % 200) + 1}`,
              },
            }
          }

          if (mixSelector < 75 && mutationFixtures.length > 0) {
            await maybeRefreshUserSession(primaryUser)
            const fixture = mutationFixtures[(workerId + iteration) % mutationFixtures.length]
            const fixtureValue =
              typeof fixture.value === 'number'
                ? fixture.value
                : Number.parseFloat(String(fixture.value))
            const normalizedRenewalTerms =
              typeof fixture.renewal_terms === 'string' && fixture.renewal_terms.trim()
                ? fixture.renewal_terms
                : undefined
            const normalizedCurrency =
              typeof fixture.currency === 'string' && fixture.currency.trim()
                ? fixture.currency
                : 'USD'
            const normalizedAutoRenew = typeof fixture.auto_renew === 'boolean' ? fixture.auto_renew : false
            return {
              operation: 'contracts_patch_mutation',
              method: 'PATCH',
              url: `${APP_URL}/api/contracts/${fixture.id}`,
              headers: {
                Cookie: primaryUser.cookie,
                Origin: APP_URL,
                'Content-Type': 'application/json',
                'x-forwarded-for': `198.52.${workerId % 200}.${(iteration % 200) + 1}`,
              },
              body: JSON.stringify({
                name: fixture.name,
                vendor: fixture.vendor,
                type: fixture.type,
                startDate: fixture.start_date,
                endDate: fixture.end_date,
                value: Number.isFinite(fixtureValue) ? fixtureValue : undefined,
                currency: normalizedCurrency,
                autoRenew: normalizedAutoRenew,
                renewalTerms: normalizedRenewalTerms,
                notes: `capacity-stage-${Date.now()}-${iteration}`,
                tags: Array.isArray(fixture.tags) ? fixture.tags : [],
                reminderDays: [],
                emailReminders: false,
                notifyEmails: [],
              }),
            }
          }

          if (mixSelector < 85) {
            const user = checkoutUsers[(workerId + iteration) % checkoutUsers.length]
            await maybeRefreshUserSession(user)
            return {
              operation: 'billing_checkout',
              method: 'POST',
              url: `${APP_URL}/api/billing/checkout`,
              headers: {
                Cookie: user.cookie,
                Origin: APP_URL,
                'Content-Type': 'application/json',
                'x-request-id': uid(`checkout_stage_${workerId}`),
                'x-forwarded-for': `100.64.${workerId % 200}.${(iteration % 200) + 1}`,
              },
              body: JSON.stringify({ planCode: 'monthly' }),
            }
          }

          if (mixSelector < 95) {
            const payload = {
              id: uid(`evt_stage_${workerId}_${iteration}`),
              type: 'subscription.paid',
              created_at: new Date().toISOString(),
              data: {
                object: {
                  subscription_id: `sub_stage_${primaryUser.userId}`,
                  customer_id: `cus_stage_${primaryUser.userId}`,
                  status: 'active',
                  current_period_end: new Date(Date.now() + 86400000).toISOString(),
                  metadata: {
                    userId: primaryUser.userId,
                    planCode: 'monthly',
                  },
                },
              },
            }

            const rawBody = JSON.stringify(payload)
            return {
              operation: 'webhook_ingest',
              method: 'POST',
              url: `${APP_URL}/api/webhooks/creem`,
              headers: {
                'Content-Type': 'application/json',
                'creem-signature': createWebhookSignature(rawBody),
                'x-forwarded-for': `198.18.${workerId % 200}.${(iteration % 200) + 1}`,
              },
              body: rawBody,
            }
          }

          const user = checkoutUsers[(workerId + iteration) % checkoutUsers.length]
          return {
            operation: 'auth_login',
            method: 'POST',
            url: `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
            headers: {
              apikey: SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              password: user.password,
            }),
          }
        },
        successStatus: (status, operationName) => {
          if (status === 200 || status === 201 || status === 202) {
            return true
          }

          // External dependency pressure should not be counted as app-capacity failure.
          if (operationName === 'auth_login' && status === 429) {
            return true
          }

          return false
        },
      })
    }

    if (!LOAD_TEST_ONLY_CAPACITY) {
      await runLoadScenario({
      name: 'webhook_burst',
      description: 'Burst delivery of signed Creem webhook events',
      category: 'capacity',
      concurrency: Math.min(120, maxScenarioConcurrency),
      durationMs: 20_000,
      buildRequest: async ({ workerId, iteration }) => {
        const eventId = uid(`evt_${workerId}_${iteration}`)
        const payload = {
          id: eventId,
          type: 'subscription.paid',
          created_at: new Date().toISOString(),
          data: {
            object: {
              subscription_id: `sub_${primaryUser.userId}`,
              customer_id: `cus_${primaryUser.userId}`,
              status: 'active',
              current_period_end: new Date(Date.now() + 86400000).toISOString(),
              metadata: {
                userId: primaryUser.userId,
                planCode: 'monthly',
              },
            },
          },
        }

        const rawBody = JSON.stringify(payload)
        return {
          operation: 'webhook_ingest',
          method: 'POST',
          url: `${APP_URL}/api/webhooks/creem`,
          headers: {
            'Content-Type': 'application/json',
            'creem-signature': createWebhookSignature(rawBody),
            'x-forwarded-for': `198.18.${workerId % 200}.${(iteration % 200) + 1}`,
          },
          body: rawBody,
        }
      },
      successStatus: (status) => status === 200 || status === 202,
    })

    let webhookBacklogAfterBurst = null
    let webhookDrain = null

    try {
      webhookBacklogAfterBurst = await getWebhookBacklog()
      webhookDrain = await waitForWebhookBacklogDrain({
        timeoutMs: 5 * 60_000,
        pollMs: 3_000,
        maxBacklog: 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.notes.push(`Webhook backlog measurement interrupted: ${message}`)
      webhookDrain = {
        drained: false,
        elapsedMs: null,
        snapshot: null,
        error: message,
      }
    }

    report.setup.webhookBurstBacklog = {
      afterBurst: webhookBacklogAfterBurst,
      drainResult: webhookDrain,
    }

    if (!webhookDrain?.drained) {
      report.notes.push(
        `Webhook backlog did not drain within 5 minutes (pending=${webhookDrain?.snapshot?.pending ?? 'n/a'}, failed=${webhookDrain?.snapshot?.failed ?? 'n/a'}).`
      )
    }

    const backlogSeed = await runBurstScenario({
      name: 'webhook_backlog_seed_300',
      description: 'Force webhook inbox backlog with 300 concurrent signed deliveries',
      category: 'resilience',
      count: Math.min(300, maxScenarioConcurrency),
      buildRequest: async ({ index }) => {
        const payload = {
          id: uid(`evt_backlog_${index}`),
          type: 'subscription.paid',
          created_at: new Date().toISOString(),
          data: {
            object: {
              subscription_id: `sub_backlog_${primaryUser.userId}`,
              customer_id: `cus_backlog_${primaryUser.userId}`,
              status: 'active',
              current_period_end: new Date(Date.now() + 86400000).toISOString(),
              metadata: {
                userId: primaryUser.userId,
                planCode: 'monthly',
              },
            },
          },
        }

        const rawBody = JSON.stringify(payload)
        return {
          method: 'POST',
          url: `${APP_URL}/api/webhooks/creem`,
          headers: {
            'Content-Type': 'application/json',
            'creem-signature': createWebhookSignature(rawBody),
            'x-forwarded-for': `198.19.${index % 200}.${(index % 200) + 1}`,
          },
          body: rawBody,
        }
      },
      successStatus: (status) => status === 200 || status === 202,
    })

    let backlogBeforeDrain = null
    let backlogDrain = null

    try {
      backlogBeforeDrain = await getWebhookBacklog()
      backlogDrain = await waitForWebhookBacklogDrain({
        timeoutMs: 5 * 60_000,
        pollMs: 3_000,
        maxBacklog: 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.notes.push(`Background backlog drain check interrupted: ${message}`)
      backlogDrain = {
        drained: false,
        elapsedMs: null,
        snapshot: null,
        error: message,
      }
    }

    report.setup.backgroundBacklog = {
      seededRequests: backlogSeed.result.requests,
      acceptedRequests: backlogSeed.result.successes,
      beforeDrain: backlogBeforeDrain,
      drainResult: backlogDrain,
    }

    if (!backlogDrain?.drained) {
      report.notes.push(
        `Background backlog scenario failed to drain to steady state in 5 minutes (pending=${backlogDrain?.snapshot?.pending ?? 'n/a'}, failed=${backlogDrain?.snapshot?.failed ?? 'n/a'}).`
      )
    }

    await runLoadScenario({
      name: 'checkout_concurrency',
      description: 'Concurrent checkout creation with user/IP rotation',
      category: 'capacity',
      concurrency: Math.min(20, maxScenarioConcurrency),
      durationMs: 12_000,
      buildRequest: async ({ workerId, iteration }) => {
        const user = checkoutUsers[(workerId + iteration) % checkoutUsers.length]
        await maybeRefreshUserSession(user)
        return {
          operation: 'billing_checkout',
          method: 'POST',
          url: `${APP_URL}/api/billing/checkout`,
          headers: {
            Cookie: user.cookie,
            Origin: APP_URL,
            'Content-Type': 'application/json',
            'x-request-id': uid(`checkout_${workerId}`),
            'x-forwarded-for': `100.64.${workerId % 200}.${(iteration % 200) + 1}`,
          },
          body: JSON.stringify({ planCode: 'monthly' }),
        }
      },
      successStatus: (status) => status === 200,
    })

    await runLoadScenario({
      name: 'checkout_rate_limit_abuse',
      description: 'Intentional abusive checkout burst to validate local rate limiting behavior',
      category: 'abuse',
      concurrency: Math.min(40, maxScenarioConcurrency),
      durationMs: 10_000,
      buildRequest: async ({ workerId, iteration }) => {
        const user = checkoutUsers[0]
        await maybeRefreshUserSession(user)
        return {
          operation: 'billing_checkout',
          method: 'POST',
          url: `${APP_URL}/api/billing/checkout`,
          headers: {
            Cookie: user.cookie,
            Origin: APP_URL,
            'Content-Type': 'application/json',
            'x-request-id': uid(`checkout_abuse_${workerId}`),
            'x-forwarded-for': `100.64.255.${(iteration % 200) + 1}`,
          },
          body: JSON.stringify({ planCode: 'monthly' }),
        }
      },
      successStatus: (status) => status === 200 || status === 429,
    })

    const loginUser = checkoutUsers[0]
    await runBurstScenario({
      name: 'auth_login_burst',
      description: 'Supabase password login burst (dependency stress)',
      category: 'abuse',
      count: Math.min(60, maxScenarioConcurrency),
      buildRequest: async () => ({
        method: 'POST',
        url: `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginUser.email,
          password: loginUser.password,
        }),
      }),
      successStatus: (status) => status === 200 || status === 429,
    })

    const signupBurst = await runBurstScenario({
      name: 'auth_signup_burst',
      description: 'Supabase signup burst (dependency stress)',
      category: 'abuse',
      count: Math.min(25, maxScenarioConcurrency),
      buildRequest: async ({ index }) => ({
        method: 'POST',
        url: `${SUPABASE_URL}/auth/v1/signup`,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `signup-burst-${Date.now()}-${index}-${crypto
            .randomBytes(2)
            .toString('hex')}@example.com`,
          password: 'SignupBurst123!',
        }),
      }),
      successStatus: (status) => status === 200 || status === 429,
    })

    for (const response of signupBurst.responses) {
      if (!response?.bodyText) continue
      try {
        const payload = JSON.parse(response.bodyText)
        if (payload?.user?.id) {
          createdSignupUserIds.add(payload.user.id)
        }
      } catch {
        // ignore parse failures
      }
    }

    const soakDurationMs = RUN_SOAK
      ? clampNumber(SOAK_DURATION_MS, 60_000, 7_200_000, 3_600_000)
      : clampNumber(SOAK_SMOKE_DURATION_MS, 60_000, 600_000, 120_000)
    const soakConcurrency = clampNumber(
      SOAK_CONCURRENCY,
      1,
      maxScenarioConcurrency,
      Math.min(20, maxScenarioConcurrency)
    )

    await runLoadScenario({
      name: RUN_SOAK ? 'contracts_soak_1h' : 'contracts_soak_smoke',
      description: RUN_SOAK
        ? 'Long-running soak test on contracts endpoint'
        : 'Short soak smoke test on contracts endpoint (set LOAD_TEST_RUN_SOAK=1 for 1h run)',
      category: 'capacity',
      concurrency: soakConcurrency,
      durationMs: soakDurationMs,
      buildRequest: async ({ workerId }) => {
        await maybeRefreshUserSession(primaryUser)
        return {
          operation: 'contracts_list',
          method: 'GET',
          url: `${APP_URL}/api/contracts?page=1&limit=20`,
          headers: {
            Cookie: primaryUser.cookie,
            Origin: APP_URL,
            'x-forwarded-for': `172.16.${workerId % 200}.10`,
          },
        }
      },
    })

    if (!RUN_SOAK) {
      report.notes.push(
        `1h soak was explicitly skipped for this run (LOAD_TEST_RUN_SOAK=0, configured duration=${SOAK_DURATION_MS}ms).`
      )
    }

    // Reminder processing route probe (schema-alignment regression guard)
    const reminderResponse = await fetch(`${APP_URL}/api/internal/reminders/process?limit=5`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dryRun: false,
      }),
    })

    const reminderBodyText = await reminderResponse.text().catch(() => '')
    report.setup.reminderProcessStatus = reminderResponse.status
    report.setup.reminderProcessBodyPreview = reminderBodyText.slice(0, 500)

    if (reminderResponse.status >= 500) {
      report.notes.push(
        `Reminder processor returned server error (${reminderResponse.status}); potential schema mismatch or runtime regression.`
      )
    }

    // Partial outage: make Creem unreachable and run checkout pressure again
    mockState.mode = 'offline'

    await runLoadScenario({
      name: 'checkout_partial_outage',
      description: 'Checkout during third-party network outage',
      category: 'resilience',
      concurrency: Math.min(20, maxScenarioConcurrency),
      durationMs: 12_000,
      buildRequest: async ({ workerId, iteration }) => {
        const user = checkoutUsers[(workerId + iteration) % checkoutUsers.length]
        await maybeRefreshUserSession(user)
        return {
          operation: 'billing_checkout',
          method: 'POST',
          url: `${APP_URL}/api/billing/checkout`,
          headers: {
            Cookie: user.cookie,
            Origin: APP_URL,
            'Content-Type': 'application/json',
            'x-request-id': uid(`checkout_outage_${workerId}`),
            'x-forwarded-for': `10.10.${workerId % 200}.${(iteration % 200) + 1}`,
          },
          body: JSON.stringify({ planCode: 'monthly' }),
        }
      },
      successStatus: (status) => status === 503,
    })

    mockState.mode = 'normal'

      await runLoadScenario({
      name: 'checkout_recovery_after_outage',
      description: 'Checkout recovery after third-party outage clears',
      category: 'capacity',
      concurrency: Math.min(15, maxScenarioConcurrency),
      durationMs: 10_000,
      buildRequest: async ({ workerId, iteration }) => {
        const user = checkoutUsers[(workerId + iteration) % checkoutUsers.length]
        await maybeRefreshUserSession(user)
        return {
          operation: 'billing_checkout',
          method: 'POST',
          url: `${APP_URL}/api/billing/checkout`,
          headers: {
            Cookie: user.cookie,
            Origin: APP_URL,
            'Content-Type': 'application/json',
            'x-request-id': uid(`checkout_recovery_${workerId}`),
            'x-forwarded-for': `10.11.${workerId % 200}.${(iteration % 200) + 1}`,
          },
          body: JSON.stringify({ planCode: 'monthly' }),
        }
      },
      successStatus: (status) => status === 200,
      })
    } else {
      report.notes.push(
        'Extended scenarios were skipped (LOAD_TEST_ONLY_CAPACITY=1). Ran only MVP capacity stages.'
      )
    }

    const firstBreakingPoint = findFirstBreakingPoint(report.scenarios)
    report.setup.firstBreakingPoint = firstBreakingPoint

    if (!firstBreakingPoint) {
      report.notes.push(
        `Capacity stages did not cross p95>1000ms or >1% error thresholds within tested concurrencies (max=${maxScenarioConcurrency}).`
      )
    }

    report.setup.mockCreemRequests = {
      checkouts: mockState.checkouts,
      portals: mockState.portals,
      products: mockState.products,
    }

    if (diagnosticsSampler) {
      const diagnostics = await diagnosticsSampler.stop()
      diagnosticsSampler = null
      report.setup.runtimeDiagnostics = diagnostics

      if (diagnostics.alerts?.connectionPressure80PctFor5m) {
        report.notes.push('Connection pressure exceeded 80% for >=5 minutes.')
      }
      if (diagnostics.alerts?.lockWaitOver2sSustained) {
        report.notes.push('Lock waits exceeded 2s for a sustained period.')
      }
      if (diagnostics.alerts?.webhookBacklogPersistsOver5m) {
        report.notes.push('Webhook backlog persisted for >=5 minutes.')
      }
      if (diagnostics.alerts?.reminderClaimsStuck) {
        report.notes.push('Reminder claimed rows remained stuck beyond claim timeout window.')
      }
    }

    await writeReportFiles()
  } finally {
    const teardownStart = performance.now()

    if (diagnosticsSampler) {
      await diagnosticsSampler.stop().catch(() => null)
      diagnosticsSampler = null
    }

    await stopNextDev().catch(() => null)
    await stopMockCreemServer().catch(() => null)
    await cleanupUsers().catch(() => null)

    report.teardown = {
      teardownDurationMs: Number((performance.now() - teardownStart).toFixed(2)),
      cleanedUsers: createdUserIds.size + createdSignupUserIds.size,
    }
  }
}

main()
  .then(() => {
    console.log('\n[done] Production readiness load harness completed successfully.')
  })
  .catch((error) => {
    console.error(`\n[failed] ${error instanceof Error ? error.stack || error.message : String(error)}`)
    process.exitCode = 1
  })
