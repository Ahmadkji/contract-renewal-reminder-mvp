'use client'

import { useEffect, useState, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowRight, FileText, Bell, Clock, Shield, Zap } from 'lucide-react'

function sanitizeRedirectPath(redirect: string | null): string {
  if (!redirect) return '/dashboard'
  if (!redirect.startsWith('/')) return '/dashboard'
  if (redirect.startsWith('//')) return '/dashboard'
  return redirect
}

function normalizeRetryAfterSeconds(value: unknown, fallback: number = 30): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.max(1, Math.min(300, Math.trunc(parsed)))
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>('')
  const [loginCooldownUntilMs, setLoginCooldownUntilMs] = useState(0)
  const [loginCooldownNowMs, setLoginCooldownNowMs] = useState(0)
  
  const redirect = sanitizeRedirectPath(searchParams.get('redirect'))

  useEffect(() => {
    if (loginCooldownUntilMs <= Date.now()) {
      return
    }

    const timer = setInterval(() => {
      setLoginCooldownNowMs(Date.now())
      if (Date.now() >= loginCooldownUntilMs) {
        clearInterval(timer)
      }
    }, 250)

    return () => clearInterval(timer)
  }, [loginCooldownUntilMs])

  const loginCooldownSeconds =
    loginCooldownUntilMs > loginCooldownNowMs
      ? Math.max(0, Math.ceil((loginCooldownUntilMs - loginCooldownNowMs) / 1000))
      : 0
  
  const handleSubmit = async (formData: FormData) => {
    if (loginCooldownSeconds > 0) {
      setFormError(`Too many attempts. Try again in ${loginCooldownSeconds}s.`)
      return
    }

    setErrors({})
    setFormError('')
    
    startTransition(async () => {
      const result = await login(formData)
      
      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }
        if (result.error) {
          setFormError(result.error)
        }

        if (result.code === 'RATE_LIMITED') {
          const retryAfterSeconds = normalizeRetryAfterSeconds(result.retryAfterSeconds, 30)
          const now = Date.now()
          setLoginCooldownNowMs(now)
          setLoginCooldownUntilMs(now + retryAfterSeconds * 1000)
          setFormError(result.error || `Too many attempts. Try again in ${retryAfterSeconds}s.`)
        }
      } else {
        // Success - navigate to dashboard with full page reload
        // This ensures cookies are properly set and server components can read them
        window.location.href = redirect
      }
    })
  }
  
  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL - Features */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-[#0a0a0a]">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 py-12">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <span className="text-black font-bold text-lg">R</span>
              </div>
              <span className="text-white font-semibold text-xl">Renewly</span>
            </div>
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Never Miss a{' '}
            <span className="text-white">
              Contract Renewal
            </span>
          </h1>
          
          {/* Tagline */}
          <p className="text-lg text-slate-400 mb-12 max-w-md">
            Automated tracking, timely reminders, zero missed deadlines
          </p>
          
          {/* Feature List */}
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-medium">Track Unlimited Contracts</div>
                <div className="text-sm text-slate-500">Store and monitor all your contracts in one place</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-medium">Smart Reminders</div>
                <div className="text-sm text-slate-500">Get notified before any contract expires</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-medium">Renewal History</div>
                <div className="text-sm text-slate-500">Track past renewals and contract values</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-medium">Secure Storage</div>
                <div className="text-sm text-slate-500">Your data is encrypted and protected</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* RIGHT PANEL - Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center px-6 py-12 bg-[#0a0a0a] relative">
        {/* Mobile logo - visible only on small screens */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <span className="text-black font-bold text-sm">R</span>
          </div>
          <span className="text-white font-semibold text-lg">Renewly</span>
        </div>
        
        {/* Form Card */}
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-slate-400">Sign in to your account to continue</p>
          </div>
          
          {/* Form */}
          <form action={handleSubmit} className="space-y-5">
            {formError && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                <AlertDescription className="text-red-400">{formError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isPending || loginCooldownSeconds > 0}
                className="h-12 bg-[#0f0f0f] border border-white/10 text-white placeholder:text-slate-500 focus:border-white focus:ring-white/20"
              />
              {errors.email && (
                <p className="text-sm text-red-400">{errors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Link 
                  href="/auth/forgot-password"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••"
                autoComplete="current-password"
                disabled={isPending || loginCooldownSeconds > 0}
                className="h-12 bg-[#0f0f0f] border border-white/10 text-white placeholder:text-slate-500 focus:border-white focus:ring-white/20"
              />
              {errors.password && (
                <p className="text-sm text-red-400">{errors.password}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-white hover:bg-slate-200 text-black font-semibold transition-all duration-200"
              disabled={isPending || loginCooldownSeconds > 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : loginCooldownSeconds > 0 ? (
                <>Try again in {loginCooldownSeconds}s</>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          
          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0a0a0a] text-slate-500">or</span>
            </div>
          </div>
          
          {/* Sign Up Link */}
          <p className="text-center text-slate-400">
            Don't have an account?{' '}
            <Link 
              href="/signup"
              className="text-white hover:text-slate-300 font-medium transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
