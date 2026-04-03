/* eslint-disable no-console */

require('../load-env')

const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = process.env.LOAD_TEST_APP_URL || 'http://localhost:3000'
const CRON_SECRET = requiredEnv('CRON_SECRET')

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const createdUserIds = new Set()

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

function buildAuthCookie(session) {
  return `sb-${PROJECT_REF}-auth-token=${encodeURIComponent(JSON.stringify(session))}`
}

function makeRequestHeaders(cookie) {
  return {
    Origin: APP_URL,
    Referer: `${APP_URL}/`,
    ...(cookie ? { Cookie: cookie } : {}),
  }
}

function extractCookiePairs(setCookieHeaders) {
  const values = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : typeof setCookieHeaders === 'string'
      ? [setCookieHeaders]
      : []

  return values
    .map((headerValue) => headerValue.split(';')[0]?.trim())
    .filter(Boolean)
}

async function loginViaAuthRoute(email, password) {
  const response = await fetch(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: APP_URL,
      Referer: `${APP_URL}/login`,
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Login failed (${response.status})`)
  }

  const setCookieHeaders =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')

  const cookiePairs = extractCookiePairs(setCookieHeaders)
  if (cookiePairs.length === 0) {
    throw new Error('Login succeeded but no session cookie was returned')
  }

  return {
    payload,
    cookie: cookiePairs.join('; '),
  }
}

async function createConfirmedUser(label) {
  const email = `${uid(label)}@example.com`
  const password = 'SmokeTestPassword123!'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(error?.message || `Failed to create ${label} test user`)
  }

  createdUserIds.add(data.user.id)

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signIn.session || !signIn.user) {
    throw new Error(signInError?.message || `Failed to sign in ${label} test user`)
  }

  return {
    userId: signIn.user.id,
    email,
    password,
    session: signIn.session,
    cookie: buildAuthCookie(signIn.session),
  }
}

async function cleanupUsers(extraUserIds = []) {
  const ids = new Set([...createdUserIds, ...extraUserIds].filter(Boolean))

  for (const userId of ids) {
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

module.exports = {
  APP_URL,
  CRON_SECRET,
  admin,
  anon,
  cleanupUsers,
  createConfirmedUser,
  loginViaAuthRoute,
  makeRequestHeaders,
  buildAuthCookie,
}
