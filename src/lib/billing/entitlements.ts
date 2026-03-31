import { createAdminClient } from '@/lib/supabase/server'

export type PremiumFeature = 'emailReminders' | 'csvExport'

export interface EntitlementSnapshot {
  user_id: string
  is_premium: boolean
  features_json: {
    emailReminders?: boolean
    csvExport?: boolean
    contractsLimit?: number | null
  }
  reason: string | null
  effective_from: string | null
  effective_to: string | null
  computed_at: string
  source_subscription_id: string | null
  updated_at: string
}

export async function getEntitlementSnapshot(userId: string): Promise<EntitlementSnapshot | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entitlement_snapshots')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data as EntitlementSnapshot
}

export async function ensureEntitlementSnapshot(userId: string, reason: string): Promise<EntitlementSnapshot> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('recompute_entitlement_snapshot', {
    p_user_id: userId,
    p_reason: reason,
    p_source_subscription_id: null,
  })

  if (error || !data) {
    throw new Error(error?.message || 'Failed to recompute entitlement snapshot')
  }

  return data as EntitlementSnapshot
}

export async function getOrCreateEntitlementSnapshot(userId: string, reason: string): Promise<EntitlementSnapshot> {
  const existing = await getEntitlementSnapshot(userId)
  if (existing) return existing
  return ensureEntitlementSnapshot(userId, reason)
}

export function canUseFeature(snapshot: EntitlementSnapshot, feature: PremiumFeature): boolean {
  if (!snapshot.is_premium) {
    return false
  }

  if (feature === 'emailReminders') {
    return snapshot.features_json?.emailReminders !== false
  }

  if (feature === 'csvExport') {
    return snapshot.features_json?.csvExport !== false
  }

  return false
}

export function getContractLimit(snapshot: EntitlementSnapshot): number | null {
  if (snapshot.is_premium) {
    return null
  }

  const limit = snapshot.features_json?.contractsLimit
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return Math.floor(limit)
  }

  return 5
}
