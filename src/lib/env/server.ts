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

type ServerOnlyEnv = z.infer<typeof serverOnlyEnvSchema>
export type ServerEnv = PublicEnv & ServerOnlyEnv

const serverOnlyEnvCache = new Map<keyof ServerOnlyEnv, ServerOnlyEnv[keyof ServerOnlyEnv]>()
const loadedServerOnlyEnvKeys = new Set<keyof ServerOnlyEnv>()

function getServerOnlyEnvValue<K extends keyof ServerOnlyEnv>(key: K): ServerOnlyEnv[K] {
  if (!loadedServerOnlyEnvKeys.has(key)) {
    const parsedValue = serverOnlyEnvSchema.shape[key].parse(process.env[key]) as ServerOnlyEnv[K]
    serverOnlyEnvCache.set(key, parsedValue)
    loadedServerOnlyEnvKeys.add(key)
  }

  return serverOnlyEnvCache.get(key) as ServerOnlyEnv[K]
}

export const serverEnv = {} as ServerEnv

for (const key of Object.keys(publicEnv) as Array<keyof PublicEnv>) {
  Object.defineProperty(serverEnv, key, {
    enumerable: true,
    get() {
      return publicEnv[key]
    },
  })
}

for (const key of Object.keys(serverOnlyEnvSchema.shape) as Array<keyof ServerOnlyEnv>) {
  Object.defineProperty(serverEnv, key, {
    enumerable: true,
    get() {
      return getServerOnlyEnvValue(key)
    },
  })
}
