/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Create a system user for contract creation when authentication is disabled
 * Run with: node create-system-user.js
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

async function createSystemUser() {
  console.log('Creating system user...')
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'system@contract-manager.app',
    password: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    email_confirm: true,
    user_metadata: {
      role: 'system',
      description: 'System user for contract management when authentication is disabled'
    }
  })
  
  if (error) {
    console.error('Error creating system user:', error)
    throw error
  }
  
  console.log('✅ System user created successfully!')
  console.log('User ID:', data.user.id)
  console.log('Email:', data.user.email)
  console.log('\nAdd this to your .env.local file:')
  console.log(`SYSTEM_USER_ID=${data.user.id}`)
  
  return data.user.id
}

createSystemUser()
