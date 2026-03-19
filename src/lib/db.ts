// Export proper Next.js 15 SSR clients for database operations
export { createClient as createClientClient } from './supabase/client'
export { createClient as createClientServer } from './supabase/server'