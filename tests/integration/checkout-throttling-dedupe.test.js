/**
 * Checkout Throttling + Dedupe Integration Test
 *
 * Validates:
 * 1) Repeated checkout requests for same user+plan reuse recent session payload
 * 2) Rate-limited checkout responses return stable 429 contract payload/headers
 */

const {
  buildTestIp,
  createTestUser,
  deleteTestUser,
  requiredEnv,
  startBillingRuntime,
} = require('./helpers/billing-integration-harness')

let testUserId = null
let browser = null
let chromium
let runtime = null
const TEST_EMAIL = `checkout-throttle-test-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPassword123!'
const LOGIN_PAGE_TIMEOUT_MS = 60_000
const DASHBOARD_NAV_TIMEOUT_MS = 75_000

async function loadRuntime() {
  const playwright = await import('playwright')
  const nextEnv = await import('@next/env')
  chromium = playwright.chromium
  const loadEnvConfig =
    nextEnv.loadEnvConfig ||
    (nextEnv.default && nextEnv.default.loadEnvConfig)

  if (typeof loadEnvConfig !== 'function') {
    throw new Error('Unable to load env config helper from @next/env')
  }

  loadEnvConfig(process.cwd())
}

function getCheckoutResponseErrorDetails(status, payload) {
  return `status=${status}, payload=${JSON.stringify(payload)}`
}

async function run() {
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  runtime = await startBillingRuntime()
  const APP_URL = runtime.appUrl
  const testIp = buildTestIp()

  testUserId = await createTestUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  browser = await chromium.launch({ headless: true })

  const context = await browser.newContext({ baseURL: APP_URL })
  const page = await context.newPage()

  await page.goto('/login', { timeout: LOGIN_PAGE_TIMEOUT_MS, waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(TEST_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: DASHBOARD_NAV_TIMEOUT_MS })

  const firstCheckout = await context.request.post(`${APP_URL}/api/billing/checkout`, {
    headers: {
      Origin: APP_URL,
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    data: { planCode: 'monthly' },
  })
  const firstPayload = await firstCheckout.json().catch(() => ({}))
  if (
    firstCheckout.status() !== 200 ||
    !firstPayload?.success ||
    typeof firstPayload?.data?.checkoutUrl !== 'string' ||
    typeof firstPayload?.data?.requestId !== 'string'
  ) {
    throw new Error(`Unexpected first checkout response: ${getCheckoutResponseErrorDetails(firstCheckout.status(), firstPayload)}`)
  }

  const secondCheckout = await context.request.post(`${APP_URL}/api/billing/checkout`, {
    headers: {
      Origin: APP_URL,
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    data: { planCode: 'monthly' },
  })
  const secondPayload = await secondCheckout.json().catch(() => ({}))
  if (
    secondCheckout.status() !== 200 ||
    !secondPayload?.success ||
    typeof secondPayload?.data?.checkoutUrl !== 'string' ||
    typeof secondPayload?.data?.requestId !== 'string'
  ) {
    throw new Error(`Unexpected second checkout response: ${getCheckoutResponseErrorDetails(secondCheckout.status(), secondPayload)}`)
  }

  if (firstPayload.data.checkoutUrl !== secondPayload.data.checkoutUrl) {
    throw new Error('Expected deduped checkout URL to match for rapid repeated requests')
  }

  if (firstPayload.data.requestId !== secondPayload.data.requestId) {
    throw new Error('Expected deduped checkout requestId to match for rapid repeated requests')
  }

  let sawRateLimit = false
  for (let i = 0; i < 25; i += 1) {
    const response = await context.request.post(`${APP_URL}/api/billing/checkout`, {
      headers: {
        Origin: APP_URL,
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      data: { planCode: 'monthly' },
    })
    const payload = await response.json().catch(() => ({}))

    if (response.status() === 429) {
      sawRateLimit = true
      const retryAfterHeader = response.headers()['retry-after']
      const retryAfterSeconds = Number.parseInt(String(payload?.retryAfterSeconds || retryAfterHeader || ''), 10)

      if (payload?.success !== false) {
        throw new Error('Expected success=false for checkout rate-limited payload')
      }

      if (payload?.code !== 'CHECKOUT_RATE_LIMITED') {
        throw new Error(`Expected CHECKOUT_RATE_LIMITED code, got: ${payload?.code || 'undefined'}`)
      }

      if (typeof payload?.error !== 'string' || payload.error.length === 0) {
        throw new Error('Expected non-empty error message for checkout rate-limited payload')
      }

      if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
        throw new Error(`Expected positive retry-after value for checkout rate-limited payload/header, got: ${retryAfterHeader}`)
      }

      break
    }

    if (response.status() !== 200) {
      throw new Error(`Unexpected status while probing checkout rate limit: ${getCheckoutResponseErrorDetails(response.status(), payload)}`)
    }
  }

  if (!sawRateLimit) {
    throw new Error('Expected to eventually hit checkout rate limit but did not observe 429 response')
  }

  await context.close()
}

loadRuntime()
  .then(run)
  .then(() => {
    console.log('PASS: checkout throttling + dedupe integration')
  })
  .catch((error) => {
    console.error(`FAIL: checkout throttling + dedupe integration -> ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (browser) {
        await browser.close()
      }
    } catch {}
    try {
      await deleteTestUser(testUserId)
    } catch {}
    try {
      if (runtime) {
        await runtime.stop()
      }
    } catch {}
  })
