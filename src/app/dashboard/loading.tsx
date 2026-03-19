/**
 * Dashboard Loading - Fallback UI for Suspense boundary
 * 
 * This component displays while DashboardContent is fetching data
 * It's automatically used by Next.js 16 when loading.tsx exists
 */
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-white/60 text-sm">Loading dashboard...</span>
      </div>
    </div>
  )
}
