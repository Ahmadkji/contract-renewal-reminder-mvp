/* eslint-disable no-console */

const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const {
  APP_URL,
  CRON_SECRET,
  admin,
  cleanupUsers,
  createConfirmedUser,
} = require('./mvp-test-helpers')

function isoDateOffset(daysFromToday) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + daysFromToday)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function seedPremiumBillingState(owner) {
  const providerCustomerId = `cust_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  const providerSubscriptionId = `sub_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`

  const { error: customerError } = await admin.from('billing_customers').upsert(
    {
      user_id: owner.userId,
      provider: 'creem',
      provider_customer_id: providerCustomerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (customerError) {
    throw new Error(`Failed to seed premium customer: ${customerError.message}`)
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from('billing_subscriptions')
    .insert({
      user_id: owner.userId,
      provider: 'creem',
      provider_subscription_id: providerSubscriptionId,
      provider_customer_id: providerCustomerId,
      plan_code: 'monthly',
      product_id: 'product_smoke_monthly',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      last_event_created_at: new Date().toISOString(),
      last_event_id: `evt_${Date.now()}`,
    })
    .select('*')
    .single()

  if (subscriptionError || !subscription) {
    throw new Error(subscriptionError?.message || 'Failed to seed premium subscription')
  }

  const { error: snapshotError } = await admin.rpc('recompute_entitlement_snapshot', {
    p_user_id: owner.userId,
    p_reason: 'browser_smoke_seed',
    p_source_subscription_id: subscription.id,
  })

  if (snapshotError) {
    throw new Error(`Failed to seed premium entitlements: ${snapshotError.message}`)
  }

  return { subscriptionId: subscription.id }
}

async function createContractViaBrowserApi(page, payload) {
  const result = await page.evaluate(async (contractPayload) => {
    const response = await fetch('/api/contracts', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contractPayload),
    })

    const data = await response.json().catch(() => null)
    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  }, payload)

  assert.ok(result.ok, `Contract API failed (${result.status}): ${result.data?.error || 'unknown'}`)
  assert.ok(result.data?.success, `Contract API returned failure: ${result.data?.error || 'unknown'}`)
  return result.data.data
}

async function triggerCheckout(page) {
  const checkoutButton = page.getByRole('button', { name: /Checkout/ }).first()
  await checkoutButton.waitFor({ state: 'visible' })

  const checkoutResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/billing/checkout') && response.request().method() === 'POST'
  )

  await checkoutButton.click()
  const checkoutResponse = await checkoutResponsePromise
  const checkoutPayload = await checkoutResponse.json().catch(() => null)

  return {
    ok: checkoutResponse.ok && Boolean(checkoutPayload?.success),
    status: checkoutResponse.status(),
    payload: checkoutPayload,
  }
}

async function triggerReminderProcessor() {
  const response = await fetch(`${APP_URL}/api/internal/reminders/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dryRun: false,
      limit: 10,
      runAt: new Date().toISOString(),
    }),
  })

  const payload = await response.json().catch(() => null)
  assert.ok(response.ok, `Reminder processor failed (${response.status}): ${payload?.error || 'unknown'}`)
  assert.ok(payload?.success, `Reminder processor returned failure: ${payload?.error || 'unknown'}`)
  return payload.data
}

async function main() {
  const browserUser = await createConfirmedUser('browser_login')
  const premiumUser = await createConfirmedUser('browser_premium')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: APP_URL })

  try {
    await seedPremiumBillingState(premiumUser)

    const page = await context.newPage()
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.error('[browser console]', message.text())
      }
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill(browserUser.email)
    await page.getByLabel('Password').fill(browserUser.password)
    await Promise.all([
      page.waitForURL(/\/dashboard(?:\/.*)?$/),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])

    await page.goto('/dashboard/billing')
    await page.waitForLoadState('networkidle')
    await page.getByText('Live billing').waitFor({ state: 'visible' })
    const checkoutResult = await triggerCheckout(page)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: 'Dashboard' }).last().waitFor({ state: 'visible' })

    await page.evaluate(async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })
    await page.goto('/login')
    await page.getByLabel('Email').fill(premiumUser.email)
    await page.getByLabel('Password').fill(premiumUser.password)
    await Promise.all([
      page.waitForURL(/\/dashboard(?:\/.*)?$/),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])

    await page.goto('/dashboard/contracts')
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: 'Contracts' }).first().waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Add Contract' }).click()

    const contractPayload = {
      name: 'Browser Smoke Contract',
      vendor: 'Smoke Vendor',
      type: 'subscription',
      startDate: isoDateOffset(-1),
      endDate: isoDateOffset(1),
      value: 2500,
      currency: 'USD',
      autoRenew: false,
      renewalTerms: 'Smoke test renewal terms',
      notes: 'Created through browser-authenticated API for smoke testing.',
      tags: ['browser', 'smoke'],
      vendorContact: 'Vendor Owner',
      vendorEmail: 'vendor@example.com',
      reminderDays: [1],
      emailReminders: true,
      notifyEmails: [],
    }

    const createdContract = await createContractViaBrowserApi(page, contractPayload)
    assert.ok(createdContract?.id, 'Browser-authenticated contract creation did not return an id')

    await page.goto('/dashboard/contracts')
    await page.waitForLoadState('networkidle')
    await page.getByText('Browser Smoke Contract').waitFor({ state: 'visible' })

    const reminderContract = await page.evaluate(async (contractId) => {
      const response = await fetch(`/api/contracts/${contractId}`)
      const payload = await response.json().catch(() => null)
      return { ok: response.ok, status: response.status, payload }
    }, createdContract.id)
    assert.ok(reminderContract.ok, `Contract detail failed (${reminderContract.status})`)
    assert.ok(reminderContract.payload?.success, 'Contract detail did not load successfully')

    const reminderResult = await triggerReminderProcessor()
    assert.ok(
      reminderResult.sentCount >= 1,
      'Reminder processor did not send the seeded reminder'
    )

    const { data: reminderRows, error: reminderQueryError } = await admin
      .from('reminders')
      .select('id, sent_at, processing_claimed_at')
      .eq('contract_id', createdContract.id)
      .order('created_at', { ascending: true })

    assert.ifError(reminderQueryError)
    assert.ok(
      Array.isArray(reminderRows) && reminderRows.some((row) => row.sent_at),
      'Reminder row was not marked as sent'
    )

    console.log(
      JSON.stringify(
        {
          ok: true,
          checkout: checkoutResult.ok
            ? {
                ok: true,
                checkoutUrl: checkoutResult.payload?.data?.checkoutUrl ?? null,
              }
            : {
                ok: false,
                status: checkoutResult.status,
                error: checkoutResult.payload?.error ?? 'Checkout request failed',
              },
          loginUserId: browserUser.userId,
          premiumUserId: premiumUser.userId,
          createdContractId: createdContract.id,
          reminderResult,
        },
        null,
        2
      )
    )
  } finally {
    await browser.close().catch(() => undefined)
    await cleanupUsers([browserUser.userId, premiumUser.userId])
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
