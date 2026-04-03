import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { getAllContracts } from '@/lib/db/contracts'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  await connection()
  const { user } = await validateSession()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const result = await getAllContracts(user.id, 1, 5)

  return <DashboardClient initialContracts={result.contracts} />
}
