'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { signup } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowRight, FileText, Bell, Clock, Shield, CheckCircle2, XCircle } from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal'

// Password requirement items
const passwordRequirements = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

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

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [password, setPassword] = useState('')
  const [signupCooldownUntilMs, setSignupCooldownUntilMs] = useState(0)
  const [signupCooldownNowMs, setSignupCooldownNowMs] = useState(0)

  useEffect(() => {
    if (signupCooldownUntilMs <= Date.now()) {
      return
    }

    const timer = setInterval(() => {
      setSignupCooldownNowMs(Date.now())
      if (Date.now() >= signupCooldownUntilMs) {
        clearInterval(timer)
      }
    }, 250)

    return () => clearInterval(timer)
  }, [signupCooldownUntilMs])

  const signupCooldownSeconds =
    signupCooldownUntilMs > signupCooldownNowMs
      ? Math.max(0, Math.ceil((signupCooldownUntilMs - signupCooldownNowMs) / 1000))
      : 0

  const handleSubmit = async (formData: FormData) => {
    if (signupCooldownSeconds > 0) {
      setFormError(`Too many attempts. Try again in ${signupCooldownSeconds}s.`)
      return
    }

    setErrors({})
    setFormError('')
    setSuccess(false)
    
    startTransition(async () => {
      const result = await signup(formData)
      
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
          setSignupCooldownNowMs(now)
          setSignupCooldownUntilMs(now + retryAfterSeconds * 1000)
          setFormError(result.error || `Too many attempts. Try again in ${retryAfterSeconds}s.`)
        }
      } else {
        // Success
        setSuccess(true)
        setSuccessMessage(result.message || 'Check your email to verify your account')
      }
    })
  }

  // Check password requirements
  const passwordValid = passwordRequirements.map(req => ({
    ...req,
    valid: req.test(password)
  }))
  const allRequirementsMet = passwordValid.every(r => r.valid)

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0a0a0a]">
        {/* Success background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>
        
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
            <p className="text-slate-400 mb-6">{successMessage}</p>
            <p className="text-sm text-slate-500 mb-8">
              We've sent a verification link to your email address.
              Click the link to verify your account and start using the app.
            </p>
            <Link 
              href="/login"
              className="inline-flex items-center gap-2 text-white hover:text-slate-300 font-medium transition-colors"
            >
              Go to login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    )
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
            <h2 className="text-3xl font-bold text-white mb-2">Create your account</h2>
            <p className="text-slate-400">Enter your information to get started</p>
          </div>
          
          {/* Form */}
          <form action={handleSubmit} className="space-y-5">
            {formError && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                <AlertDescription className="text-red-400">{formError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                disabled={isPending || signupCooldownSeconds > 0}
                className="h-12 bg-[#0f0f0f] border border-white/10 text-white placeholder:text-slate-500 focus:border-white focus:ring-white/20"
              />
              {errors.fullName && (
                <p className="text-sm text-red-400">{errors.fullName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isPending || signupCooldownSeconds > 0}
                className="h-12 bg-[#0f0f0f] border border-white/10 text-white placeholder:text-slate-500 focus:border-white focus:ring-white/20"
              />
              {errors.email && (
                <p className="text-sm text-red-400">{errors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                disabled={isPending || signupCooldownSeconds > 0}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-[#0f0f0f] border border-white/10 text-white placeholder:text-slate-500 focus:border-white focus:ring-white/20"
              />
              {errors.password && (
                <p className="text-sm text-red-400">{errors.password}</p>
              )}
              
              {/* Password Requirements */}
              {password && (
                <div className="grid grid-cols-2 gap-2 mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  {passwordValid.map((req) => (
                    <div 
                      key={req.id} 
                      className={`flex items-center gap-2 text-xs ${
                        req.valid ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {req.valid ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {req.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-white hover:bg-slate-200 text-black font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPending || signupCooldownSeconds > 0 || (password.length > 0 && !allRequirementsMet)}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : signupCooldownSeconds > 0 ? (
                <>Try again in {signupCooldownSeconds}s</>
              ) : (
                <>
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500 leading-relaxed">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-slate-300 hover:text-white underline underline-offset-2">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-slate-300 hover:text-white underline underline-offset-2">
                Privacy Policy
              </Link>
              . Support:{' '}
              <a href={SUPPORT_MAILTO} className="text-slate-300 hover:text-white underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
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
          
          {/* Sign In Link */}
          <p className="text-center text-slate-400">
            Already have an account?{' '}
            <Link 
              href="/login"
              className="text-white hover:text-slate-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
