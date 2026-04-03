import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ensureProfileForUser, getProfileByUserId } from '@/lib/db/profiles'
import { serverEnv as env } from '@/lib/env/server'
import { serializeUser } from '@/lib/serializers/user'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'

function getHeaders(request: NextRequest) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
  }
}

function parseCookieHeader(cookieHeader: string | null): Array<{ name: string; value: string }> {
  if (!cookieHeader) {
    return []
  }

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf('=')
      if (separatorIndex <= 0) {
        return null
      }

      const name = entry.slice(0, separatorIndex).trim()
      const rawValue = entry.slice(separatorIndex + 1).trim()
      if (!name || !rawValue) {
        return null
      }

      try {
        return { name, value: decodeURIComponent(rawValue) }
      } catch {
        return { name, value: rawValue }
      }
    })
    .filter((value): value is { name: string; value: string } => Boolean(value))
}

function createRequestScopedSupabaseClient(request: NextRequest) {
  const cookieValues = parseCookieHeader(request.headers.get('cookie'))

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieValues
      },
      setAll() {
        // No-op: this read-only route only needs the current request session.
      },
    },
  })
}

async function handleAuthState(request: NextRequest) {
  try {
    const supabase = createRequestScopedSupabaseClient(request)
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: true,
          data: {
            user: null,
            profile: null,
          },
        },
        {
          headers: getHeaders(request),
        }
      )
    }

    const fallbackFullName =
      typeof data.user.user_metadata?.full_name === 'string'
        ? data.user.user_metadata.full_name
        : data.user.email?.split('@')[0] || null

    let profile = await getProfileByUserId(data.user.id)
    if (!profile) {
      profile = await ensureProfileForUser({
        user_id: data.user.id,
        full_name: fallbackFullName,
        timezone: 'UTC',
        email_notifications: true,
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: serializeUser(data.user),
          profile,
        },
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Auth Me] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load authenticated user.',
      },
      {
        status: 500,
        headers: getHeaders(request),
      }
    )
  }
}

export async function POST(request: NextRequest) {
  return handleAuthState(request)
}
