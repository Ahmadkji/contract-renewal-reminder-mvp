import { z } from 'zod'

/**
 * Public environment variables that are safe for client bundles.
 */
const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
})

const publicSiteEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
})

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function toAbsoluteUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function resolvePublicSupabaseUrl(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') ?? readEnv('SUPABASE_URL')
}

function resolvePublicSupabaseAnonKey(): string | undefined {
  return (
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ??
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
    readEnv('SUPABASE_ANON_KEY') ??
    readEnv('SUPABASE_PUBLISHABLE_KEY')
  )
}

function resolveAppUrl(): string | undefined {
  const explicitUrl =
    readEnv('NEXT_PUBLIC_APP_URL') ??
    readEnv('VERCEL_PROJECT_PRODUCTION_URL') ??
    readEnv('VERCEL_URL')

  if (explicitUrl) {
    return toAbsoluteUrl(explicitUrl)
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  const port = readEnv('PORT') ?? '3000'
  return `http://localhost:${port}`
}

let cachedPublicSupabaseEnv: z.infer<typeof publicSupabaseEnvSchema> | undefined
let cachedPublicSiteEnv: z.infer<typeof publicSiteEnvSchema> | undefined

function getPublicSupabaseEnv() {
  if (!cachedPublicSupabaseEnv) {
    cachedPublicSupabaseEnv = publicSupabaseEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: resolvePublicSupabaseUrl(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: resolvePublicSupabaseAnonKey(),
    })
  }

  return cachedPublicSupabaseEnv
}

function getPublicSiteEnv() {
  if (!cachedPublicSiteEnv) {
    cachedPublicSiteEnv = publicSiteEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: resolveAppUrl(),
    })
  }

  return cachedPublicSiteEnv
}

export type PublicEnv = z.infer<typeof publicSupabaseEnvSchema> &
  z.infer<typeof publicSiteEnvSchema>

export const publicEnv = {} as PublicEnv

Object.defineProperties(publicEnv, {
  NEXT_PUBLIC_SUPABASE_URL: {
    enumerable: true,
    get() {
      return getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_URL
    },
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    enumerable: true,
    get() {
      return getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY
    },
  },
  NEXT_PUBLIC_APP_URL: {
    enumerable: true,
    get() {
      return getPublicSiteEnv().NEXT_PUBLIC_APP_URL
    },
  },
})
