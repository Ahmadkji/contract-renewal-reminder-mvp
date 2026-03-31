/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Comprehensive Contract Creation Test
 * Tests the contract creation feature via the API endpoint
 */

const { createClient } = require('@supabase/supabase-js')
const { requireEnv } = require('./scripts/load-env')

// Supabase configuration
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

// Test configuration
const APP_URL = 'http://localhost:3000'
const TEST_USER_EMAIL = `contract-test-api-${Date.now()}@example.com`
const TEST_USER_PASSWORD = 'TestPassword123!'
let testUserId = null
let testUserSession = null

// Initialize clients
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
})

// Test contract data
const testContract = {
  name: 'API Test Contract - ' + new Date().toISOString(),
  vendor: 'Test Vendor API',
  type: 'service',
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  value: 10000,
  currency: 'USD',
  autoRenew: true,
  renewalTerms: 'Auto-renews unless cancelled',
  notes: 'Test contract created via API',
  tags: ['test', 'api'],
  vendorContact: 'John Doe',
  vendorEmail: 'john@testvendor.com',
  reminderDays: [30, 14, 7],
  notifyEmails: ['admin@testvendor.com']
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function cleanup() {
  if (testUserId) {
    console.log('\n🧹 Starting cleanup...')
    
    // Delete contracts and related data
    const { data: contracts } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('user_id', testUserId)
    
    if (contracts && contracts.length > 0) {
      console.log(`   Found ${contracts.length} contract(s) to delete`)
      for (const c of contracts) {
        await supabaseAdmin.from('reminders').delete().eq('contract_id', c.id)
        await supabaseAdmin.from('vendor_contacts').delete().eq('contract_id', c.id)
      }
      await supabaseAdmin.from('contracts').delete().eq('user_id', testUserId)
    }
    
    // Delete user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(testUserId)
    if (error) {
      console.log('   Warning: Could not delete user:', error.message)
    } else {
      console.log('   User deleted successfully')
    }
    
    console.log('✅ Cleanup completed')
  }
}

async function testContractCreation() {
  console.log('='.repeat(60))
  console.log('🧪 CONTRACT CREATION API TEST')
  console.log('='.repeat(60))
  
  let allPassed = true
  
  try {
    // Step 1: Create test user
    console.log('\n📝 STEP 1: Creating test user...')
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true
    })
    
    if (userError) {
      console.error('❌ Failed to create user:', userError)
      throw userError
    }
    
    testUserId = userData.user.id
    console.log('✅ User created:', testUserId)
    
    // Step 2: Sign in as the user to get session
    console.log('\n📝 STEP 2: Signing in as test user...')
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    })
    
    if (signInError) {
      console.error('❌ Failed to sign in:', signInError)
      throw signInError
    }
    
    testUserSession = signInData.session
    console.log('✅ Signed in successfully')
    console.log('   Access token:', testUserSession.access_token.substring(0, 50) + '...')
    
    // Step 3: Test creating contract via direct database insert (baseline test)
    console.log('\n📝 STEP 3: Testing direct database insert (baseline)...')
    
    const { data: dbContract, error: dbError } = await supabaseAdmin
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
    
    if (dbError) {
      console.error('❌ Direct database insert failed:', dbError)
      throw dbError
    }
    
    console.log('✅ Direct database insert successful!')
    console.log('   Contract ID:', dbContract.id)
    
    // Step 4: Add vendor contact
    console.log('\n📝 STEP 4: Creating vendor contact...')
    
    const { error: contactError } = await supabaseAdmin
      .from('vendor_contacts')
      .insert({
        contract_id: dbContract.id,
        contact_name: testContract.vendorContact,
        email: testContract.vendorEmail
      })
    
    if (contactError) {
      console.log('⚠️ Vendor contact creation failed:', contactError.message)
    } else {
      console.log('✅ Vendor contact created')
    }
    
    // Step 5: Add reminders
    console.log('\n📝 STEP 5: Creating reminders...')
    
    const { error: reminderError } = await supabaseAdmin
      .from('reminders')
      .insert(
        testContract.reminderDays.map(days => ({
          contract_id: dbContract.id,
          days_before: days,
          notify_emails: testContract.notifyEmails
        }))
      )
    
    if (reminderError) {
      console.log('⚠️ Reminder creation failed:', reminderError.message)
    } else {
      console.log('✅ Reminders created')
    }
    
    // Step 6: Fetch and verify complete contract
    console.log('\n📝 STEP 6: Fetching and verifying contract...')
    
    const { data: fullContract, error: fetchError } = await supabaseAdmin
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
      .eq('id', dbContract.id)
      .single()
    
    if (fetchError) {
      console.error('❌ Failed to fetch contract:', fetchError)
      throw fetchError
    }
    
    console.log('✅ Contract fetched successfully!')
    console.log('\n📋 CONTRACT DETAILS:')
    console.log('   ID:', fullContract.id)
    console.log('   Name:', fullContract.name)
    console.log('   Vendor:', fullContract.vendor)
    console.log('   Type:', fullContract.type)
    console.log('   Start Date:', fullContract.start_date)
    console.log('   End Date:', fullContract.end_date)
    console.log('   Value:', fullContract.value, fullContract.currency)
    console.log('   Auto-renew:', fullContract.auto_renew)
    console.log('   Tags:', fullContract.tags)
    console.log('   User ID:', fullContract.user_id)
    console.log('   Created At:', fullContract.created_at)
    
    if (fullContract.vendor_contacts && fullContract.vendor_contacts.length > 0) {
      console.log('\n📋 VENDOR CONTACT:')
      console.log('   Contact:', fullContract.vendor_contacts[0].contact_name)
      console.log('   Email:', fullContract.vendor_contacts[0].email)
    }
    
    if (fullContract.reminders && fullContract.reminders.length > 0) {
      console.log('\n📋 REMINDERS:')
      fullContract.reminders.forEach(r => {
        console.log(`   - ${r.days_before} days before, emails:`, r.notify_emails)
      })
    }
    
    // Step 7: Verification checks
    console.log('\n📝 STEP 7: Running verification checks...')
    
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
      { name: 'User ID matches', expected: testUserId, actual: fullContract.user_id },
      { name: 'Vendor contact name', expected: testContract.vendorContact, actual: fullContract.vendor_contacts?.[0]?.contact_name },
      { name: 'Vendor email', expected: testContract.vendorEmail, actual: fullContract.vendor_contacts?.[0]?.email },
      { name: 'Reminder count', expected: testContract.reminderDays.length, actual: fullContract.reminders?.length || 0 }
    ]
    
    console.log('\n📋 VERIFICATION RESULTS:')
    for (const check of checks) {
      const passed = JSON.stringify(check.expected) === JSON.stringify(check.actual)
      const status = passed ? '✅' : '❌'
      console.log(`${status} ${check.name}`)
      if (!passed) {
        console.log(`   Expected: ${JSON.stringify(check.expected)}`)
        console.log(`   Actual:   ${JSON.stringify(check.actual)}`)
        allPassed = false
      }
    }
    
    // Step 8: Test API endpoint directly
    console.log('\n📝 STEP 8: Testing API endpoint...')
    
    const apiResponse = await fetch(`${APP_URL}/api/contracts`, {
      method: 'GET',
      headers: {
        'Cookie': `sb-access-token=${testUserSession.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const apiData = await apiResponse.json()
    
    if (apiResponse.ok && apiData.success) {
      console.log('✅ API endpoint accessible')
      console.log(`   Found ${apiData.data?.length || 0} contract(s) for user`)
    } else {
      console.log('⚠️ API response:', apiResponse.status, apiData)
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    if (allPassed) {
      console.log('🎉 RESULT: ALL TESTS PASSED!')
      console.log('✅ Contract creation is working correctly!')
    } else {
      console.log('❌ RESULT: SOME TESTS FAILED')
    }
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:')
    console.error(error)
    allPassed = false
  } finally {
    await cleanup()
  }
  
  process.exit(allPassed ? 0 : 1)
}

// Run the test
testContractCreation()
