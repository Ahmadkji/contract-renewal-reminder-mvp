import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { BILLING_ENABLED } from '@/lib/billing/mode'
import { BillingPageClient } from "@/components/dashboard/billing-page-client"

export default async function BillingPage() {
  if (!BILLING_ENABLED) {
    redirect('/dashboard')
  }

  await connection()
  const { user } = await validateSession()

  if (!user) {
    redirect('/login?next=/dashboard/billing')
  }

  return <BillingPageClient />
}
