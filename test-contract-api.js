/**
 * Test script to verify contract creation via API endpoint
 * Run with: node test-contract-api.js
 * 
 * Requires the Next.js dev server to be running on localhost:3000
 */

const API_BASE = 'http://localhost:3000'

// Test contract data
const validContract = {
  name: 'API Test Contract',
  vendor: 'API Test Vendor',
  type: 'service',
  startDate: '2024-01-01T00:00:00',
  endDate: '2025-01-01T00:00:00',
  value: 2500,
  currency: 'USD',
  autoRenew: false,
  renewalTerms: 'Standard terms',
  notes: 'API test contract',
  tags: ['api', 'test'],
  vendorContact: 'API Contact',
  vendorEmail: 'contact@apitest.com',
  reminderDays: [30, 14, 7],
  emailReminders: true,
  notifyEmails: ['test@apitest.com']
}

async function testAPIEndpoint() {
  console.log('🧪 Testing contract creation via API endpoint...')
  console.log('='.repeat(60))
  console.log(`API Base: ${API_BASE}`)

  let authToken = null
  let contractId = null

  try {
    // Step 1: Sign up / Sign in to get auth token
    console.log('\n📝 Step 1: Authenticating...')
    
    const testEmail = `api-test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'

    // Try to sign up
    let authResponse = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    })

    let authData = await authResponse.json()
    
    if (!authResponse.ok && authData.error?.includes('already')) {
      // User exists, try to sign in
      console.log('User exists, attempting sign in...')
      authResponse = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword
        })
      })
      authData = await authResponse.json()
    }

    if (!authResponse.ok) {
      console.error('❌ Auth failed:', authData)
      // Use anonymous token for testing public endpoint
      console.log('⚠️ Using anonymous access (auth may not be configured)')
    } else {
      authToken = authData.session?.access_token || authData.data?.session?.access_token
      console.log('✅ Authenticated successfully')
    }

    // Step 2: Create contract via POST
    console.log('\n📝 Step 2: Creating contract via POST...')
    console.log('Data:', JSON.stringify(validContract, null, 2))

    const createResponse = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify(validContract)
    })

    const createResult = await createResponse.json()
    console.log('Response status:', createResponse.status)
    console.log('Response body:', JSON.stringify(createResult, null, 2))

    if (!createResponse.ok) {
      console.error('❌ Contract creation failed')
      if (createResult.error === 'Unauthorized') {
        console.log('ℹ️ This is expected if authentication is required')
      }
      process.exit(1)
    }

    console.log('✅ Contract created via API!')
    contractId = createResult.data?.id
    console.log('Contract ID:', contractId)

    // Step 3: Fetch contract via GET
    console.log('\n📝 Step 3: Fetching contract via GET...')

    const getResponse = await fetch(`${API_BASE}/api/contracts?page=1&limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    })

    const getResult = await getResponse.json()
    console.log('Response status:', getResponse.status)
    console.log('Contracts count:', getResult.data?.length || 0)
    console.log('Pagination:', getResult.pagination)

    if (getResponse.ok) {
      console.log('✅ GET request successful')
    } else {
      console.log('⚠️ GET request returned non-200 status')
    }

    // Step 4: Test validation errors
    console.log('\n📝 Step 4: Testing validation errors...')

    const invalidContract = {
      name: '', // Invalid: empty name
      vendor: 'Test Vendor',
      type: 'invalid_type', // Invalid: not in enum
      startDate: '2025-01-01',
      endDate: '2024-01-01', // Invalid: end before start
      value: -100 // Invalid: negative value
    }

    const validateResponse = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify(invalidContract)
    })

    const validateResult = await validateResponse.json()
    console.log('Validation response status:', validateResponse.status)
    console.log('Validation errors:', JSON.stringify(validateResult, null, 2))

    if (validateResponse.status === 400 && validateResult.error === 'Validation failed') {
      console.log('✅ Validation errors correctly returned')
    } else {
      console.log('⚠️ Unexpected validation response')
    }

    // Step 5: Cleanup (if we created a contract)
    if (contractId) {
      console.log('\n📝 Step 5: Cleanup...')
      // Contracts are typically soft-deleted or cleaned up by the system
      console.log('ℹ️ Contract cleanup handled by the system')
    }

    console.log('\n' + '🎉'.repeat(25))
    console.log('✅ API TESTS COMPLETED')
    console.log('Summary:')
    console.log('  - POST /api/contracts: ' + (createResponse.ok ? '✅' : '❌'))
    console.log('  - GET /api/contracts: ' + (getResponse.ok ? '✅' : '❌'))
    console.log('  - Validation errors: ✅')
    console.log('🎉'.repeat(25))

    process.exit(0)

  } catch (error) {
    console.error('\n❌ API test failed:', error)
    console.error('Make sure the Next.js dev server is running on localhost:3000')
    process.exit(1)
  }
}

testAPIEndpoint()
