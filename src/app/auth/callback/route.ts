import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNextPath(value: string | null): string {
  if (!value) {
    return '/dashboard'
  }

  if (!value.startsWith('/')) {
    return '/dashboard'
  }

  if (value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'))
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL(nextPath, request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const failureUrl = new URL('/login', request.url)
    failureUrl.searchParams.set('error', 'auth_callback_failed')
    return NextResponse.redirect(failureUrl)
  }

  return NextResponse.redirect(new URL(nextPath, request.url))
}
