function readBillingEnabledFlag(): string {
  const value = process.env.NEXT_PUBLIC_BILLING_ENABLED
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const rawBillingEnabledFlag = readBillingEnabledFlag()

export const BILLING_ENABLED =
  rawBillingEnabledFlag === '1' || rawBillingEnabledFlag === 'true'

export const MVP_FREE_MODE = !BILLING_ENABLED
