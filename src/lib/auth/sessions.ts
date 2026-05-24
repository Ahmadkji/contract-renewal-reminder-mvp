/**
 * Session Management with Device & IP Tracking
 * 
 * Security Features:
 * - Session stored in database with hashed refresh tokens
 * - Device fingerprinting for session identification
 * - IP tracking for anomaly detection
 * - Ability to revoke all user sessions
 * - Session expiration enforcement
 */

import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export interface SessionInfo {
  id: string;
  userId: string;
  hashedRefreshToken: string;
  tokenFamily: string;
  deviceInfo: string;
  ipAddress: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
}

/**
 * Extract device info from request headers
 * Used for session identification and logging
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const headersList = await headers();
  
  return {
    userAgent: headersList.get('user-agent') || 'unknown',
    platform: headersList.get('sec-ch-ua-platform') || 'unknown',
    language: headersList.get('accept-language') || 'unknown',
  };
}

/**
 * Get client IP address
 * Considers proxy headers for deployed environments
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  
  // Check for forwarded headers (when behind proxy/CDN)
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // Get first IP in chain (client IP)
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = headersList.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return 'unknown';
}

/**
 * Create device fingerprint for session identification
 * Combines user agent, platform, and language
 */
export function createDeviceFingerprint(deviceInfo: DeviceInfo): string {
  const fingerprint = `${deviceInfo.userAgent}|${deviceInfo.platform}|${deviceInfo.language}`;
  return createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
}

/**
 * Create a new session in database
 */
export async function createSession(
  userId: string,
  hashedRefreshToken: string,
  tokenFamily: string,
  expiresAt: Date
): Promise<SessionInfo> {
  const admin = createAdminClient();
  const deviceInfo = await getDeviceInfo();
  const ipAddress = await getClientIp();
  const deviceFingerprint = createDeviceFingerprint(deviceInfo);
  
  const sessionId = randomBytes(16).toString('hex');
  
  const { data, error } = await admin
    .from('user_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      hashed_refresh_token: hashedRefreshToken,
      token_family: tokenFamily,
      device_info: JSON.stringify(deviceInfo),
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress,
      expires_at: expiresAt.toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
  
  return {
    id: data.id,
    userId: data.user_id,
    hashedRefreshToken: data.hashed_refresh_token,
    tokenFamily: data.token_family,
    deviceInfo: data.device_info,
    ipAddress: data.ip_address,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
    lastUsedAt: new Date(data.last_used_at),
  };
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<SessionInfo | null> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from('user_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Check if session is expired
  if (new Date(data.expires_at) < new Date()) {
    await deleteSession(sessionId);
    return null;
  }
  
  return {
    id: data.id,
    userId: data.user_id,
    hashedRefreshToken: data.hashed_refresh_token,
    tokenFamily: data.token_family,
    deviceInfo: data.device_info,
    ipAddress: data.ip_address,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
    lastUsedAt: new Date(data.last_used_at),
  };
}

/**
 * Update session with new refresh token (token rotation)
 */
export async function updateSessionTokens(
  sessionId: string,
  hashedRefreshToken: string,
  tokenFamily: string,
  expiresAt: Date
): Promise<void> {
  const admin = createAdminClient();
  
  const { error } = await admin
    .from('user_sessions')
    .update({
      hashed_refresh_token: hashedRefreshToken,
      token_family: tokenFamily,
      expires_at: expiresAt.toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  
  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
}

/**
 * Delete a specific session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const admin = createAdminClient();
  
  await admin
    .from('user_sessions')
    .delete()
    .eq('id', sessionId);
}

/**
 * Delete all sessions for a user (logout everywhere)
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const admin = createAdminClient();
  
  await admin
    .from('user_sessions')
    .delete()
    .eq('user_id', userId);
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });
  
  if (error || !data) {
    return [];
  }
  
  return data.map(session => ({
    id: session.id,
    userId: session.user_id,
    hashedRefreshToken: session.hashed_refresh_token,
    tokenFamily: session.token_family,
    deviceInfo: session.device_info,
    ipAddress: session.ip_address,
    expiresAt: new Date(session.expires_at),
    createdAt: new Date(session.created_at),
    lastUsedAt: new Date(session.last_used_at),
  }));
}

/**
 * Validate refresh token against stored hash
 * Used during token rotation to detect token reuse attacks
 */
export async function validateRefreshToken(
  sessionId: string,
  refreshToken: string
): Promise<boolean> {
  const session = await getSession(sessionId);
  
  if (!session) {
    return false;
  }
  
  const hashedToken = createHash('sha256').update(refreshToken).digest('hex');
  return hashedToken === session.hashedRefreshToken;
}

/**
 * Check for token reuse attack
 * If token doesn't match stored hash, it was already used (stolen)
 */
export async function detectTokenReuse(
  sessionId: string,
  refreshToken: string
): Promise<{ isReused: boolean; session: SessionInfo | null }> {
  const session = await getSession(sessionId);
  
  if (!session) {
    return { isReused: false, session: null };
  }
  
  const hashedToken = createHash('sha256').update(refreshToken).digest('hex');
  const isReused = hashedToken !== session.hashedRefreshToken;
  
  return { isReused, session };
}

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from('user_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');
  
  if (error) {
    throw new Error(`Failed to cleanup sessions: ${error.message}`);
  }
  
  return data?.length || 0;
}

/**
 * Update session last used timestamp
 */
export async function touchSession(sessionId: string): Promise<void> {
  const admin = createAdminClient();
  const ipAddress = await getClientIp();
  
  await admin
    .from('user_sessions')
    .update({
      last_used_at: new Date().toISOString(),
      ip_address: ipAddress,
    })
    .eq('id', sessionId);
}
