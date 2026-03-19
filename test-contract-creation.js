/**
 * Test script to verify contract creation works via direct INSERT
 * Run with: node test-contract-creation.js
 * 
 * NOTE: This tests the current implementation which uses direct INSERT
 * rather than the dropped stored procedure.
 */

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client with service_role key for admin operations
const supabaseUrl = 'https://gxoaatptsggydujezigr.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2FhdHB0c2dneWR1amV6aWdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MjIwMiwiZXhwIjoyMDg5MTI4MjAyfQ.OyJ08fKugMki19IfB6xAxwzuaBEetgwQyf6liyHYK44'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
})

// Test contract data
const testContract = {
  name: 'Direct Insert Test Contract',
  vendor: 'Test Vendor Inc',
  type: 'service',
  startDate: '2024-01-01',
  endDate: '2025-01-01',
  value: 5000,
  currency: 'USD',
  autoRenew: true,
  renewalTerms: 'Auto-renews annually',
  notes: 'Test contract via direct INSERT',
  tags: ['test', 'direct-insert'],
  vendorContact: 'Jane Smith',
  vendorEmail: 'jane@testvendor.com',
  reminderDays: [30, 14, 7],
  notifyEmails: ['admin@testvendor.com']
}

// Test user email
const testEmail = `contract-test-${Date.now()}@example.com`
const testPassword = 'TestPassword123!'
let testUserId = null

async function cleanup() {
  if (testUserId) {
    // Delete contracts first (foreign key)
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id')
      .eq('user_id', testUserId)
    
    if (contracts && contracts.length > 0) {
      for (const c of contracts) {
        await supabase.from('reminders').delete().eq('contract_id', c.id)
        await supabase.from('vendor_contacts').delete().eq('contract_id', c.id)
      }
      await supabase.from('contracts').delete().eq('user_id', testUserId)
    }
    
    // Delete user
    await supabase.auth.admin.deleteUser(testUserId)
    console.log('🧹 Cleanup completed')
  }
}

async function testDirectInsert() {
  console.log('🧪 Testing direct INSERT contract creation...')
  console.log('='.repeat(50))

  try {
    // Step 0: Create test user first (required for foreign key)
    console.log('\n📝 Step 0: Creating test user...')
    
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    })

    if (userError) {
      console.error('❌ Error creating user:', userError)
      throw userError
    }

    testUserId = userData.user.id
    console.log('✅ Test user created:', testUserId)

    // Step 1: Create contract directly
    console.log('\n📝 Step 1: Creating contract with direct INSERT...')
    console.log('Data:', JSON.stringify(testContract, null, 2))

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        name: testContract.name,
        vendor: testContract.vendor,
        type: testContract.type,
        start_date: testContract.startDate,
        end_date: testContract.endDate,
        value: testContract.value,
        currency: testContract.currency,
        auto_renew: testContract.autoRenew,
        renewal_terms: testContract.renewalTerms,
        notes: testContract.notes,
        tags: testContract.tags,
        user_id: testUserId
      })
      .select()
      .single()

    if (contractError) {
      console.error('❌ Error creating contract:', contractError)
      throw contractError
    }

    console.log('✅ Contract created successfully!')
    console.log('Contract ID:', contract.id)
    const contractId = contract.id

    // Step 2: Create vendor contact
    console.log('\n📝 Step 2: Creating vendor contact...')
    const { error: contactError } = await supabase
      .from('vendor_contacts')
      .insert({
        contract_id: contractId,
        contact_name: testContract.vendorContact,
        email: testContract.vendorEmail
      })

    if (contactError) {
      console.error('⚠️ Error creating vendor contact:', contactError)
      // Non-fatal - continue
    } else {
      console.log('✅ Vendor contact created')
    }

    // Step 3: Create reminders
    console.log('\n📝 Step 3: Creating reminders...')
    const { error: reminderError } = await supabase
      .from('reminders')
      .insert(
        testContract.reminderDays.map(days => ({
          contract_id: contractId,
          days_before: days,
          notify_emails: testContract.notifyEmails
        }))
      )

    if (reminderError) {
      console.error('⚠️ Error creating reminders:', reminderError)
      // Non-fatal - continue
    } else {
      console.log('✅ Reminders created')
    }

    // Step 4: Fetch and verify complete contract
    console.log('\n📝 Step 4: Fetching contract with relations...')
    const { data: fullContract, error: fetchError } = await supabase
      .from('contracts')
      .select(`
        *,
        vendor_contacts (
          contact_name,
          email
        ),
        reminders (
          days_before,
          notify_emails
        )
      `)
      .eq('id', contractId)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching contract:', fetchError)
      throw fetchError
    }

    console.log('✅ Contract fetched with relations:')
    console.log(JSON.stringify(fullContract, null, 2))

    // Step 5: Verify all data
    console.log('\n📝 Step 5: Verification...')
    const checks = [
      { name: 'Contract name', expected: testContract.name, actual: fullContract.name },
      { name: 'Vendor', expected: testContract.vendor, actual: fullContract.vendor },
      { name: 'Type', expected: testContract.type, actual: fullContract.type },
      { name: 'Start date', expected: testContract.startDate, actual: fullContract.start_date },
      { name: 'End date', expected: testContract.endDate, actual: fullContract.end_date },
      { name: 'Value', expected: testContract.value, actual: fullContract.value },
      { name: 'Currency', expected: testContract.currency, actual: fullContract.currency },
      { name: 'Auto-renew', expected: testContract.autoRenew, actual: fullContract.auto_renew },
      { name: 'Tags', expected: testContract.tags, actual: fullContract.tags },
      { name: 'Vendor contact', expected: testContract.vendorContact, actual: fullContract.vendor_contacts?.[0]?.contact_name },
      { name: 'Vendor email', expected: testContract.vendorEmail, actual: fullContract.vendor_contacts?.[0]?.email },
      { name: 'Reminder count', expected: testContract.reminderDays.length, actual: fullContract.reminders?.length || 0 }
    ]

    let allPassed = true
    for (const check of checks) {
      const passed = JSON.stringify(check.expected) === JSON.stringify(check.actual)
      const status = passed ? '✅' : '❌'
      console.log(`${status} ${check.name}: expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(check.actual)}`)
      if (!passed) allPassed = false
    }

    // Step 6: Cleanup
    console.log('\n🧹 Step 6: Cleaning up test data...')
    await cleanup()

    if (allPassed) {
      console.log('\n' + '🎉'.repeat(25))
      console.log('✅ ALL TESTS PASSED!')
      console.log('🎉'.repeat(25))
      process.exit(0)
    } else {
      console.error('\n❌ SOME TESTS FAILED')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    await cleanup()
    process.exit(1)
  }
}

testDirectInsert()
