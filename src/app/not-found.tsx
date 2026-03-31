import Link from 'next/link'

/**
 * Not Found Page
 * 
 * This page is displayed when a user navigates to a route that doesn't exist.
 */
export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-white/60 mb-8">Page not found</p>
        <Link 
          href="/"
          className="inline-block px-6 py-2 bg-white text-[#0a0a0a] rounded-lg hover:bg-white/90 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
