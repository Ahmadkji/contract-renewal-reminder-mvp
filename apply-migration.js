/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Apply pending Supabase migrations using the linked project.
 *
 * This intentionally delegates to the official Supabase CLI instead of relying
 * on ad hoc SQL-execution helpers in the database.
 */

const { spawnSync } = require('child_process')

function run() {
  const result = spawnSync('supabase', ['db', 'push', '--linked'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

try {
  run()
} catch (error) {
  console.error('Failed to apply Supabase migrations:', error instanceof Error ? error.message : error)
  process.exit(1)
}
