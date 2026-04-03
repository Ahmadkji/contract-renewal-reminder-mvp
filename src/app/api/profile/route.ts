import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfileForUser, getProfileByUserId, updateProfile } from '@/lib/db/profiles'
import { profileUpdateSchema } from '@/lib/validation/auth-schema'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'
import { connection } from 'next/server'

function getHeaders(request: NextRequest) {
  return {
    'Cache-Control': 'no-store',
    'X-Request-Id': getRequestIdFromHeaders(request.headers),
  }
}

export async function GET(request: NextRequest) {
  try {
    await connection()
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
          headers: getHeaders(request),
        }
      )
    }

    const profile = (await getProfileByUserId(data.user.id)) || (await ensureProfileForUser({
      user_id: data.user.id,
      full_name:
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : data.user.email?.split('@')[0] || null,
      timezone: 'UTC',
      email_notifications: true,
    }))

    return NextResponse.json(
      {
        success: true,
        data: profile,
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Profile GET] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load profile.',
      },
      {
        status: 500,
        headers: getHeaders(request),
      }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connection()
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'PATCH /api/profile')
      return getOriginErrorResponse()
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
          headers: getHeaders(request),
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validated = profileUpdateSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid profile settings.',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: getHeaders(request),
        }
      )
    }

    const profile = (await updateProfile(data.user.id, validated.data)) || (await ensureProfileForUser({
      user_id: data.user.id,
      full_name: validated.data.full_name ?? (data.user.email?.split('@')[0] || null),
      avatar_url: validated.data.avatar_url ?? null,
      email_notifications: validated.data.email_notifications ?? true,
      timezone: validated.data.timezone ?? 'UTC',
    }))

    return NextResponse.json(
      {
        success: true,
        data: profile,
      },
      {
        headers: getHeaders(request),
      }
    )
  } catch (error) {
    console.error('[Profile PATCH] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save profile settings.',
      },
      {
        status: 500,
        headers: getHeaders(request),
      }
    )
  }
}
