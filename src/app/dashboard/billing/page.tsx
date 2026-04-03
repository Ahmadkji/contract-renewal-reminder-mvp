import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { BillingPageClient } from "@/components/dashboard/billing-page-client"

export default async function BillingPage() {
  await connection()
  const { user } = await validateSession()

  if (!user) {
    redirect('/login?next=/dashboard/billing')
  }

  return <BillingPageClient />
}
