/**
 * JWT Token Management with Rotating Refresh Tokens
 * 
 * Security Features:
 * - Short-lived access tokens (15 minutes) - limits window of compromise
 * - Rotating refresh tokens (7 days) - prevents replay attacks
 * - Token family tracking - detects token reuse (indicates theft)
 * - Secure token generation using crypto.randomBytes
 * - All tokens stored in httpOnly, Secure, SameSite=Strict cookies
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env/server';

// Token Configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes - short-lived for security
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Cookie Configuration - Security hardened
const COOKIE_CONFIG = {
  accessToken: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 15 * 60, // 15 minutes in seconds
    path: '/',
  },
  refreshToken: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60, // 7 days in seconds
    path: '/api/v2/auth/refresh', // Only sent to the v2 refresh endpoint
  },
};

// Token Payload Interfaces
export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  sessionId: string;
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  type: 'refresh';
}

/**
 * Generate cryptographically secure random token
 * Uses 32 bytes = 256 bits of entropy
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash token for database storage (prevents token leak if DB compromised)
 * Uses SHA-256 - tokens cannot be reversed, only compared
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Get JWT secret from environment
 * Must be at least 256 bits (32 bytes) for HS256
 */
function getJwtSecret(): Uint8Array {
  const secret = serverEnv.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create access token (short-lived, contains user info)
 * Signed with HS256 algorithm
 */
export async function createAccessToken(
  userId: string,
  email: string,
  sessionId: string
): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({
    userId,
    email,
    sessionId,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setAudience('docrenewal-pro')
    .setIssuer('docrenewal-pro-api')
    .sign(secret);
  
  return token;
}

/**
 * Create refresh token (longer-lived, minimal info)
 * Part of token family for rotation detection
 */
export async function createRefreshToken(
  userId: string,
  sessionId: string,
  tokenFamily: string
): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({
    userId,
    sessionId,
    tokenFamily,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_EXPIRY_DAYS}d`)
    .setAudience('docrenewal-pro')
    .setIssuer('docrenewal-pro-api')
    .sign(secret);
  
  return token;
}

/**
 * Verify access token
 * Returns payload if valid, null if invalid/expired
 */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      audience: 'docrenewal-pro',
      issuer: 'docrenewal-pro-api',
    });
    
    if (payload.type !== 'access') {
      return null;
    }
    
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 * Returns payload if valid, null if invalid/expired
 */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      audience: 'docrenewal-pro',
      issuer: 'docrenewal-pro-api',
    });
    
    if (payload.type !== 'refresh') {
      return null;
    }
    
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Set authentication cookies
 * Uses httpOnly, Secure, SameSite=Strict for maximum security
 */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  
  // Access token cookie - available for all API requests
  cookieStore.set('access_token', accessToken, COOKIE_CONFIG.accessToken);
  
  // Refresh token cookie - only sent to refresh endpoint
  cookieStore.set('refresh_token', refreshToken, COOKIE_CONFIG.refreshToken);
}

/**
 * Clear authentication cookies (logout)
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}

/**
 * Get tokens from cookies
 */
export async function getTokensFromCookies(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const cookieStore = await cookies();
  
  return {
    accessToken: cookieStore.get('access_token')?.value || null,
    refreshToken: cookieStore.get('refresh_token')?.value || null,
  };
}

/**
 * Generate token family ID
 * Used to track token rotation and detect reuse
 */
export function generateTokenFamily(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Check if token is about to expire
 * Returns true if token expires within 5 minutes
 */
export function isTokenExpiringSoon(expiresAt: number): boolean {
  const fiveMinutesMs = 5 * 60 * 1000;
  return Date.now() + fiveMinutesMs >= expiresAt;
}

/**
 * Token rotation result
 */
export interface TokenRotationResult {
  accessToken: string;
  refreshToken: string;
  tokenFamily: string;
  hashedRefreshToken: string;
  expiresAt: Date;
}

/**
 * Rotate refresh token
 * Creates new token pair, invalidates old token
 * This prevents replay attacks if refresh token is stolen
 */
export async function rotateTokens(
  userId: string,
  sessionId: string,
  existingTokenFamily: string
): Promise<TokenRotationResult> {
  // Generate new token family (this invalidates all previous tokens in family)
  const tokenFamily = generateTokenFamily();
  
  // Create new tokens
  const accessToken = await createAccessToken(userId, '', sessionId);
  const refreshToken = await createRefreshToken(userId, sessionId, tokenFamily);
  
  // Hash refresh token for database storage
  const hashedRefreshToken = hashToken(refreshToken);
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  
  return {
    accessToken,
    refreshToken,
    tokenFamily,
    hashedRefreshToken,
    expiresAt,
  };
}

/**
 * Create initial token pair for new session
 */
export async function createInitialTokens(
  userId: string,
  email: string,
  sessionId: string
): Promise<TokenRotationResult> {
  const tokenFamily = generateTokenFamily();
  
  const accessToken = await createAccessToken(userId, email, sessionId);
  const refreshToken = await createRefreshToken(userId, sessionId, tokenFamily);
  const hashedRefreshToken = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  
  return {
    accessToken,
    refreshToken,
    tokenFamily,
    hashedRefreshToken,
    expiresAt,
  };
}
