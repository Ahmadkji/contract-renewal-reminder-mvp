'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { logger } from '@/lib/logger'

export default function VerifyEmailPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          redirect('/login')
        }
        setUser(user)
        
        // Check if already verified
        if (user.email_confirmed_at) {
          redirect('/dashboard')
        }
      } catch (error) {
        logger.error('Error checking user:', error, 'VerifyEmailPage')
        redirect('/login')
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email_confirmed_at) {
        // Email is now confirmed, redirect to dashboard
        setVerifying(true)
        setTimeout(() => {
          redirect('/dashboard')
        }, 1000) // Small delay for smooth transition
      }
    })

    // Listen for custom auth-state-changed event (dispatched after email verification)
    const handleAuthStateChange = () => {
      checkUser()
    }
    window.addEventListener('auth-state-changed', handleAuthStateChange)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('auth-state-changed', handleAuthStateChange)
    }
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Loading...
            </h1>
          </div>
        </div>
      </div>
    )
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Email Verified!
            </h1>
            <p className="text-slate-400">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto mb-4 w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 0102.83 2.83L21 21l-7.89 7.89a2 2 0 01-2.83-2.83L3 8z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 01-4-4V8a4 4 0 01-4 4h12a4 4 0 014 4v12a4 4 0 01-4-4h-12z" />
            </svg>
          </div>
          
          {/* Heading */}
          <h1 className="text-2xl font-semibold text-white mb-2">
            Check your email
          </h1>
          
          {/* Message */}
          <p className="text-slate-400 mb-6">
            We've sent a verification link to <strong className="text-cyan-400">{user?.email}</strong>.
            Please check your inbox and click on the link to activate your account.
          </p>
          
          {/* What happens next */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-slate-300 mb-2">
              What happens next?
            </h2>
            <ul className="text-sm text-slate-400 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-0.5">→</span>
                <span>Click the link in your email to verify your account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-0.5">→</span>
                <span>You'll be automatically redirected to dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-0.5">→</span>
                <span>Didn't receive the email? Check your spam folder</span>
              </li>
            </ul>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-11 rounded-lg transition-colors"
          >
            I've verified my email
          </button>
        </div>
      </div>
    </div>
  )
}
