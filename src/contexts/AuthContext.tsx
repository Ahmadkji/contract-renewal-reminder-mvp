'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SerializedUser } from '@/lib/serializers/user'

interface AuthProfile {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  email_notifications: boolean
  timezone: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: SerializedUser | null
  profile: AuthProfile | null
  session: null
  loading: boolean
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  logout: async () => undefined,
  refreshSession: async () => undefined,
})

async function fetchAuthState(): Promise<{ user: SerializedUser | null; profile: AuthProfile | null }> {
  const response = await fetch('/api/auth/me', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    return { user: null, profile: null }
  }

  return {
    user: payload.data?.user ?? null,
    profile: payload.data?.profile ?? null,
  }
}

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SerializedUser | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const syncUser = async () => {
      const nextAuthState = await fetchAuthState()
      if (!active) {
        return
      }

      setUser(nextAuthState.user)
      setProfile(nextAuthState.profile)
      setLoading(false)
    }

    syncUser().catch(() => {
      if (!active) {
        return
      }
      setUser(null)
      setProfile(null)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!loading && !user && pathname.startsWith('/dashboard')) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [loading, pathname, router, user])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      session: null,
      loading,
      logout: async () => {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => undefined)
        setUser(null)
        setProfile(null)
        router.replace('/login')
        router.refresh()
      },
      refreshSession: async () => {
        const nextAuthState = await fetchAuthState()
        setUser(nextAuthState.user)
        setProfile(nextAuthState.profile)
      },
    }),
    [loading, pathname, router, user, profile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
