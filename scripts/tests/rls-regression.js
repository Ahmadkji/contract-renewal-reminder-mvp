/* eslint-disable no-console */

const assert = require('node:assert/strict')
const {
  APP_URL,
  admin,
  anon,
  cleanupUsers,
  createConfirmedUser,
  loginViaAuthRoute,
  makeRequestHeaders,
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

async function createOwnerContract(ownerCookie) {
  const body = {
    name: 'RLS Owner Contract',
    vendor: 'Owner Vendor',
    type: 'subscription',
    startDate: isoDateOffset(-1),
    endDate: isoDateOffset(1),
    value: 1200,
    currency: 'USD',
    autoRenew: false,
    renewalTerms: 'Annual renewal',
    notes: 'Created by the RLS regression probe.',
    tags: ['security', 'smoke'],
    reminderDays: [1],
    emailReminders: false,
    notifyEmails: [],
  }

  const response = await fetch(`${APP_URL}/api/contracts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...makeRequestHeaders(ownerCookie),
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Failed to create owner contract (${response.status})`)
  }

  return payload.data
}

async function assertSelectDenied(client, table, filterColumn, filterValue, label) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq(filterColumn, filterValue)

  assert.ok(!error, `${label}: unexpected select error: ${error?.message || 'unknown'}`)
  assert.equal(Array.isArray(data) ? data.length : 0, 0, `${label}: cross-user select leaked rows`)
}

async function assertUpdateDeniedAndUnchanged({
  attackerClient,
  adminClient,
  table,
  filterColumn,
  filterValue,
  updateValues,
  verifyColumn,
  expectedValue,
  label,
}) {
  const { error: updateError } = await attackerClient
    .from(table)
    .update(updateValues)
    .eq(filterColumn, filterValue)

  if (updateError) {
    const lower = updateError.message.toLowerCase()
    assert.ok(
      lower.includes('permission denied') || lower.includes('row-level security') || lower.includes('violates'),
      `${label}: unexpected update error: ${updateError.message}`
    )
  }

  const { data: current, error: verifyError } = await adminClient
    .from(table)
    .select(verifyColumn)
    .eq(filterColumn, filterValue)
    .single()

  assert.ifError(verifyError)
  assert.equal(current?.[verifyColumn], expectedValue, `${label}: attacker modified protected row`)
}

async function seedBillingState(owner) {
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
    throw new Error(`Failed to seed billing customer: ${customerError.message}`)
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
    throw new Error(subscriptionError?.message || 'Failed to seed billing subscription')
  }

  const { error: snapshotError } = await admin.rpc('recompute_entitlement_snapshot', {
    p_user_id: owner.userId,
    p_reason: 'rls_regression_seed',
    p_source_subscription_id: subscription.id,
  })

  if (snapshotError) {
    throw new Error(`Failed to seed entitlement snapshot: ${snapshotError.message}`)
  }

  return {
    providerCustomerId,
    providerSubscriptionId,
    subscriptionId: subscription.id,
  }
}

async function main() {
  const owner = await createConfirmedUser('rls_owner')
  const attacker = await createConfirmedUser('rls_attacker')

  try {
    const ownerLogin = await loginViaAuthRoute(owner.email, owner.password)

    await admin.from('profiles').upsert(
      {
        user_id: owner.userId,
        full_name: 'RLS Owner',
        avatar_url: null,
        email_notifications: true,
        timezone: 'UTC',
      },
      { onConflict: 'user_id' }
    )

    await admin.from('profiles').upsert(
      {
        user_id: attacker.userId,
        full_name: 'RLS Attacker',
        avatar_url: null,
        email_notifications: true,
        timezone: 'UTC',
      },
      { onConflict: 'user_id' }
    )

    const contract = await createOwnerContract(ownerLogin.cookie)
    const billing = await seedBillingState(owner)

    const { data: ownerContract, error: ownerContractError } = await admin
      .from('contracts')
      .select('id, name, user_id')
      .eq('id', contract.id)
      .single()

    assert.ifError(ownerContractError)
    assert.equal(ownerContract.user_id, owner.userId, 'Owner contract was not seeded correctly')

    const attackerClient = anon
    await attackerClient.auth.signInWithPassword({
      email: attacker.email,
      password: attacker.password,
    })

    await assertSelectDenied(attackerClient, 'contracts', 'id', contract.id, 'contracts')
    await assertSelectDenied(attackerClient, 'profiles', 'user_id', owner.userId, 'profiles')
    await assertSelectDenied(attackerClient, 'billing_customers', 'user_id', owner.userId, 'billing_customers')
    await assertSelectDenied(attackerClient, 'billing_subscriptions', 'user_id', owner.userId, 'billing_subscriptions')
    await assertSelectDenied(attackerClient, 'entitlement_snapshots', 'user_id', owner.userId, 'entitlement_snapshots')

    await assertUpdateDeniedAndUnchanged({
      attackerClient,
      adminClient: admin,
      table: 'contracts',
      filterColumn: 'id',
      filterValue: contract.id,
      updateValues: { name: 'tampered-contract-name' },
      verifyColumn: 'name',
      expectedValue: 'RLS Owner Contract',
      label: 'contracts update',
    })

    await assertUpdateDeniedAndUnchanged({
      attackerClient,
      adminClient: admin,
      table: 'profiles',
      filterColumn: 'user_id',
      filterValue: owner.userId,
      updateValues: { full_name: 'Tampered Profile' },
      verifyColumn: 'full_name',
      expectedValue: 'RLS Owner',
      label: 'profiles update',
    })

    await assertUpdateDeniedAndUnchanged({
      attackerClient,
      adminClient: admin,
      table: 'billing_subscriptions',
      filterColumn: 'id',
      filterValue: billing.subscriptionId,
      updateValues: { status: 'canceled' },
      verifyColumn: 'status',
      expectedValue: 'active',
      label: 'billing subscriptions update',
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          ownerUserId: owner.userId,
          attackerUserId: attacker.userId,
          contractId: contract.id,
          subscriptionId: billing.subscriptionId,
        },
        null,
        2
      )
    )
  } finally {
    await cleanupUsers([owner.userId, attacker.userId])
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
