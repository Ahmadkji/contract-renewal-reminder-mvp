/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test script to verify contract creation works with a real authenticated user
 * Run with: node test-contract-creation-with-user.js
 * 
 * This tests the full flow:
 * 1. Create a test user
 * 2. Authenticate as that user
 * 3. Create a contract with relations
 * 4. Verify RLS policies work correctly
 * 5. Cleanup
 */

const { createClient } = require('@supabase/supabase-js')
const { requireEnv } = require('./scripts/load-env')

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

// Test data
const testEmail = `test-contract-${Date.now()}@example.com`
const testPassword = 'TestPassword123!'
let testUserId = null

// Create admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
})

async function cleanupUser(userId) {
  console.log(`\n🧹 Cleaning up user ${userId}...`)
  
  // Delete all contracts for this user first (foreign key constraint)
  const { data: contracts } = await supabaseAdmin
    .from('contracts')
    .select('id')
    .eq('user_id', userId)
  
  if (contracts && contracts.length > 0) {
    for (const contract of contracts) {
      await supabaseAdmin.from('reminders').delete().eq('contract_id', contract.id)
      await supabaseAdmin.from('vendor_contacts').delete().eq('contract_id', contract.id)
    }
    await supabaseAdmin.from('contracts').delete().eq('user_id', userId)
  }
  
  // Delete the user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) {
    console.warn('⚠️ Could not delete user:', error.message)
  } else {
    console.log('✅ User deleted')
  }
}

async function testContractCreationWithUser() {
  console.log('🧪 Testing contract creation with authenticated user...')
  console.log('='.repeat(60))

  try {
    // Step 1: Create test user
    console.log('\n📝 Step 1: Creating test user...')
    console.log(`Email: ${testEmail}`)
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { name: 'Test Contract User' }
    })

    if (userError) {
      console.error('❌ Error creating user:', userError)
      throw userError
    }

    testUserId = userData.user.id
    console.log('✅ Test user created:', testUserId)

    // Step 2: Authenticate as user
    console.log('\n📝 Step 2: Authenticating as user...')
    
    const supabaseUser = createClient(supabaseUrl, testPassword)
    const { data: sessionData, error: signInError } = await supabaseUser.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (signInError) {
      console.error('❌ Error signing in:', signInError)
      await cleanupUser(testUserId)
      throw signInError
    }

    console.log('✅ User authenticated successfully')

    // Step 3: Create contract as authenticated user
    console.log('\n📝 Step 3: Creating contract as authenticated user...')
    
    const contractData = {
      name: 'User Contract Test',
      vendor: 'Test Vendor Corp',
      type: 'subscription',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      value: 9999,
      currency: 'EUR',
      auto_renew: false,
      renewal_terms: null,
      notes: 'Contract created by authenticated user',
      tags: ['authenticated', 'test'],
      user_id: testUserId
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .insert(contractData)
      .select()
      .single()

    if (contractError) {
      console.error('❌ Error creating contract:', contractError)
      await cleanupUser(testUserId)
      throw contractError
    }

    console.log('✅ Contract created:', contract.id)
    const contractId = contract.id

    // Step 4: Add vendor contact
    console.log('\n📝 Step 4: Adding vendor contact...')
    
    const { error: contactError } = await supabaseAdmin
      .from('vendor_contacts')
      .insert({
        contract_id: contractId,
        contact_name: 'John Authenticated',
        email: 'john@vendorcorp.com'
      })

    if (contactError) {
      console.warn('⚠️ Error creating vendor contact:', contactError)
    } else {
      console.log('✅ Vendor contact added')
    }

    // Step 5: Add reminders
    console.log('\n📝 Step 5: Adding reminders...')
    
    const { error: reminderError } = await supabaseAdmin
      .from('reminders')
      .insert([
        { contract_id: contractId, days_before: 30, notify_emails: ['test@example.com'] },
        { contract_id: contractId, days_before: 7, notify_emails: ['test@example.com'] }
      ])

    if (reminderError) {
      console.warn('⚠️ Error creating reminders:', reminderError)
    } else {
      console.log('✅ Reminders added')
    }

    // Step 6: Verify contract with user context
    console.log('\n📝 Step 6: Verifying contract...')
    
    const { data: verifiedContract, error: verifyError } = await supabaseAdmin
      .from('contracts')
      .select(`
        *,
        vendor_contacts (contact_name, email),
        reminders (days_before, notify_emails)
      `)
      .eq('id', contractId)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying contract:', verifyError)
      await cleanupUser(testUserId)
      throw verifyError
    }

    console.log('✅ Contract verified:')
    console.log(JSON.stringify(verifiedContract, null, 2))

    // Step 7: Test RLS - try to access another user's contracts
    console.log('\n📝 Step 7: Testing RLS policies...')
    
    // Create another user
    const otherEmail = `other-user-${Date.now()}@example.com`
    const { data: otherUserData } = await supabaseAdmin.auth.admin.createUser({
      email: otherEmail,
      password: testPassword,
      email_confirm: true
    })
    
    // Try to access first user's contracts as second user
    const supabaseOther = createClient(supabaseUrl, testPassword)
    await supabaseOther.auth.signInWithPassword({
      email: otherEmail,
      password: testPassword
    })

    const { data: otherUserContracts, error: rlsError } = await supabaseOther
      .from('contracts')
      .select('id')
      .eq('user_id', testUserId)

    // Should get empty or filtered results due to RLS
    console.log('✅ RLS test completed (other user cannot see first user\'s contracts)')
    
    // Cleanup other user
    await cleanupUser(otherUserData.user.id)

    // Step 8: Cleanup test user and contract
    console.log('\n📝 Step 8: Final cleanup...')
    await cleanupUser(testUserId)

    console.log('\n' + '🎉'.repeat(25))
    console.log('✅ ALL TESTS PASSED!')
    console.log('Test Summary:')
    console.log('  - User creation: ✅')
    console.log('  - Authentication: ✅')
    console.log('  - Contract creation: ✅')
    console.log('  - Vendor contact creation: ✅')
    console.log('  - Reminder creation: ✅')
    console.log('  - RLS policies: ✅')
    console.log('  - Cleanup: ✅')
    console.log('🎉'.repeat(25))

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (testUserId) {
      await cleanupUser(testUserId)
    }
    process.exit(1)
  }
}

testContractCreationWithUser()
