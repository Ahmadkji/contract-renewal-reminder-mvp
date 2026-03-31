/**
 * Billing Pricing API Integration Test
 *
 * Validates:
 * 1) GET /api/billing/plans returns normalized monthly/yearly pricing
 * 2) Pricing payload includes source/stale metadata
 * 3) POST /api/billing/checkout returns checkoutUrl for valid plan
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
const TEST_EMAIL = `billing-pricing-test-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPassword123!'

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

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 })

  const plansResponse = await context.request.get(`${APP_URL}/api/billing/plans`, {
    headers: {
      Origin: APP_URL,
      'x-forwarded-for': testIp,
    },
  })
  const plansPayload = await plansResponse.json().catch(() => ({}))

  if (plansResponse.status() !== 200 || !plansPayload?.success || !plansPayload?.data) {
    throw new Error(`Unexpected billing plans response: status=${plansResponse.status()}`)
  }

  if (!Array.isArray(plansPayload.data.plans)) {
    throw new Error('Expected data.plans array in billing plans response')
  }

  const monthlyPlan = plansPayload.data.plans.find((plan) => plan.planCode === 'monthly')
  const yearlyPlan = plansPayload.data.plans.find((plan) => plan.planCode === 'yearly')

  if (!monthlyPlan || !yearlyPlan) {
    throw new Error('Expected monthly and yearly plans in pricing response')
  }

  if (!(monthlyPlan.priceCents > 0) || !(yearlyPlan.priceCents > 0)) {
    throw new Error('Expected positive priceCents for monthly/yearly plans')
  }

  if (!['live', 'fallback'].includes(plansPayload.data.source)) {
    throw new Error('Expected pricing source to be live or fallback')
  }

  const checkoutResponse = await context.request.post(`${APP_URL}/api/billing/checkout`, {
    headers: {
      Origin: APP_URL,
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    data: { planCode: 'monthly' },
  })
  const checkoutPayload = await checkoutResponse.json().catch(() => ({}))

  if (
    checkoutResponse.status() !== 200 ||
    !checkoutPayload?.success ||
    typeof checkoutPayload?.data?.checkoutUrl !== 'string' ||
    checkoutPayload.data.checkoutUrl.length === 0
  ) {
    throw new Error(`Unexpected checkout response: status=${checkoutResponse.status()}`)
  }

  await context.close()
}

loadRuntime()
  .then(run)
  .then(() => {
    console.log('PASS: billing pricing integration')
  })
  .catch((error) => {
    console.error(`FAIL: billing pricing integration -> ${error.message}`)
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
