import { serverEnv as env } from '@/lib/env/server'
import { getCreemProduct } from '@/lib/billing/creem-client'
import type { BillingPlanCode } from '@/lib/billing/plans'

export type BillingPricingSource = 'live' | 'fallback'

export interface BillingPricingPlan {
  planCode: BillingPlanCode
  displayName: string
  priceCents: number
  currency: string
  billingPeriod: string
  productId: string
  monthlyEquivalentCents: number
  yearlySavingsPercent: number
}

export interface BillingPricingSnapshot {
  plans: BillingPricingPlan[]
  currency: string
  source: BillingPricingSource
  stale: boolean
  generatedAt: string
}

interface BasePlanPricing {
  planCode: BillingPlanCode
  displayName: string
  priceCents: number
  currency: string
  billingPeriod: string
  productId: string
}

interface CachedPricingSnapshot {
  expiresAt: number
  data: BillingPricingSnapshot
}

const CACHE_TTL_MS = 60_000

const FALLBACK_PLAN_PRICING: Record<BillingPlanCode, Omit<BasePlanPricing, 'planCode' | 'productId'>> = {
  monthly: {
    displayName: 'Monthly',
    priceCents: 1900,
    currency: 'USD',
    billingPeriod: 'every-month',
  },
  yearly: {
    displayName: 'Yearly',
    priceCents: 19000,
    currency: 'USD',
    billingPeriod: 'every-year',
  },
}

let cachedPricingSnapshot: CachedPricingSnapshot | null = null

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function parsePriceCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed)
    }
  }

  return null
}

function computeYearlySavingsPercent(monthlyPriceCents: number, yearlyPriceCents: number): number {
  const annualMonthlyPrice = monthlyPriceCents * 12
  if (annualMonthlyPrice <= 0) {
    return 0
  }

  const savings = annualMonthlyPrice - yearlyPriceCents
  if (savings <= 0) {
    return 0
  }

  return Math.round((savings / annualMonthlyPrice) * 100)
}

function toMonthlyEquivalentCents(yearlyPriceCents: number): number {
  return Math.round(yearlyPriceCents / 12)
}

function createFallbackPlan(planCode: BillingPlanCode, productId: string): BasePlanPricing {
  const fallback = FALLBACK_PLAN_PRICING[planCode]
  return {
    planCode,
    displayName: fallback.displayName,
    priceCents: fallback.priceCents,
    currency: fallback.currency,
    billingPeriod: fallback.billingPeriod,
    productId,
  }
}

function normalizeLivePlan(
  rawProduct: unknown,
  planCode: BillingPlanCode,
  productId: string
): BasePlanPricing {
  const fallback = FALLBACK_PLAN_PRICING[planCode]
  const product = asRecord(rawProduct)
  if (!product) {
    throw new Error(`Invalid Creem product response for ${planCode}`)
  }

  const priceCents = parsePriceCents(product.price)
  if (priceCents === null) {
    throw new Error(`Missing or invalid price in Creem product for ${planCode}`)
  }

  const displayName =
    typeof product.name === 'string' && product.name.trim()
      ? product.name.trim()
      : fallback.displayName

  const currency =
    typeof product.currency === 'string' && product.currency.trim()
      ? product.currency.trim().toUpperCase()
      : fallback.currency

  const billingPeriod =
    typeof product.billing_period === 'string' && product.billing_period.trim()
      ? product.billing_period.trim()
      : fallback.billingPeriod

  return {
    planCode,
    displayName,
    priceCents,
    currency,
    billingPeriod,
    productId,
  }
}

async function resolvePlanPricing(planCode: BillingPlanCode, productId: string): Promise<{
  plan: BasePlanPricing
  usedFallback: boolean
}> {
  if (!productId) {
    return {
      plan: createFallbackPlan(planCode, ''),
      usedFallback: true,
    }
  }

  try {
    const product = await getCreemProduct(productId)
    return {
      plan: normalizeLivePlan(product, planCode, productId),
      usedFallback: false,
    }
  } catch {
    return {
      plan: createFallbackPlan(planCode, productId),
      usedFallback: true,
    }
  }
}

function applyDerivedMetrics(monthly: BasePlanPricing, yearly: BasePlanPricing): BillingPricingPlan[] {
  const yearlySavingsPercent = computeYearlySavingsPercent(monthly.priceCents, yearly.priceCents)

  return [
    {
      ...monthly,
      monthlyEquivalentCents: monthly.priceCents,
      yearlySavingsPercent: 0,
    },
    {
      ...yearly,
      monthlyEquivalentCents: toMonthlyEquivalentCents(yearly.priceCents),
      yearlySavingsPercent,
    },
  ]
}

export function clearBillingPricingCacheForTests() {
  cachedPricingSnapshot = null
}

export async function getBillingPricingSnapshot(): Promise<BillingPricingSnapshot> {
  const now = Date.now()
  if (cachedPricingSnapshot && cachedPricingSnapshot.expiresAt > now) {
    return cachedPricingSnapshot.data
  }

  const monthlyProductId = env.CREEM_MONTHLY_PRODUCT_ID || ''
  const yearlyProductId = env.CREEM_YEARLY_PRODUCT_ID || ''

  const [monthlyResult, yearlyResult] = await Promise.all([
    resolvePlanPricing('monthly', monthlyProductId),
    resolvePlanPricing('yearly', yearlyProductId),
  ])

  const plans = applyDerivedMetrics(monthlyResult.plan, yearlyResult.plan)
  const usedFallback = monthlyResult.usedFallback || yearlyResult.usedFallback
  const generatedAt = new Date().toISOString()
  const currency = plans[0]?.currency || 'USD'

  const snapshot: BillingPricingSnapshot = {
    plans,
    currency,
    source: usedFallback ? 'fallback' : 'live',
    stale: usedFallback,
    generatedAt,
  }

  cachedPricingSnapshot = {
    expiresAt: now + CACHE_TTL_MS,
    data: snapshot,
  }

  return snapshot
}
