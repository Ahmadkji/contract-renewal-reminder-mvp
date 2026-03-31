import { serverEnv as env } from '@/lib/env/server'

export type BillingPlanCode = 'monthly' | 'yearly'

export interface BillingPlanDefinition {
  code: BillingPlanCode
  productId: string
  displayName: string
}

const PLAN_DEFINITIONS: Record<BillingPlanCode, Omit<BillingPlanDefinition, 'productId'>> = {
  monthly: {
    code: 'monthly',
    displayName: 'Monthly',
  },
  yearly: {
    code: 'yearly',
    displayName: 'Yearly',
  },
}

export function resolvePlan(planCode: string): BillingPlanDefinition {
  if (planCode !== 'monthly' && planCode !== 'yearly') {
    throw new Error('Invalid plan selected')
  }

  const productId = planCode === 'monthly'
    ? env.CREEM_MONTHLY_PRODUCT_ID
    : env.CREEM_YEARLY_PRODUCT_ID

  if (!productId) {
    throw new Error(`Billing product ID is not configured for plan: ${planCode}`)
  }

  return {
    ...PLAN_DEFINITIONS[planCode],
    productId,
  }
}

export function inferPlanCodeFromProductId(productId?: string | null): BillingPlanCode | null {
  if (!productId) return null

  if (env.CREEM_MONTHLY_PRODUCT_ID && productId === env.CREEM_MONTHLY_PRODUCT_ID) {
    return 'monthly'
  }

  if (env.CREEM_YEARLY_PRODUCT_ID && productId === env.CREEM_YEARLY_PRODUCT_ID) {
    return 'yearly'
  }

  return null
}
