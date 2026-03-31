import 'server-only'

/**
 * @deprecated Use explicit boundary-safe imports:
 * - `@/lib/env/public` in client modules
 * - `@/lib/env/server` in server modules
 */
export { serverEnv as env } from '@/lib/env/server'
export type { ServerEnv as Env } from '@/lib/env/server'
