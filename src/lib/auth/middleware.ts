/**
 * Authentication Middleware with JWT Validation
 * 
 * Security Features:
 * - Validates JWT access tokens from httpOnly cookies
 * - Automatic token refresh when access token expires
 * - Token rotation detection (prevents replay attacks)
 * - Attaches user and session info to request
 * - CSRF protection integration
 * - Rate limiting integration
 */

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAccessToken,
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  hashToken,
  setAuthCookies,
  getTokensFromCookies,
} from './tokens';
import {
  getSession,
  updateSessionTokens,
  deleteSession,
  detectTokenReuse,
  deleteAllUserSessions,
  touchSession,
} from './sessions';
import { getAppUserById } from './app-users';
import { validateOrigin } from '@/lib/security/csrf';
import { checkRateLimit, getRateLimitHeaders, getRequestIp } from '@/lib/security/rate-limit';

// Rate limit config for auth endpoints
const AUTH_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000, // 1 minute
  failClosedWhenUnhealthy: true,
  failClosedRetryAfterSeconds: 60,
};

/**
 * User context attached to authenticated requests
 */
export interface AuthContext {
  userId: string;
  email: string;
  sessionId: string;
  isAuthenticated: true;
}

/**
 * Unauthenticated context
 */
export interface UnauthContext {
  isAuthenticated: false;
  userId: null;
  email: null;
  sessionId: null;
}

export type RequestContext = AuthContext | UnauthContext;

/**
 * Authentication result
 */
interface AuthResult {
  success: boolean;
  context: RequestContext;
  response?: NextResponse;
  error?: string;
}

/**
 * Main authentication middleware
 * Validates access token, refreshes if expired, handles rotation
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Check CSRF for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!validateOrigin(request)) {
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'Invalid origin',
        response: NextResponse.json(
          { success: false, error: 'Invalid origin' },
          { status: 403 }
        ),
      };
    }
  }

  try {
    // Get tokens from cookies
    const { accessToken, refreshToken } = await getTokensFromCookies();

    // No tokens = unauthenticated
    if (!accessToken && !refreshToken) {
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'No authentication tokens',
      };
    }

    // Validate access token first
    if (accessToken) {
      const payload = await verifyAccessToken(accessToken);
      
      if (payload) {
        const session = await getSession(payload.sessionId);
        if (!session || session.userId !== payload.userId) {
          const response = NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 401 }
          );
          response.cookies.delete('access_token');
          response.cookies.delete('refresh_token');

          return {
            success: false,
            context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
            error: 'Session not found',
            response,
          };
        }

        // Valid access token - touch session to update last used
        await touchSession(payload.sessionId).catch(() => {});
        
        return {
          success: true,
          context: {
            isAuthenticated: true,
            userId: payload.userId,
            email: payload.email,
            sessionId: payload.sessionId,
          },
        };
      }
    }

    // Access token expired or missing - try refresh token
    if (!refreshToken) {
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'Access token expired, no refresh token',
      };
    }

    // Validate refresh token
    const refreshPayload = await verifyRefreshToken(refreshToken);
    
    if (!refreshPayload) {
      // Refresh token expired - clear cookies
      const response = NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'Refresh token expired',
        response,
      };
    }

    // Check for token reuse (indicates theft)
    const { isReused, session } = await detectTokenReuse(
      refreshPayload.sessionId,
      refreshToken
    );

    if (isReused) {
      // Token reuse detected! Possible attack - revoke all user sessions
      console.warn('Token reuse detected - possible theft', {
        userId: refreshPayload.userId,
        sessionId: refreshPayload.sessionId,
      });
      
      // Delete all sessions for this user
      await deleteAllUserSessions(refreshPayload.userId);
      
      const response = NextResponse.json(
        { success: false, error: 'Security violation detected' },
        { status: 401 }
      );
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'Token reuse detected',
        response,
      };
    }

    if (!session) {
      return {
        success: false,
        context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
        error: 'Session not found',
      };
    }

    // Rotate tokens (create new pair)
    const userRecord = await getAppUserById(refreshPayload.userId)
    const newTokenFamily = randomUUID();
    const newAccessToken = await createAccessToken(
      refreshPayload.userId,
      userRecord?.email || '',
      refreshPayload.sessionId
    );
    const newRefreshToken = await createRefreshToken(
      refreshPayload.userId,
      refreshPayload.sessionId,
      newTokenFamily
    );
    const newHashedRefreshToken = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update session with new tokens
    await updateSessionTokens(
      refreshPayload.sessionId,
      newHashedRefreshToken,
      newTokenFamily,
      newExpiresAt
    );

    // Create response with new cookies
    const response = NextResponse.json(
      { success: true, message: 'Token refreshed' },
      { status: 200 }
    );
    
    // Set new cookies
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    });

    // Parse new access token for context
    const newPayload = await verifyAccessToken(newAccessToken);
    
    return {
      success: true,
      context: {
        isAuthenticated: true,
        userId: refreshPayload.userId,
        email: newPayload?.email || '',
        sessionId: refreshPayload.sessionId,
      },
      response,
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
      error: 'Authentication failed',
    };
  }
}

/**
 * Require authentication middleware
 * Use this for protected routes
 */
export async function requireAuth(request: NextRequest): Promise<{
  success: boolean;
  context: RequestContext;
  response?: NextResponse;
}> {
  const result = await authenticateRequest(request);
  
  if (!result.success || !result.context.isAuthenticated) {
    const response = result.response || NextResponse.json(
      { success: false, error: result.error || 'Authentication required' },
      { status: 401 }
    );
    
    return {
      success: false,
      context: { isAuthenticated: false, userId: null, email: null, sessionId: null },
      response,
    };
  }
  
  return result;
}

/**
 * Rate limit check for auth endpoints
 */
export async function checkAuthRateLimit(
  request: NextRequest,
  identifier: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const ip = getRequestIp(request);
  const key = `auth:${identifier}:${ip}`;
  
  const result = await checkRateLimit(key, AUTH_RATE_LIMIT);
  
  if (!result.allowed) {
    const response = NextResponse.json(
      { 
        success: false, 
        error: 'Too many requests',
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { 
        status: 429,
        headers: getRateLimitHeaders(result, AUTH_RATE_LIMIT),
      }
    );
    
    return { allowed: false, response };
  }
  
  return { allowed: true };
}

/**
 * Helper to create authenticated response
 * Attaches user context to response headers for downstream use
 */
export function createAuthResponse(
  data: unknown,
  context: AuthContext,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  
  // Add context headers for server components
  response.headers.set('x-user-id', context.userId);
  response.headers.set('x-session-id', context.sessionId);
  
  return response;
}

/**
 * Helper to handle authentication errors
 * Sanitizes error messages to prevent information leakage
 */
export function createAuthErrorResponse(
  message: string,
  status: number = 401,
  clearCookies: boolean = false
): NextResponse {
  const response = NextResponse.json(
    { 
      success: false, 
      error: message,
      // Never include stack traces or internal details
    },
    { status }
  );
  
  if (clearCookies) {
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
  }
  
  return response;
}
