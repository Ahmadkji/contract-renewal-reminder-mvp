/* eslint-disable no-console */

require('../load-env')

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function toIsoSecondsAgo(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return Math.trunc(parsed)
}

function isTransientNetworkError(error) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('enotfound') ||
    message.includes('connect timeout') ||
    message.includes('timed out') ||
    message.includes('eai_again') ||
    message.includes('network')
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

async function count(table, applyFilters) {
  return withRetries(`count ${table}`, async () => {
    let query = admin.from(table).select('*', { count: 'exact', head: true })
    if (applyFilters) {
      query = applyFilters(query)
    }

    const { count: total, error } = await query
    if (error) {
      throw new Error(`Failed counting ${table}: ${error.message}`)
    }

    return total || 0
  })
}

async function releaseStaleClaims(stuckBeforeIso) {
  await withRetries('release stale reminder claims', async () => {
    const { error } = await admin
      .from('reminders')
      .update({
        processing_claimed_at: null,
        processing_claim_token: null,
      })
      .is('sent_at', null)
      .not('processing_claimed_at', 'is', null)
      .lte('processing_claimed_at', stuckBeforeIso)

    if (error) {
      throw new Error(`Failed releasing stale reminder claims: ${error.message}`)
    }
  })
}

async function main() {
  const reminderClaimTimeoutSeconds = parseNonNegativeInt(
    process.env.REMINDER_CLAIM_TIMEOUT_SECONDS,
    900
  )
  const stuckClaimAlertThreshold = parseNonNegativeInt(
    process.env.REMINDER_STUCK_CLAIM_ALERT_THRESHOLD,
    0
  )
  const stuckBeforeIso = toIsoSecondsAgo(reminderClaimTimeoutSeconds)

  const beforeUnsentReminders = await count('reminders', (q) => q.is('sent_at', null))
  const beforeActiveClaims = await count('reminders', (q) =>
    q.is('sent_at', null).not('processing_claimed_at', 'is', null)
  )
  const beforeStuckClaims = await count('reminders', (q) =>
    q
      .is('sent_at', null)
      .not('processing_claimed_at', 'is', null)
      .lte('processing_claimed_at', stuckBeforeIso)
  )

  await releaseStaleClaims(stuckBeforeIso)

  const afterUnsentReminders = await count('reminders', (q) => q.is('sent_at', null))
  const afterActiveClaims = await count('reminders', (q) =>
    q.is('sent_at', null).not('processing_claimed_at', 'is', null)
  )
  const afterStuckClaims = await count('reminders', (q) =>
    q
      .is('sent_at', null)
      .not('processing_claimed_at', 'is', null)
      .lte('processing_claimed_at', stuckBeforeIso)
  )

  const releasedClaims = Math.max(0, beforeStuckClaims - afterStuckClaims)
  const alertTriggered = afterStuckClaims > stuckClaimAlertThreshold
  const status = alertTriggered
    ? 'fail'
    : releasedClaims > 0 || beforeStuckClaims > 0
      ? 'warn'
      : 'pass'

  console.log(
    JSON.stringify(
      {
        status,
        generatedAt: new Date().toISOString(),
        reminderClaimTimeoutSeconds,
        stuckClaimAlertThreshold,
        stuckBeforeIso,
        before: {
          unsentReminders: beforeUnsentReminders,
          activeClaims: beforeActiveClaims,
          stuckClaims: beforeStuckClaims,
        },
        autoHeal: {
          releasedClaims,
        },
        after: {
          unsentReminders: afterUnsentReminders,
          activeClaims: afterActiveClaims,
          stuckClaims: afterStuckClaims,
        },
        alertTriggered,
      },
      null,
      2
    )
  )

  if (alertTriggered) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
