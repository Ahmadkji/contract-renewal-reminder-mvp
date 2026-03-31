import 'server-only'

import { z } from 'zod'
import { publicEnv, type PublicEnv } from '@/lib/env/public'

/**
 * Server-only environment variables and secrets.
 */
const serverOnlyEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  CREEM_API_KEY: z.string().optional(),
  CREEM_WEBHOOK_SECRET: z.string().optional(),
  CREEM_API_BASE_URL: z.string().url().optional(),
  CREEM_MONTHLY_PRODUCT_ID: z.string().optional(),
  CREEM_YEARLY_PRODUCT_ID: z.string().optional(),
  ERROR_TRACKING_WEBHOOK_URL: z.string().url().optional(),
  ALERTING_WEBHOOK_URL: z.string().url().optional(),
  CSRF_TRUSTED_ORIGINS: z.string().optional(),
  RATE_LIMIT_TRUST_PROXY_HEADERS: z.enum(['0', '1']).optional(),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
})

const serverOnlyEnv = serverOnlyEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
  CREEM_API_KEY: process.env.CREEM_API_KEY,
  CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
  CREEM_API_BASE_URL: process.env.CREEM_API_BASE_URL,
  CREEM_MONTHLY_PRODUCT_ID: process.env.CREEM_MONTHLY_PRODUCT_ID,
  CREEM_YEARLY_PRODUCT_ID: process.env.CREEM_YEARLY_PRODUCT_ID,
  ERROR_TRACKING_WEBHOOK_URL: process.env.ERROR_TRACKING_WEBHOOK_URL,
  ALERTING_WEBHOOK_URL: process.env.ALERTING_WEBHOOK_URL,
  CSRF_TRUSTED_ORIGINS: process.env.CSRF_TRUSTED_ORIGINS,
  RATE_LIMIT_TRUST_PROXY_HEADERS: process.env.RATE_LIMIT_TRUST_PROXY_HEADERS,
  CRON_SECRET: process.env.CRON_SECRET,
})

export const serverEnv: PublicEnv & z.infer<typeof serverOnlyEnvSchema> = {
  ...publicEnv,
  ...serverOnlyEnv,
}

export type ServerEnv = typeof serverEnv
