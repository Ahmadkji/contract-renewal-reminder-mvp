/**
 * Authentication error class for secure error handling
 * Never exposes raw Supabase errors to the client
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryAfterSeconds: number | null = null
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function buildAuthErrorLogPayload(error: any): { message: string; status?: number; code?: string } {
  return {
    message: typeof error?.message === 'string' ? error.message : 'Unknown auth error',
    status: typeof error?.status === 'number' ? error.status : undefined,
    code: typeof error?.code === 'string' ? error.code : undefined,
  }
}

function logAuthError(label: string, error: any): void {
  const payload = buildAuthErrorLogPayload(error)

  if (process.env.NODE_ENV === 'development') {
    console.error(label, payload)
    return
  }

  console.warn(label, payload)
}

function normalizeRetryAfterSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.min(3600, Math.trunc(value)))
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(3600, parsed))
    }
  }

  return null
}

function parseRetryAfterFromError(error: any): number | null {
  const directRetryAfter =
    normalizeRetryAfterSeconds(error?.retryAfterSeconds) ??
    normalizeRetryAfterSeconds(error?.retry_after) ??
    normalizeRetryAfterSeconds(error?.retryAfter)

  if (directRetryAfter) {
    return directRetryAfter
  }

  const headers =
    error?.headers && typeof error.headers === 'object'
      ? error.headers
      : null

  const headerRetryAfter =
    normalizeRetryAfterSeconds(headers?.['retry-after']) ??
    normalizeRetryAfterSeconds(headers?.['Retry-After'])

  if (headerRetryAfter) {
    return headerRetryAfter
  }

  const message = typeof error?.message === 'string' ? error.message : ''
  const match = message.match(/(\d+)\s*(seconds|second|secs|sec|s)\b/i)
  if (match?.[1]) {
    return normalizeRetryAfterSeconds(match[1])
  }

  return null
}

/**
 * Maps Supabase errors to user-friendly, secure error messages
 * Never exposes internal error details or database information
 */
export function mapSupabaseError(error: any): AuthError {
  const message = error?.message || ''
  const status = error?.status || 500
  const code = error?.code || ''

  logAuthError('Supabase Auth Error:', error)

  // Session related errors
  if (message.includes('Auth session missing') ||
      message.includes('Session missing') ||
      message.includes('No session found') ||
      message.includes('not authenticated')) {
    return new AuthError(
      'Your session has expired. Please sign in again.',
      'SESSION_EXPIRED',
      401
    )
  }

  // Network / connectivity errors
  if (message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('Connection') ||
      message.includes('timeout') ||
      code === 'NETWORK_ERROR' ||
      status === 0) {
    return new AuthError(
      'Unable to connect to the server. Please check your internet connection.',
      'NETWORK_ERROR',
      503
    )
  }

  // Email already registered
  if (message.includes('User already registered') || 
      message.includes('duplicate key') ||
      status === 409) {
    return new AuthError(
      'An account with this email already exists',
      'USER_EXISTS',
      409
    )
  }

  // Invalid login credentials
  if (message.includes('Invalid login credentials') ||
      message.includes('Invalid credentials')) {
    return new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401
    )
  }

  // Email not confirmed
  if (message.includes('Email not confirmed') ||
      message.includes('email not confirmed')) {
    return new AuthError(
      'Please verify your email before signing in. Check your inbox for the verification link.',
      'EMAIL_NOT_CONFIRMED',
      401
    )
  }

  // User not found
  if (message.includes('User not found') ||
      message.includes('user not found') ||
      status === 404) {
    return new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401
    )
  }

  // Weak password
  if (message.includes('Password should be') ||
      message.includes('weak password') ||
      message.includes('Password does not meet')) {
    return new AuthError(
      'Password does not meet requirements',
      'WEAK_PASSWORD',
      400
    )
  }

  // Email already confirmed
  if (message.includes('Email already confirmed') ||
      message.includes('already been confirmed')) {
    return new AuthError(
      'Email already verified. Please sign in.',
      'EMAIL_ALREADY_VERIFIED',
      400
    )
  }

  // Invalid or expired token (for password reset)
  if (message.includes('Invalid token') ||
      message.includes('expired') ||
      message.includes('JWT') ||
      message.includes('token')) {
    return new AuthError(
      'Invalid or expired reset link. Please request a new password reset.',
      'INVALID_TOKEN',
      400
    )
  }

  // Rate limiting (if Supabase returns this)
  if (message.includes('Too many requests') ||
      message.includes('rate limit') ||
      status === 429) {
    const retryAfterSeconds = parseRetryAfterFromError(error)
    return new AuthError(
      'Too many attempts. Please try again later.',
      'RATE_LIMITED',
      429,
      retryAfterSeconds
    )
  }

  // Database error (but user is authenticated)
  if (message.includes('Database error') ||
      message.includes('database error') ||
      code === 'PGRST301' ||
      code === '23505' || // unique_violation
      code === '42501') { // insufficient_privilege
    return new AuthError(
      'A database error occurred. Please try again.',
      'DATABASE_ERROR',
      500
    )
  }

  // Auth error from Supabase (various codes)
  if (code === 'auth_error' ||
      code === 'AUTH_ERR' ||
      message.includes('auth error')) {
    return new AuthError(
      'Authentication failed. Please sign in again.',
      'AUTH_FAILED',
      401
    )
  }

  // Invalid API key - critical configuration issue
  if (message.includes('Invalid API key') ||
      message.includes('invalid api key') ||
      message.includes('API key')) {
    return new AuthError(
      'Server configuration error. Please contact support.',
      'INVALID_API_KEY',
      500
    )
  }

  // Default secure error - log for debugging
  logAuthError('Unhandled Supabase Auth Error:', error)
  return new AuthError(
    'An authentication error occurred. Please try again.',
    'AUTH_ERROR',
    500
  )
}

/**
 * Formats Zod validation errors for client display
 */
export function formatZodErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  const formatted: Record<string, string> = {}
  
  for (const [field, errors] of Object.entries(fieldErrors)) {
    formatted[field] = errors[0] || 'Invalid input'
  }
  
  return formatted
}
