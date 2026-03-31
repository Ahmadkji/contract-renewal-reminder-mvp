'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import { publicEnv as env } from '@/lib/env/public'

export const createClient = () =>
  createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

export function useSupabaseClient() {
  const [supabase] = useState(() => createClient())
  return supabase
}
