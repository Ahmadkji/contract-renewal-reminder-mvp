import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/supabase/server'
import { getAllContracts, getUpcomingExpiriesPaginated } from '@/lib/db/contracts'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

/**
 * Dashboard Page - Server Component
 * 
 * This is a Server Component that:
 * 1. Validates user authentication
 * 2. Fetches contracts directly from database
 * 3. Passes data to client component for interactivity
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  )
}

/**
 * Dashboard Content - Wrapped in Suspense to handle dynamic data access
 * This component accesses cookies() via validateSession() and database queries
 */
async function DashboardContent() {
  // Validate session - this works because cookies() is available in Server Components
  const { user, error: sessionError } = await validateSession()
  
  if (sessionError || !user) {
    console.warn('[Dashboard] Session validation failed:', sessionError)
    redirect('/login')
  }
  
  console.log('[Dashboard] User authenticated:', user.id)
  
  // Fetch contracts directly from database - no API call needed
  const [contractsResult, upcomingResult] = await Promise.all([
    getAllContracts(user.id, 1, 5),
    getUpcomingExpiriesPaginated(user.id, 1, 20)
  ])
  
  console.log('[Dashboard] Fetched contracts:', {
    active: contractsResult.contracts.length,
    upcoming: upcomingResult.contracts.length
  })
  
  // Transform contracts to match client interface
  const initialContracts = contractsResult.contracts.map(c => ({
    id: c.id,
    name: c.name,
    vendor: c.vendor,
    type: c.type,
    expiryDate: c.expiryDate,
    daysLeft: c.daysLeft,
    status: c.status,
    value: c.value
  }))
  
  const initialUpcoming = upcomingResult.contracts.map(c => ({
    id: c.id,
    name: c.name,
    vendor: c.vendor,
    type: c.type,
    expiryDate: c.expiryDate,
    daysLeft: c.daysLeft,
    status: c.status,
    value: c.value
  }))
  
  return (
    <DashboardClient 
      initialContracts={initialContracts}
      initialUpcoming={initialUpcoming}
    />
  )
}

/**
 * Dashboard Loading - Fallback UI shown while data is being fetched
 * This displays while DashboardContent resolves
 */
function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-white/60 text-sm">Loading dashboard...</span>
      </div>
    </div>
  )
}
