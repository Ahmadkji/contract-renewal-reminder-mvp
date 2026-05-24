/**
 * Secure Logout API Route
 * 
 * Security Features:
 * - Requires valid authentication
 * - Deletes session from database (server-side logout)
 * - Clears all auth cookies
 * - Supports "logout everywhere" functionality
 * - Rate limiting to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkAuthRateLimit, createAuthErrorResponse } from '@/lib/auth/middleware';
import { deleteSession, deleteAllUserSessions } from '@/lib/auth/sessions';
import { clearAuthCookies } from '@/lib/auth/tokens';
import { validateOrigin } from '@/lib/security/csrf';
import { z } from 'zod';

const logoutSchema = z.object({
  everywhere: z.boolean().default(false),
});

/**
 * POST /api/v2/auth/logout
 * Logs out user and optionally all their sessions
 */
export async function POST(request: NextRequest) {
  // Check CSRF origin
  if (!validateOrigin(request)) {
    return createAuthErrorResponse('Invalid origin', 403);
  }

  // Rate limiting check
  const rateLimitResult = await checkAuthRateLimit(request, 'logout');
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!;
  }

  // Require authentication
  const auth = await requireAuth(request);
  if (!auth.success || !auth.context.isAuthenticated) {
    return auth.response!;
  }

  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validation = logoutSchema.safeParse(body);
    if (!validation.success) {
      return createAuthErrorResponse('Invalid logout request', 400);
    }
    const { everywhere } = validation.data;

    if (everywhere) {
      // Delete all sessions for this user (logout everywhere)
      await deleteAllUserSessions(auth.context.userId);
      console.info('User logged out from all sessions', {
        userId: auth.context.userId,
        sessionId: auth.context.sessionId,
      });
    } else {
      // Delete only current session
      await deleteSession(auth.context.sessionId);
      console.info('User logged out', {
        userId: auth.context.userId,
        sessionId: auth.context.sessionId,
      });
    }

    // Clear cookies
    await clearAuthCookies();

    return NextResponse.json({
      success: true,
      data: {
        message: everywhere 
          ? 'Logged out from all devices' 
          : 'Logged out successfully',
      },
    });

  } catch (error) {
    console.error('Logout error:', error);
    return createAuthErrorResponse('Logout failed', 500);
  }
}
