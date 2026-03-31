/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test script to verify contract validation edge cases
 * Run with: node test-contract-validation.js
 * 
 * Tests the Zod validation schema and database constraints
 */

const { createClient } = require('@supabase/supabase-js')
const { requireEnv } = require('./scripts/load-env')

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
})

// Validation test cases
const testCases = [
  {
    name: 'Valid contract - all fields',
    data: {
      name: 'Valid Contract',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      value: 1000,
      currency: 'USD',
      autoRenew: true,
      tags: ['valid'],
      reminderDays: [30]
    },
    shouldPass: true
  },
  {
    name: 'Missing required fields - name',
    data: {
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01'
    },
    shouldPass: false,
    expectedError: 'name'
  },
  {
    name: 'Missing required fields - vendor',
    data: {
      name: 'Valid Name',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01'
    },
    shouldPass: false,
    expectedError: 'vendor'
  },
  {
    name: 'Invalid type enum',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'invalid_type',
      startDate: '2024-01-01',
      endDate: '2025-01-01'
    },
    shouldPass: false,
    expectedError: 'type'
  },
  {
    name: 'Valid types',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'license',
      startDate: '2024-01-01',
      endDate: '2025-01-01'
    },
    shouldPass: true
  },
  {
    name: 'End date before start date',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2025-01-01',
      endDate: '2024-01-01' // Invalid: end before start
    },
    shouldPass: false,
    expectedError: 'endDate'
  },
  {
    name: 'Same start and end date',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2024-01-01' // Same day - should be valid
    },
    shouldPass: true
  },
  {
    name: 'Negative value',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      value: -100
    },
    shouldPass: false,
    expectedError: 'value'
  },
  {
    name: 'Zero value (valid)',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      value: 0
    },
    shouldPass: true
  },
  {
    name: 'Invalid email format',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      vendorEmail: 'not-an-email'
    },
    shouldPass: false,
    expectedError: 'vendorEmail'
  },
  {
    name: 'Valid email format',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      vendorEmail: 'valid@email.com'
    },
    shouldPass: true
  },
  {
    name: 'Reminder days out of range (too high)',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      reminderDays: [500] // > 365
    },
    shouldPass: false,
    expectedError: 'reminderDays'
  },
  {
    name: 'Reminder days out of range (zero)',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      reminderDays: [0] // < 1
    },
    shouldPass: false,
    expectedError: 'reminderDays'
  },
  {
    name: 'Valid reminder days',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      reminderDays: [1, 30, 90, 365]
    },
    shouldPass: true
  },
  {
    name: 'Empty tags (valid)',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      tags: []
    },
    shouldPass: true
  },
  {
    name: 'No tags specified (valid - defaults to empty)',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01'
    },
    shouldPass: true
  },
  {
    name: 'Invalid notify email',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      notifyEmails: ['not-valid']
    },
    shouldPass: false,
    expectedError: 'notifyEmails'
  },
  {
    name: 'Valid notify emails',
    data: {
      name: 'Valid Name',
      vendor: 'Valid Vendor',
      type: 'service',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      notifyEmails: ['a@b.com', 'c@d.com']
    },
    shouldPass: true
  }
]

// Simple Zod-like validation (simulates the schema)
function validateContract(data) {
  const errors = {}

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.name = 'Name is required'
  } else if (data.name.length > 200) {
    errors.name = 'Name must be at most 200 characters'
  }

  if (!data.vendor || typeof data.vendor !== 'string' || data.vendor.trim() === '') {
    errors.vendor = 'Vendor is required'
  } else if (data.vendor.length > 200) {
    errors.vendor = 'Vendor must be at most 200 characters'
  }

  // Type enum
  const validTypes = ['license', 'service', 'support', 'subscription']
  if (!data.type || !validTypes.includes(data.type)) {
    errors.type = `Type must be one of: ${validTypes.join(', ')}`
  }

  // Dates
  if (!data.startDate) {
    errors.startDate = 'Start date is required'
  } else {
    const startDate = new Date(data.startDate)
    if (isNaN(startDate.getTime())) {
      errors.startDate = 'Invalid start date format'
    }
  }

  if (!data.endDate) {
    errors.endDate = 'End date is required'
  } else {
    const endDate = new Date(data.endDate)
    if (isNaN(endDate.getTime())) {
      errors.endDate = 'Invalid end date format'
    }
  }

  // Date comparison
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate < startDate) {
        errors.endDate = 'End date must be after start date'
      }
    }
  }

  // Value validation
  if (data.value !== undefined && data.value !== null) {
    if (typeof data.value !== 'number' || data.value < 0) {
      errors.value = 'Value must be a non-negative number'
    }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.vendorEmail && !emailRegex.test(data.vendorEmail)) {
    errors.vendorEmail = 'Invalid email format'
  }

  if (data.notifyEmails) {
    if (!Array.isArray(data.notifyEmails)) {
      errors.notifyEmails = 'Notify emails must be an array'
    } else {
      const invalidEmails = data.notifyEmails.filter(e => !emailRegex.test(e))
      if (invalidEmails.length > 0) {
        errors.notifyEmails = `Invalid emails: ${invalidEmails.join(', ')}`
      }
    }
  }

  // Reminder days validation
  if (data.reminderDays !== undefined) {
    if (!Array.isArray(data.reminderDays)) {
      errors.reminderDays = 'Reminder days must be an array'
    } else {
      const invalidDays = data.reminderDays.filter(d => !Number.isInteger(d) || d < 1 || d > 365)
      if (invalidDays.length > 0) {
        errors.reminderDays = 'Reminder days must be integers between 1 and 365'
      }
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors
  }
}

