/**
 * Serialize Supabase User object to plain object
 * 
 * This is required when passing user data from Server Actions
 * to Client Components to avoid React serialization errors.
 * 
 * Only include fields that your application actually needs.
 */
export function serializeUser(user: User | null): SerializedUser | null {
  if (!user) return null
  
  return {
    id: user.id,
    email: user.email ?? '',
    email_confirmed: Boolean(user.email_confirmed_at),
    created_at: user.created_at,
    full_name:
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null,
  }
}

/**
 * Type for serialized user (what client receives)
 */
export interface SerializedUser {
  id: string
  email: string
  email_confirmed: boolean
  created_at: string
  full_name: string | null
}
import type { User } from '@supabase/supabase-js'
