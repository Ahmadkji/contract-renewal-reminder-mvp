import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { getAllContracts } from '@/lib/db/contracts'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import type { ContractSummary } from '@/types/contract'

/**
 * Dashboard Page - Server Component
 * 
 * This is a Server Component that:
 * 1. Validates user authentication
 * 2. Fetches contracts directly from database
 * 3. Passes data to client component for interactivity
 */
export default function DashboardPage() {
  return <DashboardContent />
}

/**
 * Dashboard Content - Handles dynamic data access on the server.
 * This component accesses cookies() via validateSession() and database queries.
 */
async function DashboardContent() {
  await connection()

  // Validate session - this works because cookies() is available in Server Components
  const { user, error: sessionError } = await validateSession()
  
  if (sessionError || !user) {
    console.warn('[Dashboard] Session validation failed:', sessionError)
    redirect('/login')
  }
  
  console.log('[Dashboard] User authenticated:', user.id)
  
  // Fetch contracts directly from database - no API call needed
  const contractsResult = await getAllContracts(user.id, 1, 5)
  
  console.log('[Dashboard] Fetched contracts:', {
    active: contractsResult.contracts.length
  })
  
  // Transform contracts to match client interface
  const initialContracts: ContractSummary[] = contractsResult.contracts.map(c => ({
    id: c.id,
    name: c.name,
    vendor: c.vendor,
    type: c.type,
    startDate: c.startDate,
    endDate: c.endDate,
    expiryDate: c.expiryDate,
    daysLeft: c.daysLeft,
    status: c.status,
    value: c.value
  }))
  
  return (
    <DashboardClient 
      initialContracts={initialContracts}
    />
  )
}
