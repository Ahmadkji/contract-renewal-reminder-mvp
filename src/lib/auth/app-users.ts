import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/server'

const PASSWORD_SALT_ROUNDS = 12
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export interface AppUserRecord {
  id: string
  email: string
  full_name: string | null
  password_hash: string
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface PublicAppUser {
  id: string
  email: string
  fullName: string | null
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppUserInput {
  email: string
  password: string
  fullName?: string | null
}

export interface CreatePasswordResetResult {
  user: AppUserRecord
  resetToken: string
  expiresAt: Date
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url')
}

export function toPublicAppUser(user: AppUserRecord): PublicAppUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    emailVerifiedAt: user.email_verified_at,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(PASSWORD_SALT_ROUNDS)
  return bcrypt.hash(password, salt)
}

async function mapUserRecord<T extends Record<string, unknown> | null | undefined>(
  data: T
): Promise<AppUserRecord | null> {
  if (!data) {
    return null
  }

  const user = data as Record<string, unknown>
  const id = typeof user.id === 'string' ? user.id : null
  const email = typeof user.email === 'string' ? user.email : null
  const passwordHash = typeof user.password_hash === 'string' ? user.password_hash : null

  if (!id || !email || !passwordHash) {
    return null
  }

  return {
    id,
    email,
    full_name: typeof user.full_name === 'string' ? user.full_name : null,
    password_hash: passwordHash,
    email_verified_at: typeof user.email_verified_at === 'string' ? user.email_verified_at : null,
    last_login_at: typeof user.last_login_at === 'string' ? user.last_login_at : null,
    created_at: typeof user.created_at === 'string' ? user.created_at : new Date().toISOString(),
    updated_at: typeof user.updated_at === 'string' ? user.updated_at : new Date().toISOString(),
  }
}

export async function getAppUserByEmail(email: string): Promise<AppUserRecord | null> {
  const admin = createAdminClient()
  const normalizedEmail = normalizeEmail(email)

  const { data, error } = await admin
    .from('app_users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load app user: ${error.message}`)
  }

  return mapUserRecord(data)
}

export async function getAppUserById(userId: string): Promise<AppUserRecord | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load app user: ${error.message}`)
  }

  return mapUserRecord(data)
}

export async function createAppUser(input: CreateAppUserInput): Promise<AppUserRecord> {
  const admin = createAdminClient()
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password)

  const { data, error } = await admin
    .from('app_users')
    .insert({
      email,
      full_name: input.fullName?.trim() || null,
      password_hash: passwordHash,
      email_verified_at: new Date().toISOString(),
      last_login_at: null,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('User already exists')
    }
    throw new Error(`Failed to create app user: ${error.message}`)
  }

  const user = await mapUserRecord(data)
  if (!user) {
    throw new Error('Invalid app user record returned after create')
  }

  return user
}

export async function verifyAppUserPassword(
  email: string,
  password: string
): Promise<AppUserRecord | null> {
  const user = await getAppUserByEmail(email)
  if (!user) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    return null
  }

  return user
}

export async function markAppUserLogin(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_users')
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update login timestamp: ${error.message}`)
  }
}

export async function updateAppUserPassword(userId: string, password: string): Promise<void> {
  const admin = createAdminClient()
  const passwordHash = await hashPassword(password)

  const { error } = await admin
    .from('app_users')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update app user password: ${error.message}`)
  }
}

export async function createPasswordResetRequest(email: string): Promise<CreatePasswordResetResult | null> {
  const admin = createAdminClient()
  const user = await getAppUserByEmail(email)
  if (!user) {
    return null
  }

  const resetToken = createPasswordResetToken()
  const tokenHash = hashResetToken(resetToken)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)

  const { error: deleteError } = await admin
    .from('app_password_reset_tokens')
    .delete()
    .eq('user_id', user.id)
    .is('consumed_at', null)

  if (deleteError) {
    throw new Error(`Failed to clear old reset tokens: ${deleteError.message}`)
  }

  const { error } = await admin
    .from('app_password_reset_tokens')
    .insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      consumed_at: null,
    })

  if (error) {
    throw new Error(`Failed to create password reset token: ${error.message}`)
  }

  return { user, resetToken, expiresAt }
}

export async function consumePasswordResetToken(token: string): Promise<AppUserRecord | null> {
  const admin = createAdminClient()
  const tokenHash = hashResetToken(token)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('app_password_reset_tokens')
    .select('user_id, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load password reset token: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const expiresAt = typeof data.expires_at === 'string' ? new Date(data.expires_at) : null
  const consumedAt = typeof data.consumed_at === 'string' ? new Date(data.consumed_at) : null

  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || consumedAt) {
    return null
  }

  const { error: consumeError } = await admin
    .from('app_password_reset_tokens')
    .update({
      consumed_at: now,
    })
    .eq('token_hash', tokenHash)

  if (consumeError) {
    throw new Error(`Failed to mark password reset token consumed: ${consumeError.message}`)
  }

  return getAppUserById(String(data.user_id))
}

export async function clearPasswordResetTokensForUser(userId: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('app_password_reset_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to clear password reset tokens: ${error.message}`)
  }
}