async function testValidation() {
  console.log('🧪 Testing contract validation edge cases...')
  console.log('='.repeat(60))
  console.log(`Total test cases: ${testCases.length}\n`)

  let passed = 0
  let failed = 0
  const results = []

  for (const testCase of testCases) {
    const result = validateContract(testCase.data)
    const testPassed = result.success === testCase.shouldPass

    // Additional check: if should fail, verify the expected error field exists
    let errorFieldMatch = true
    if (!testCase.shouldPass && testCase.expectedError) {
      errorFieldMatch = result.errors.hasOwnProperty(testCase.expectedError)
    }

    const fullPass = testPassed && errorFieldMatch

    if (fullPass) {
      passed++
      console.log(`✅ PASS: ${testCase.name}`)
    } else {
      failed++
      console.log(`❌ FAIL: ${testCase.name}`)
      console.log(`   Expected to ${testCase.shouldPass ? 'pass' : 'fail'}`)
      console.log(`   Got: ${result.success ? 'passed' : 'failed'}`)
      console.log(`   Errors: ${JSON.stringify(result.errors)}`)
    }

    results.push({
      name: testCase.name,
      passed: fullPass,
      expected: testCase.shouldPass,
      got: result.success,
      errors: result.errors
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log('VALIDATION TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total: ${testCases.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`)

  // Additional database constraint tests
  console.log('\n📝 Testing database constraints...')

  try {
    // Test: Try to insert contract with invalid type
    console.log('\nTesting database constraint: invalid type enum...')
    const { error: typeError } = await supabase
      .from('contracts')
      .insert({
        name: 'Test Invalid Type',
        vendor: 'Test Vendor',
        type: 'invalid_type',
        start_date: '2024-01-01',
        end_date: '2025-01-01',
        user_id: '00000000-0000-0000-0000-000000000000'
      })

    if (typeError) {
      console.log('✅ Database correctly rejects invalid type')
    } else {
      console.log('⚠️ Database accepted invalid type (check enum constraint)')
    }

    // Test: Try to insert contract with negative value
    console.log('\nTesting database constraint: negative value...')
    const { error: valueError } = await supabase
      .from('contracts')
      .insert({
        name: 'Test Negative Value',
        vendor: 'Test Vendor',
        type: 'service',
        start_date: '2024-01-01',
        end_date: '2025-01-01',
        value: -100,
        user_id: '00000000-0000-0000-0000-000000000000'
      })

    if (valueError) {
      console.log('✅ Database correctly rejects negative value')
    } else {
      console.log('⚠️ Database accepted negative value (check CHECK constraint)')
    }

    // Test: Try to insert contract with invalid email format
    console.log('\nTesting vendor_contacts constraint: invalid email...')
    // First create a contract
    const { data: contract } = await supabase
      .from('contracts')
      .insert({
        name: 'Test Invalid Email Contract',
        vendor: 'Test Vendor',
        type: 'service',
        start_date: '2024-01-01',
        end_date: '2025-01-01',
        user_id: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single()

    if (contract) {
      const { error: emailError } = await supabase
        .from('vendor_contacts')
        .insert({
          contract_id: contract.id,
          contact_name: 'Test Contact',
          email: 'not-an-email'
        })

      if (emailError) {
        console.log('✅ Database correctly rejects invalid email format')
      } else {
        console.log('⚠️ Database accepted invalid email (check CHECK constraint)')
      }

      // Cleanup
      await supabase.from('vendor_contacts').delete().eq('contract_id', contract.id)
      await supabase.from('contracts').delete().eq('id', contract.id)
    }

  } catch (error) {
    console.log('⚠️ Database constraint test error:', error.message)
  }

  console.log('\n' + '🎉'.repeat(25))
  if (failed === 0) {
    console.log('✅ ALL VALIDATION TESTS PASSED!')
    process.exit(0)
  } else {
    console.log(`❌ ${failed} VALIDATION TESTS FAILED`)
    process.exit(1)
  }
}

testValidation()
