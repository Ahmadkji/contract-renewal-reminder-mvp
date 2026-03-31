'use server'

import { createHash } from 'node:crypto'
import { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  profileUpdateSchema,
} from '@/lib/validation/auth-schema'
import { createClient } from '@/lib/supabase/server'
import { mapSupabaseError, formatZodErrors, AuthError } from '@/lib/errors/auth-errors'
import { serverEnv as env } from '@/lib/env/server'
import { updateProfile } from '@/lib/db/profiles'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { serializeUser } from '@/lib/serializers/user'
import { checkRateLimit, type RateLimitOptions } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'

const LOGIN_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const LOGIN_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const SIGNUP_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const SIGNUP_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const FORGOT_PASSWORD_IP_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

const FORGOT_PASSWORD_EMAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
}

type RateLimitedAuthResult = {
  success: false
  error: string
  code: 'RATE_LIMITED'
  retryAfterSeconds: number
  errors?: Record<string, string>
}

function normalizeRetryAfterSeconds(value: unknown, fallback: number = 30): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.max(1, Math.min(300, Math.trunc(parsed)))
}

function buildRateLimitedAuthResult(
  retryAfterSeconds: number,
  message: string
): RateLimitedAuthResult {
  return {
    success: false,
    error: message,
    code: 'RATE_LIMITED',
    retryAfterSeconds: normalizeRetryAfterSeconds(retryAfterSeconds, 30),
  }
}

function hashRateLimitValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

function buildSafeErrorLogPayload(error: unknown): {
  name?: string
  message: string
  code?: string
  status?: number
} {
  if (error && typeof error === 'object') {
    const candidate = error as {
      name?: unknown
      message?: unknown
      code?: unknown
      status?: unknown
    }

    return {
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      message:
        typeof candidate.message === 'string' ? candidate.message : 'Unknown error',
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
    }
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}

function logSanitizedAuthError(label: string, error: unknown): void {
  console.error(label, buildSafeErrorLogPayload(error))
}

async function getRequestIpFromHeaders(): Promise<string> {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = headerStore.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return 'unknown'
}

async function enforceRateLimit(
  key: string,
  options: RateLimitOptions,
  message: string
): Promise<RateLimitedAuthResult | null> {
  const result = await checkRateLimit(key, options)

  if (result.allowed) {
    return null
  }

  return buildRateLimitedAuthResult(result.retryAfterSeconds, message)
}

async function enforceAuthRateLimits(params: {
  action: 'login' | 'signup' | 'forgot-password'
  email: string
  ipOptions: RateLimitOptions
  emailOptions: RateLimitOptions
  message: string
}): Promise<RateLimitedAuthResult | null> {
  const ip = await getRequestIpFromHeaders()
  const ipLimited = await enforceRateLimit(
    `auth:${params.action}:ip:${ip}`,
    params.ipOptions,
    params.message
  )

  if (ipLimited) {
    return ipLimited
  }

  const normalizedEmail = params.email.trim().toLowerCase()
  const emailHash = hashRateLimitValue(normalizedEmail)

  return enforceRateLimit(
    `auth:${params.action}:email:${emailHash}`,
    params.emailOptions,
    params.message
  )
}

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

  const signupRateLimit = await enforceAuthRateLimits({
    action: 'signup',
    email: validated.data.email,
    ipOptions: SIGNUP_IP_RATE_LIMIT,
    emailOptions: SIGNUP_EMAIL_RATE_LIMIT,
    message: 'Too many signup attempts. Please try again later.',
  })

  if (signupRateLimit) {
    return signupRateLimit
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
        logSanitizedAuthError('[Signup] Failed to create profile:', profileError)
        // Continue anyway - user can create profile later
      }
    }
    
    return { success: true, message: 'Check your email to verify your account' }
  } catch (error) {
    if (error instanceof AuthError) {
      const retryAfterSeconds =
        error.code === 'RATE_LIMITED'
          ? normalizeRetryAfterSeconds(error.retryAfterSeconds, 30)
          : undefined
      return { 
        success: false, 
        error: error.message,
        code: error.code,
        retryAfterSeconds,
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

  const loginRateLimit = await enforceAuthRateLimits({
    action: 'login',
    email: validated.data.email,
    ipOptions: LOGIN_IP_RATE_LIMIT,
    emailOptions: LOGIN_EMAIL_RATE_LIMIT,
    message: 'Too many login attempts. Please try again later.',
  })

  if (loginRateLimit) {
    return loginRateLimit
  }
  
  try {
    // 2. Sign in with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.data.email,
      password: validated.data.password
    })
    
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Login] Supabase login error:', {
          message: error.message,
          status: error.status,
          code: error.code,
        })
      }
      throw mapSupabaseError(error)
    }

    if (!data.user || !data.session) {
      console.error('[Login] Missing session or user after successful signInWithPassword')
      return {
        success: false,
        error: 'Unable to establish a login session. Please try again.'
      }
    }

    const cookieStore = await cookies()
    const hasAuthCookie = cookieStore
      .getAll()
      .some((cookie) => cookie.name.includes('-auth-token'))

    if (!hasAuthCookie) {
      console.error('[Login] Supabase sign-in succeeded but auth cookie was not written')
      return {
        success: false,
        error: 'Login did not complete correctly. Please try again.'
      }
    }

    // 4. Return success with user data for client navigation
    return { 
      success: true, 
      user: serializeUser(data.user),
      message: 'Login successful'
    }
  } catch (error) {
    logSanitizedAuthError('[Login] Unexpected error:', error)
    if (error instanceof AuthError) {
      const retryAfterSeconds =
        error.code === 'RATE_LIMITED'
          ? normalizeRetryAfterSeconds(error.retryAfterSeconds, 30)
          : undefined
      return { 
        success: false, 
        error: error.message,
        code: error.code,
        retryAfterSeconds,
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
export async function logout(_formData?: FormData) {
  const supabase = await createClient()
  
  // 1. Attempt sign out
  const { error: signOutError } = await supabase.auth.signOut()
  
  if (signOutError) {
    logSanitizedAuthError('[Logout] Sign out failed:', signOutError)
    return { 
      success: false, 
      error: 'Failed to logout. Please try again.' 
    }
  }
  
  // 2. Verify session is destroyed
  const { data: { user }, error: _sessionError } = await supabase.auth.getUser()
  
  if (user) {
    console.error('[Logout] Session still exists after logout:', {
      userId: user.id,
    })
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
  
  logger.info('[Logout] Session destroyed successfully', {
    context: 'Auth',
  })
  
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

  const forgotPasswordRateLimit = await enforceAuthRateLimits({
    action: 'forgot-password',
    email: validated.data.email,
    ipOptions: FORGOT_PASSWORD_IP_RATE_LIMIT,
    emailOptions: FORGOT_PASSWORD_EMAIL_RATE_LIMIT,
    message: 'Too many reset requests. Please try again later.',
  })

  if (forgotPasswordRateLimit) {
    return forgotPasswordRateLimit
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
    const updates: {
      full_name?: string
      avatar_url?: string
      email_notifications?: boolean
      timezone?: string
    } = {}
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
    
    const validationResult = profileUpdateSchema.safeParse(updates)

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || 'Invalid profile settings',
      }
    }

    // 4. Update profile
    const profile = await updateProfile(user.id, validationResult.data)
    
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
    logSanitizedAuthError('[Profile] Update failed:', error)
    return { 
      success: false, 
      error: 'An error occurred while updating your profile. Please try again.' 
    }
  }
}
