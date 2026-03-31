/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Check if stored procedure exists in database
 */

const { createClient } = require('@supabase/supabase-js')
const { requireEnv } = require('./scripts/load-env')

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

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
