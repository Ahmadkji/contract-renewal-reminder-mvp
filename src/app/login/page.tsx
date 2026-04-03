'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

async function postJson<T>(input: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(input, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to sign in')
  }

  return payload.data as T
}

export default function LoginPage() {
  const router = useRouter()
  const [nextPath, setNextPath] = useState('/dashboard')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNextPath(params.get('next') || '/dashboard')
  }, [])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await postJson('/api/auth/login', { email, password })
      router.push(nextPath)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
        <div className="w-full rounded-3xl border border-white/[0.08] bg-[#141414] p-8 shadow-2xl shadow-black/30">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Renewly</p>
            <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
              Use your Supabase account to access the dashboard.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none ring-0 focus:border-cyan-500"
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none ring-0 focus:border-cyan-500"
                placeholder="Your password"
              />
            </Field>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm text-[#a3a3a3]">
            <Link href="/signup" className="hover:text-white">
              Create account
            </Link>
            <Link href="/auth/forgot-password" className="hover:text-white">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white">{label}</span>
      {children}
    </label>
  )
}
