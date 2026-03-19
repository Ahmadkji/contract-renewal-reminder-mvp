/**
 * Check if stored procedure exists in database
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://gxoaatptsggydujezigr.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2FhdHB0c2dneWR1amV6aWdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MjIwMiwiZXhwIjoyMDg5MTI4MjAyfQ.OyJ08fKugMki19IfB6xAxwzuaBEetgwQyf6liyHYK44'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
})

async function checkProcedure() {
  console.log('Checking if stored procedure exists...')
  
  const { data, error } = await supabase
    .rpc('create_contract_with_relations', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_name: 'test',
      p_vendor: 'test',
      p_type: 'service',
      p_start_date: '2024-01-01',
      p_end_date: '2025-01-01',
      p_value: 0,
      p_currency: 'USD',
      p_auto_renew: false,
      p_renewal_terms: null,
      p_notes: null,
      p_tags: [],
      p_vendor_contact: null,
      p_vendor_email: null,
      p_reminder_days: null,
      p_notify_emails: []
    })
  
  if (error) {
    console.error('Procedure does not exist or error:', error)
  } else {
    console.log('✅ Procedure exists and returned:', data)
  }
}

checkProcedure()
