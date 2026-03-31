import Link from 'next/link'

/**
 * Dashboard Not Found Page
 * 
 * This page is displayed when a user navigates to a dashboard route that doesn't exist.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-white/60 mb-8">Dashboard page not found</p>
        <Link 
          href="/dashboard"
          className="inline-block px-6 py-2 bg-white text-[#0a0a0a] rounded-lg hover:bg-white/90 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
