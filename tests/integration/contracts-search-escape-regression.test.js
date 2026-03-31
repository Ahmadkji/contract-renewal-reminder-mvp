/* eslint-disable no-console */

require('../../scripts/load-env')

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function futureDateOnly(offsetDays = 30) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function isTransientSupabaseError(message) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('connect timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('eai_again')
  )
}

async function withRetries(label, fn, { attempts = 4, delayMs = 1000 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)

      if (!isTransientSupabaseError(message) || attempt === attempts) {
        throw error
      }

      console.warn(`[retry] ${label} failed on attempt ${attempt}/${attempts}: ${message}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw lastError || new Error(`Unknown retry failure in ${label}`)
}

async function createUserWithSession() {
  const email = `contracts-search-regression-${Date.now()}-${crypto
    .randomBytes(2)
    .toString('hex')}@example.com`
  const password = 'ContractsSearchRegression123!'

  const { data: created, error: createError } = await withRetries('create user', () =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
  )

  if (createError || !created?.user) {
    throw new Error(createError?.message || 'Failed to create test user')
  }

  const { data: signIn, error: signInError } = await withRetries('sign in user', () =>
    anon.auth.signInWithPassword({
      email,
      password,
    })
  )

  if (signInError || !signIn?.session) {
    throw new Error(signInError?.message || 'Failed to sign in test user')
  }

  return {
    userId: created.user.id,
    email,
    password,
    session: signIn.session,
  }
}

function createUserClientFromSession(session) {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return userClient.auth
    .setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    .then(({ error }) => {
      if (error) {
        throw new Error(`Failed to set user session: ${error.message}`)
      }
      return userClient
    })
}

async function seedContracts(userId) {
  const rows = [
    {
      user_id: userId,
      name: 'Alpha % Percent',
      vendor: 'Vendor Normal',
      type: 'service',
      start_date: todayDateOnly(),
      end_date: futureDateOnly(45),
      currency: 'USD',
      auto_renew: false,
      email_reminders: false,
    },
    {
      user_id: userId,
      name: 'Beta_Underscore',
      vendor: 'Vendor_Under',
      type: 'service',
      start_date: todayDateOnly(),
      end_date: futureDateOnly(46),
      currency: 'USD',
      auto_renew: false,
      email_reminders: false,
    },
    {
      user_id: userId,
      name: 'Gamma Backslash',
      vendor: 'Vendor \\ Backslash',
      type: 'service',
      start_date: todayDateOnly(),
      end_date: futureDateOnly(47),
      currency: 'USD',
      auto_renew: false,
      email_reminders: false,
    },
  ]

  const { error } = await withRetries('seed contracts', () => admin.from('contracts').insert(rows))
  if (error) {
    throw new Error(`Failed to seed contracts: ${error.message}`)
  }
}

async function queryContractsPage(userClient, userId, search) {
  const { data, error } = await withRetries(`rpc search=${search}`, () =>
    userClient.rpc('get_contracts_page_payload', {
      p_user_id: userId,
      p_page: 1,
      p_limit: 20,
      p_search: search,
      p_upcoming: false,
      p_count_mode: 'planned',
    })
  )

  if (error) {
    throw new Error(error.message)
  }

  const payload = typeof data === 'string' ? JSON.parse(data) : data
  const contracts = Array.isArray(payload?.contracts) ? payload.contracts : []
  const total = Number(payload?.total || 0)

  return {
    contracts,
    total,
  }
}

async function cleanupUser(userId) {
  if (!userId) {
    return
  }

  try {
    await admin.auth.admin.deleteUser(userId)
  } catch (error) {
    console.warn(`[cleanup] failed deleting user ${userId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  let userId = null

  try {
    const user = await createUserWithSession()
    userId = user.userId

    await seedContracts(user.userId)
    const userClient = await createUserClientFromSession(user.session)

    const wildcardSearches = ['%', '_', '\\']
    for (const term of wildcardSearches) {
      const payload = await queryContractsPage(userClient, user.userId, term)
      assert.equal(Array.isArray(payload.contracts), true, `Expected contracts array for wildcard term "${term}"`)
      assert.equal(Number.isFinite(payload.total), true, `Expected numeric total for wildcard term "${term}"`)
    }

    const keywordSearches = ['Percent', 'Under', 'Backslash']
    for (const term of keywordSearches) {
      const payload = await queryContractsPage(userClient, user.userId, term)
      assert.equal(payload.contracts.length > 0, true, `Expected at least one match for keyword term "${term}"`)
    }

    console.log('PASS: get_contracts_page_payload handles wildcard/backslash search terms without server errors')
  } finally {
    await cleanupUser(userId)
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exit(1)
})
