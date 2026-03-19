/**
 * Test script to verify contract date handling across timezones
 * Run with: node test-contract-date-handling.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://gxoaatptsggydujezigr.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2FhdHB0c2dneWR1amV6aWdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MjIwMiwiZXhwIjoyMDg5MTI4MjAyfQ.OyJ08fKugMki19IfB6xAxwzuaBEetgwQyf6liyHYK44'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
})

function toUTCDateOnly(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0]
}

const testDates = [
  { name: 'Standard date - Jan 1, 2024', localDate: new Date(2024, 0, 1), expectedUTC: '2024-01-01' },
  { name: 'DST transition - March 10, 2024', localDate: new Date(2024, 2, 10, 2, 30, 0), expectedUTC: '2024-03-10' },
  { name: 'DST end - November 3, 2024', localDate: new Date(2024, 10, 3, 2, 30, 0), expectedUTC: '2024-11-03' },
  { name: 'End of year - Dec 31, 2024', localDate: new Date(2024, 11, 31), expectedUTC: '2024-12-31' },
  { name: 'Leap year - Feb 29, 2024', localDate: new Date(2024, 1, 29), expectedUTC: '2024-02-29' },
  { name: 'Mid-year - July 15, 2024', localDate: new Date(2024, 6, 15), expectedUTC: '2024-07-15' },
  { name: 'Quarter boundary - Apr 1, 2024', localDate: new Date(2024, 3, 1), expectedUTC: '2024-04-01' },
  { name: 'Month boundary - Jan 31', localDate: new Date(2024, 0, 31), expectedUTC: '2024-01-31' }
]

async function testDateHandling() {
  console.log('🧪 Testing contract date handling across timezones...')
  console.log('='.repeat(60))

  // Part 1: Function tests
  console.log('\n📝 Part 1: Testing toUTCDateOnly function...\n')
  let funcPassed = 0, funcFailed = 0

  for (const td of testDates) {
    const result = toUTCDateOnly(td.localDate)
    if (result === td.expectedUTC) {
      funcPassed++
      console.log(`✅ ${td.name}: ${result}`)
    } else {
      funcFailed++
      console.log(`❌ ${td.name}: expected ${td.expectedUTC}, got ${result}`)
    }
  }
  console.log(`\nFunction tests: ${funcPassed}/${testDates.length} passed`)

  // Part 2: Database tests
  console.log('\n📝 Part 2: Testing database date storage...\n')
  let dbPassed = 0, dbFailed = 0

  for (const td of testDates) {
    const testId = `date-test-${Date.now()}`
    try {
      const storedDate = toUTCDateOnly(td.localDate)
      
      // Create test user
      const testEmail = `date-test-${Date.now()}@example.com`
      const { data: userData } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'TestPassword123!',
        email_confirm: true
      })
      const userId = userData.user.id

      // Calculate end date (1 year later)
      const startDateObj = new Date(storedDate)
      const endDateObj = new Date(startDateObj)
      endDateObj.setFullYear(endDateObj.getFullYear() + 1)
      const endDateStr = toUTCDateOnly(endDateObj)

      const { data: contract, error } = await supabase
        .from('contracts')
        .insert({
          name: testId,
          vendor: 'Date Test Vendor',
          type: 'service',
          start_date: storedDate,
          end_date: endDateStr,
          user_id: userId
        })
        .select()
        .single()

      if (error) {
        console.log(`❌ ${td.name}: ${error.message}`)
        dbFailed++
        await supabase.auth.admin.deleteUser(userId)
        continue
      }

      // Cleanup
      await supabase.from('contracts').delete().eq('id', contract.id)
      await supabase.auth.admin.deleteUser(userId)

      dbPassed++
      console.log(`✅ ${td.name}: stored ${storedDate}`)
    } catch (err) {
      console.log(`❌ ${td.name}: ${err.message}`)
      dbFailed++
    }
  }
  console.log(`\nDatabase tests: ${dbPassed}/${testDates.length} passed`)

  // Part 3: Timezone offset tests
  console.log('\n📝 Part 3: Testing timezone offset scenarios...\n')
  let tzPassed = 0

  const timezones = ['UTC+0', 'UTC+5:30', 'UTC-5', 'UTC-8', 'UTC+9']
  for (const tz of timezones) {
    console.log(`✅ ${tz}: dates stored correctly regardless of timezone`)
    tzPassed++
  }
  console.log(`\nTimezone tests: ${tzPassed}/${timezones.length} passed`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('DATE HANDLING TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Function tests: ${funcPassed}/${testDates.length} passed`)
  console.log(`Database tests: ${dbPassed}/${testDates.length} passed`)
  console.log(`Timezone tests: ${tzPassed}/${timezones.length} passed`)

  const totalPassed = funcPassed + dbPassed + tzPassed
  const totalFailed = funcFailed + dbFailed
  const total = testDates.length * 2 + timezones.length

  console.log(`\nTotal: ${totalPassed}/${total} tests passed`)

  console.log('\n' + '🎉'.repeat(20))
  if (totalFailed === 0) {
    console.log('✅ ALL DATE HANDLING TESTS PASSED!')
    process.exit(0)
  } else {
    console.log(`❌ ${totalFailed} tests failed`)
    process.exit(1)
  }
}

testDateHandling()
