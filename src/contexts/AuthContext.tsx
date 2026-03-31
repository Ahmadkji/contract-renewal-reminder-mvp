'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv as env } from '@/lib/env/public'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { serializeUser, type SerializedUser } from '@/lib/serializers/user'

interface AuthContextType {
  user: SerializedUser | null
  session: Session | null
  loading: boolean
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  logout: async () => {},
  refreshSession: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<SerializedUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    // Initialize supabase client once
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    }

    const supabase = supabaseRef.current

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(serializeUser(session?.user))
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.info('[AuthContext] Auth state changed', {
          event,
          userId: session?.user?.id ?? null,
        })
        setSession(session)
        setUser(serializeUser(session?.user))
        setLoading(false)

        if (event === 'SIGNED_OUT' && window.location.pathname.startsWith('/dashboard')) {
          router.push('/login')
        }

        // Broadcast to other tabs
        if (channelRef.current) {
          channelRef.current.postMessage(JSON.stringify({
            type: event,
            userId: session?.user?.id,
            timestamp: Date.now()
          }))
        }
      }
    )

    // Setup BroadcastChannel for cross-tab sync
    if (!channelRef.current) {
      const bc = new BroadcastChannel('renewly-auth-sync')
      channelRef.current = bc

      bc.onmessage = (event) => {
        const authEvent = JSON.parse(event.data)
        logger.info('[AuthContext] Received auth event from other tab', {
          type: authEvent.type,
          userId: authEvent.userId ?? null,
        })

        // Update local state based on event
        if (authEvent.type === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setLoading(false)

          // Redirect if on dashboard
          if (window.location.pathname.startsWith('/dashboard')) {
            router.push('/login')
          }
        } else if (authEvent.type === 'SIGNED_IN') {
          // ✅ Refresh session from Supabase instead of reloading page
          if (supabaseRef.current) {
            supabaseRef.current.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                setSession(session)
                setUser(serializeUser(session.user))
                setLoading(false)
              }
            })
          }
        } else if (authEvent.type === 'TOKEN_REFRESHED') {
          // Refresh user data
          if (supabaseRef.current) {
            supabaseRef.current.auth.getUser().then(({ data: { user } }) => {
              setUser(serializeUser(user))
            })
          }
        }
      }
    }

    return () => {
      authSubscription.unsubscribe()
      if (channelRef.current) {
        channelRef.current.close()
      }
    }
  }, [router, supabaseRef])

  const logout = async () => {
    try {
      if (supabaseRef.current) {
        await supabaseRef.current.auth.signOut()
      }
      // Broadcast will be handled by onAuthStateChange
    } catch (error) {
      console.error('[AuthContext] Logout error:', error)
    }
  }

  const refreshSession = async () => {
    try {
      if (supabaseRef.current) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        setSession(session)
        setUser(serializeUser(session?.user))
      }
    } catch (error) {
      console.error('[AuthContext] Refresh session error:', error)
    }
  }

  const value = {
    user,
    session,
    loading,
    logout,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
