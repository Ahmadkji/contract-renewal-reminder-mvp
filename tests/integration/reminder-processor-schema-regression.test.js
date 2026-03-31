/* eslint-disable no-console */

require('../../scripts/load-env')

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { createClient } = require('@supabase/supabase-js')

const APP_HOST = '127.0.0.1'
const APP_PORT = Number(process.env.REMINDER_TEST_APP_PORT || 3022)
const APP_URL = `http://${APP_HOST}:${APP_PORT}`
const TEST_TIMEOUT_MS = Number(process.env.REMINDER_TEST_TIMEOUT_MS || 120_000)

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const CRON_SECRET = requiredEnv('CRON_SECRET')

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let nextProcess = null
let createdUserId = null
let nextExitInfo = null
let nextLogBuffer = []

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

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

function dateOnly(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 10)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      console.warn(
        `[retry] ${label} failed on attempt ${attempt}/${attempts}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      await sleep(delayMs * attempt)
    }
  }

  throw lastError || new Error(`Unknown retry failure in ${label}`)
}

async function startNextApp() {
  const verboseLogs = process.env.REMINDER_TEST_VERBOSE === '1'
  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_URL: APP_URL,
    FORCE_COLOR: '0',
    // Intentionally unset so reminder send path hits error-handling branch.
    RESEND_API_KEY: '',
  }

  nextProcess = spawn('node_modules/.bin/next', ['dev', '-p', String(APP_PORT)], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  nextExitInfo = null
  nextLogBuffer = []

  const recordLog = (prefix, chunk) => {
    const text = String(chunk)
    nextLogBuffer.push(`${prefix}${text}`)
    if (nextLogBuffer.length > 120) {
      nextLogBuffer = nextLogBuffer.slice(-120)
    }
    if (verboseLogs) {
      process.stdout.write(`${prefix}${text}`)
    }
  }

  nextProcess.stdout.on('data', (chunk) => {
    recordLog('[next] ', chunk)
  })
  nextProcess.stderr.on('data', (chunk) => {
    recordLog('[next:err] ', chunk)
  })
  nextProcess.once('exit', (code, signal) => {
    nextExitInfo = { code, signal }
  })

  await waitForReady()
}

async function stopNextApp() {
  if (!nextProcess) return
  const processRef = nextProcess
  nextProcess = null

  await new Promise((resolve) => {
    processRef.once('exit', () => resolve())
    processRef.kill('SIGINT')
    setTimeout(() => {
      processRef.kill('SIGKILL')
      resolve()
    }, 8_000)
  })
}

async function waitForReady() {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < TEST_TIMEOUT_MS) {
    if (nextExitInfo) {
      throw new Error(
        `Next app exited before becoming ready (code=${nextExitInfo.code}, signal=${nextExitInfo.signal}). Recent logs:\n${nextLogBuffer.join('').slice(-2500)}`
      )
    }

    try {
      const response = await fetch(`${APP_URL}/api`)
      if (response.ok) {
        return
      }
      lastError = new Error(`status=${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(1000)
  }

  throw new Error(
    `Next app did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}

async function createTestUser() {
  const email = `reminder-regression-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.com`
  const password = 'ReminderRegression123!'

  const { data, error } = await withRetries(
    `create reminder regression user ${email}`,
    () =>
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
  )

  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to create user')
  }

  createdUserId = data.user.id

  return {
    userId: data.user.id,
    email,
  }
}

async function deleteTestUser() {
  if (!createdUserId) return
  try {
    await admin.auth.admin.deleteUser(createdUserId)
  } finally {
    createdUserId = null
  }
}

async function seedReminderDueNow(user) {
  const { error: profileError } = await withRetries(
    `upsert profile for ${user.userId}`,
    () =>
      admin.from('profiles').upsert(
        {
          user_id: user.userId,
          full_name: 'Reminder Regression',
          email_notifications: true,
          timezone: 'UTC',
        },
        { onConflict: 'user_id' }
      )
  )
  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`)
  }

  const { error: entitlementError } = await withRetries(
    `upsert entitlement snapshot for ${user.userId}`,
    () =>
      admin.from('entitlement_snapshots').upsert(
        {
          user_id: user.userId,
          is_premium: true,
          features_json: {
            emailReminders: true,
            csvExport: true,
            contractsLimit: null,
          },
          reason: 'reminder_schema_regression_test',
          effective_from: nowIso(-60_000),
          effective_to: nowIso(86_400_000),
          computed_at: nowIso(),
          updated_at: nowIso(),
        },
        { onConflict: 'user_id' }
      )
  )
  if (entitlementError) {
    throw new Error(`Failed to upsert entitlement snapshot: ${entitlementError.message}`)
  }

  const { data: contractRow, error: contractError } = await withRetries(
    `insert contract for ${user.userId}`,
    () =>
      admin
        .from('contracts')
        .insert({
          user_id: user.userId,
          name: 'Reminder Regression Contract',
          vendor: 'Regression Vendor',
          type: 'service',
          start_date: dateOnly(-7 * 86_400_000),
          end_date: dateOnly(86_400_000),
          value: 4900,
          currency: 'USD',
          auto_renew: false,
          email_reminders: true,
        })
        .select('id')
        .single()
  )

  if (contractError || !contractRow) {
    throw new Error(contractError?.message || 'Failed to insert contract')
  }

  const { data: reminderRow, error: reminderError } = await withRetries(
    `insert reminder for contract ${contractRow.id}`,
    () =>
      admin
        .from('reminders')
        .insert({
          contract_id: contractRow.id,
          days_before: 1,
          notify_emails: [user.email],
        })
        .select('id')
        .single()
  )

  if (reminderError || !reminderRow) {
    throw new Error(reminderError?.message || 'Failed to insert reminder')
  }

  return {
    contractId: contractRow.id,
    reminderId: reminderRow.id,
  }
}

async function run() {
  const user = await createTestUser()
  const seeded = await seedReminderDueNow(user)

  const response = await fetch(`${APP_URL}/api/internal/reminders/process?limit=5`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dryRun: false,
    }),
  })

  const text = await response.text().catch(() => '')
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  assert.equal(response.status, 200, `Expected reminder processor 200; got ${response.status}; body=${text.slice(0, 500)}`)
  assert.equal(json?.success, true)
  assert.ok(json?.data, 'Expected reminder processor response payload')
  assert.equal(json.data.failedCount >= 1, true, 'Expected at least one send failure due missing RESEND_API_KEY')
  assert.equal(
    String(text).includes('failed_at') || String(text).includes('error_message'),
    false,
    'Response should not mention legacy reminder columns'
  )

  const { data: reminder, error: reminderError } = await withRetries(
    `read reminder ${seeded.reminderId}`,
    () =>
      admin
        .from('reminders')
        .select('id,sent_at,processing_claimed_at,processing_claim_token')
        .eq('id', seeded.reminderId)
        .single()
  )

  if (reminderError || !reminder) {
    throw new Error(reminderError?.message || 'Failed to read reminder row after processing')
  }

  assert.equal(reminder.sent_at, null, 'Failed send should keep sent_at null')
  assert.equal(reminder.processing_claim_token, null, 'Claim token should be cleared for retry scheduling')
  assert.ok(
    reminder.processing_claimed_at,
    'processing_claimed_at should be set to enforce claim-timeout retry delay'
  )

  console.log('PASS: reminder processor handles simplified schema without failed_at/error_message writes')
}

async function main() {
  try {
    await startNextApp()
    await run()
  } finally {
    await stopNextApp().catch(() => null)
    await deleteTestUser().catch(() => null)
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exitCode = 1
})
