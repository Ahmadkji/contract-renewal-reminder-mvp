/**
 * Apply stored procedure migration directly
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://gxoaatptsggydujezigr.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2FhdHB0c2dneWR1amV6aWdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MjIwMiwiZXhwIjoyMDg5MTI4MjAyfQ.OyJ08fKugMki19IfB6xAxwzuaBEetgwQyf6liyHYK44'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
})

async function applyMigration() {
  console.log('Reading migration file...')
  const migrationSQL = fs.readFileSync('./supabase/migrations/20260317000001_create_contract_stored_procedure.sql', 'utf8')
  
  console.log('Applying stored procedure migration...')
  
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
  
  if (error) {
    console.error('Error applying migration:', error)
    throw error
  }
  
  console.log('✅ Migration applied successfully!')
  console.log('Result:', data)
}

applyMigration()
