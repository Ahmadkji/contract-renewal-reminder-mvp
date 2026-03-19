/**
 * Test script to verify contract creation via API endpoint
 * Run with: node test-api-contract-creation.js
 */

const testContract = {
  name: 'API Test Contract',
  vendor: 'API Test Vendor',
  type: 'service',
  startDate: '2024-01-01T00:00:00',
  endDate: '2025-01-01T00:00:00',
  value: 1000,
  currency: 'USD',
  autoRenew: false,
  renewalTerms: undefined,
  notes: 'API test contract creation',
  tags: ['api', 'test'],
  vendorContact: 'API Test',
  vendorEmail: 'api@example.com',
  reminderDays: [30, 14, 7],
  notifyEmails: ['api@example.com']
}

async function testAPIEndpoint() {
  console.log('Testing contract creation via API endpoint...')
  
  try {
    const response = await fetch('http://localhost:3000/api/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testContract)
    })

    const result = await response.json()

    console.log('Response status:', response.status)
    console.log('Response body:', result)

    if (!response.ok) {
      console.error('❌ API request failed')
      process.exit(1)
    }

    if (result.success) {
      console.log('✅ Contract created successfully via API!')
      console.log('Contract ID:', result.data.id)
      
      // Verify by fetching the contract
      const verifyResponse = await fetch(`http://localhost:3000/api/contracts/${result.data.id}`)
      const verifyResult = await verifyResponse.json()
      
      if (verifyResponse.ok && verifyResult.success) {
        console.log('✅ Contract verified via GET endpoint!')
        console.log('Contract data:', verifyResult.data)
      } else {
        console.error('❌ Failed to verify contract')
        process.exit(1)
      }
    } else {
      console.error('❌ Contract creation failed:', result.error)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

testAPIEndpoint()
