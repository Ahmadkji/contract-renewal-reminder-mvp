import { createClient } from '@/lib/supabase/server'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  email_notifications: boolean
  timezone: string
  created_at: string
  updated_at: string
}

export interface CreateProfileInput {
  user_id: string
  full_name?: string
  avatar_url?: string
  email_notifications?: boolean
  timezone?: string
}

export interface UpdateProfileInput {
  full_name?: string
  avatar_url?: string
  email_notifications?: boolean
  timezone?: string
}

/**
 * Get a user's profile by user ID
 * RLS ensures users can only access their own profile
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }
  
  return data
}

/**
 * Create a new user profile
 * Used during signup to create initial profile
 */
export async function createProfile(input: CreateProfileInput): Promise<Profile | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: input.user_id,
      full_name: input.full_name,
      avatar_url: input.avatar_url,
      email_notifications: input.email_notifications ?? true,
      timezone: input.timezone ?? 'UTC',
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating profile:', error)
    return null
  }
  
  return data
}

/**
 * Update a user's profile
 * RLS ensures users can only update their own profile
 */
export async function updateProfile(
  userId: string,
  updates: UpdateProfileInput
): Promise<Profile | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating profile:', error)
    return null
  }
  
  return data
}

/**
 * Delete a user's profile
 * RLS ensures users can only delete their own profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting profile:', error)
    return false
  }
  
  return true
}
