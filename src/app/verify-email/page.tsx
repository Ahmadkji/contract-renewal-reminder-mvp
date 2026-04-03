import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
        <div className="w-full rounded-3xl border border-white/[0.08] bg-[#141414] p-8 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Renewly</p>
          <h1 className="mt-3 text-3xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
            Check your inbox and open the verification link from Supabase Auth to activate your account.
          </p>

          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/20 p-4 text-sm text-[#cbd5e1]">
            Once the link is opened, Supabase will send you back through the callback route and into the app.
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
            >
              Go to sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              Back to signup
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
