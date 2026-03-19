'use server'

import { redirect } from 'next/navigation'
import { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema
} from '@/lib/validation/auth-schema'
import { createClient, validateSession } from '@/lib/supabase/server'
import { mapSupabaseError, formatZodErrors, AuthError } from '@/lib/errors/auth-errors'
import { env } from '@/lib/env'
import { updateProfile } from '@/lib/db/profiles'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

/**
 * Signup action - Creates new user account with validation
 * Validates input, creates Supabase user, creates profile
 */
export async function signup(formData: FormData) {
  //1. Validate input with Zod
  const validated = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName')
  })
  
  if (!validated.success) {
    return { 
      success: false, 
      errors: formatZodErrors(validated.error.flatten().fieldErrors) 
    }
  }
  
  try {
    // 2. Create Supabase user
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: validated.data.email,
      password: validated.data.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email`,
        data: {
          full_name: validated.data.fullName
        }
      }
    })
    
    if (error) {
      throw mapSupabaseError(error)
    }
    
    // 3. Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: validated.data.fullName || data.user.email?.split('@')[0]
        })
      
      if (profileError) {
        console.error('Failed to create profile:', profileError)
        // Continue anyway - user can create profile later
      }
    }
    
    return { success: true, message: 'Check your email to verify your account' }
  } catch (error) {
    if (error instanceof AuthError) {
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      }
    }
    return { 
      success: false, 
      error: 'An error occurred during signup. Please try again.' 
    }
  }
}

/**
 * Login action - Authenticates user with validation
 * Validates input, signs in with Supabase, returns success for client navigation
 */
export async function login(formData: FormData) {
  // 1. Validate input with Zod
  const validated = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  })
  
  if (!validated.success) {
    return { 
      success: false, 
      errors: formatZodErrors(validated.error.flatten().fieldErrors) 
    }
  }
  
  try {
    // 2. Sign in with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.data.email,
      password: validated.data.password
    })
    
    if (error) {
      // Enhanced debug logging to capture exact error
      console.error('=== SUPABASE LOGIN ERROR ===')
      console.error('Full error object:', JSON.stringify(error, null, 2))
      console.error('Error message:', error.message)
      console.error('Error status:', error.status)
      console.error('Error code:', error.code)
      console.error('Error name:', error.name)
      console.error('Error type:', typeof error)
      console.error('Error keys:', Object.keys(error || {}))
      console.error('============================')
      throw mapSupabaseError(error)
    }
    
    // 3. Verify session was created properly
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.error('Session creation failed after login:', { sessionError, session })
      throw new AuthError(
        'Failed to establish session. Please try again.',
        'SESSION_CREATION_FAILED',
        500
      )
    }
    
    console.log('Login successful, session established for user:', session.user.id)
    
    // 4. Cookies are set in HTTP response headers by Supabase
    // Cannot verify in same request - trust Supabase's session creation
    // Cookies will be sent to browser after this function completes
    
    // 5. Return success with user data for client navigation
    return { 
      success: true, 
      user: data.user,
      session: {
        accessToken: session.access_token,
        expiresAt: session.expires_at
      },
      message: 'Login successful'
    }
  } catch (error) {
    console.error('Login catch block error:', error)
    if (error instanceof AuthError) {
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      }
    }
    return { 
      success: false, 
      error: 'An error occurred during login. Please try again.' 
    }
  }
}

/**
 * Logout action - Signs out current user with verification
 * Verifies session is destroyed and clears all cached data
 */
export async function logout(formData?: FormData) {
  const supabase = await createClient()
  
  // 1. Attempt sign out
  const { error: signOutError } = await supabase.auth.signOut()
  
  if (signOutError) {
    console.error('[Logout] Sign out failed:', signOutError)
    return { 
      success: false, 
      error: 'Failed to logout. Please try again.' 
    }
  }
  
  // 2. Verify session is destroyed
  const { data: { user }, error: sessionError } = await supabase.auth.getUser()
  
  if (user) {
    console.error('[Logout] Session still exists after logout:', user)
    return { 
      success: false, 
      error: 'Failed to properly destroy session. Please try again.' 
    }
  }
  
  // 3. Clear any remaining cookies manually
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  allCookies.forEach(cookie => {
    if (cookie.name.includes('sb-') || 
        cookie.name.includes('supabase') ||
        cookie.name.includes('session')) {
      cookieStore.delete(cookie.name)
    }
  })
  
  // 4. Revalidate all cached data
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/contracts')
  revalidatePath('/api/contracts')
  
  console.log('[Logout] Session destroyed successfully')
  
  return { 
    success: true, 
    message: 'Logged out successfully' 
  }
}

/**
 * Forgot password action - Sends password reset email
 * Validates email, sends reset link via Supabase
 */
export async function forgotPassword(formData: FormData) {
  // 1. Validate input with Zod
  const validated = forgotPasswordSchema.safeParse({
    email: formData.get('email')
  })
  
  if (!validated.success) {
    return { 
      success: false, 
      errors: formatZodErrors(validated.error.flatten().fieldErrors) 
    }
  }
  
  try {
    // 2. Send password reset email via Supabase
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(
      validated.data.email,
      {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
      }
    )
    
    if (error) {
      throw mapSupabaseError(error)
    }
    
    // Always return success to prevent email enumeration
    return { 
      success: true, 
      message: 'If an account exists with this email, you will receive a password reset link.' 
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      }
    }
    return { 
      success: false, 
      error: 'An error occurred. Please try again.' 
    }
  }
}

/**
 * Reset password action - Updates user password
 * Validates new password, updates via Supabase
 */
export async function resetPassword(formData: FormData) {
  // 1. Validate input with Zod
  const validated = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  })
  
  if (!validated.success) {
    return { 
      success: false, 
      errors: formatZodErrors(validated.error.flatten().fieldErrors) 
    }
  }
  
  try {
    // 2. Update password via Supabase (token is in URL hash)
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
      password: validated.data.password
    })
    
    if (error) {
      throw mapSupabaseError(error)
    }
    
    return { 
      success: true, 
      message: 'Password updated successfully. Please sign in with your new password.' 
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      }
    }
    return { 
      success: false, 
      error: 'An error occurred. Please try again.' 
    }
  }
}

/**
 * Update profile action - Updates user profile information
 * Validates input, updates profile in database
 */
export async function updateProfileAction(formData: FormData) {
  try {
    // 1. Get current user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { 
        success: false, 
        error: 'You must be logged in to update your profile' 
      }
    }
    
    // 2. Extract form data
    const fullName = formData.get('fullName') as string | null
    const avatarUrl = formData.get('avatarUrl') as string | null
    const emailNotifications = formData.get('emailNotifications') as string | null
    const timezone = formData.get('timezone') as string | null
    
    // 3. Build update object
    const updates: any = {}
    if (fullName !== null && fullName.trim() !== '') {
      updates.full_name = fullName.trim()
    }
    if (avatarUrl !== null && avatarUrl.trim() !== '') {
      updates.avatar_url = avatarUrl.trim()
    }
    if (emailNotifications !== null) {
      updates.email_notifications = emailNotifications === 'true'
    }
    if (timezone !== null && timezone.trim() !== '') {
      updates.timezone = timezone.trim()
    }
    
    // 4. Update profile
    const profile = await updateProfile(user.id, updates)
    
    if (!profile) {
      return { 
        success: false, 
        error: 'Failed to update profile. Please try again.' 
      }
    }
    
    return { 
      success: true, 
      message: 'Profile updated successfully',
      data: profile 
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { 
      success: false, 
      error: 'An error occurred while updating your profile. Please try again.' 
    }
  }
}
