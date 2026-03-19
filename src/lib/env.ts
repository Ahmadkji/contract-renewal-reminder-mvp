import { z } from 'zod'

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 * Fails fast on startup if configuration is missing
 */
const envSchema = z.object({
  // Supabase configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  // Service role key is optional - used only for admin operations
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // App configuration
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
})

/**
 * Validate and export environment variables
 * Throws on startup if configuration is invalid
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})

/**
 * Type-safe environment variable access
 * Use this instead of process.env directly
 */
export type Env = z.infer<typeof envSchema>
