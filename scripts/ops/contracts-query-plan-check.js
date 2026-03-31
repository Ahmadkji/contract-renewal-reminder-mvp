/* eslint-disable no-console */

require('../load-env')

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const EXPLAIN_STRICT = parseBoolean(process.env.OPS_CONTRACTS_EXPLAIN_STRICT, false)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return fallback
}

function dateOnly(offsetDays = 0) {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return target.toISOString().slice(0, 10)
}

function normalizePlanOutput(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return JSON.stringify(data, null, 2)
  if (typeof data === 'object') return JSON.stringify(data, null, 2)
  return String(data)
}

function isPlanDisabledError(errorMessage) {
  const normalized = String(errorMessage || '').toLowerCase()
  return (
    normalized.includes('db_plan_enabled') ||
    normalized.includes('explain is disabled') ||
    normalized.includes('plan filter') ||
    normalized.includes('explain is not allowed')
  )
}

function isExplainUnsupportedError(errorMessage) {
  const normalized = String(errorMessage || '').toLowerCase()
  return (
    isPlanDisabledError(normalized) ||
    normalized.includes('application/vnd.pgrst.plan+text') ||
    normalized.includes('unsupported media type') ||
    normalized.includes('cannot produce an explain plan') ||
    normalized.includes('did not find response format')
  )
}

async function resolveUserId() {
  if (process.env.CONTRACTS_EXPLAIN_USER_ID) {
    return process.env.CONTRACTS_EXPLAIN_USER_ID.trim()
  }

  const { data, error } = await admin
    .from('contracts')
    .select('user_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve contracts user for explain checks: ${error.message}`)
  }

  if (!data?.user_id) {
    throw new Error(
      'No contracts found. Set CONTRACTS_EXPLAIN_USER_ID to a UUID with existing contract rows.'
    )
  }

  return data.user_id
}

async function runExplainCheck(label, builderFactory) {
  const builder = builderFactory()
  if (!builder || typeof builder.explain !== 'function') {
    throw new Error(`Explain builder unavailable for ${label}`)
  }

  const { data, error } = await builder.explain({
    analyze: true,
    verbose: true,
    settings: true,
    buffers: true,
    format: 'text',
  })

  if (error) {
    throw new Error(error.message)
  }

  console.log(`\n=== ${label} ===`)
  console.log(normalizePlanOutput(data))
}

async function main() {
  const userId = await resolveUserId()
  const upcomingStart = dateOnly(0)
  const upcomingEnd = dateOnly(60)

  console.log(`Using user_id=${userId}, strict=${EXPLAIN_STRICT ? '1' : '0'}`)

  const checks = [
    {
      label: 'direct_contracts_list',
      build: () =>
        admin
          .from('contracts')
          .select('id,name,vendor,end_date')
          .eq('user_id', userId)
          .order('end_date', { ascending: true })
          .limit(20),
    },
    {
      label: 'direct_contracts_search',
      build: () =>
        admin
          .from('contracts')
          .select('id,name,vendor,end_date')
          .eq('user_id', userId)
          .or('name.ilike.%Load%,vendor.ilike.%Load%')
          .order('end_date', { ascending: true })
          .limit(20),
    },
    {
      label: 'direct_contracts_upcoming',
      build: () =>
        admin
          .from('contracts')
          .select('id,name,vendor,end_date')
          .eq('user_id', userId)
          .gte('end_date', upcomingStart)
          .lte('end_date', upcomingEnd)
          .order('end_date', { ascending: true })
          .limit(20),
    },
    {
      label: 'rpc_contracts_page_list_planned',
      build: () =>
        admin.rpc('get_contracts_page_payload', {
          p_user_id: userId,
          p_page: 1,
          p_limit: 20,
          p_search: null,
          p_upcoming: false,
          p_count_mode: 'planned',
        }),
    },
    {
      label: 'rpc_contracts_page_search_planned',
      build: () =>
        admin.rpc('get_contracts_page_payload', {
          p_user_id: userId,
          p_page: 1,
          p_limit: 20,
          p_search: 'Load',
          p_upcoming: false,
          p_count_mode: 'planned',
        }),
    },
    {
      label: 'rpc_contracts_page_upcoming_planned',
      build: () =>
        admin.rpc('get_contracts_page_payload', {
          p_user_id: userId,
          p_page: 1,
          p_limit: 20,
          p_search: null,
          p_upcoming: true,
          p_count_mode: 'planned',
        }),
    },
  ]

  for (const check of checks) {
    try {
      await runExplainCheck(check.label, check.build)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isExplainUnsupportedError(message)) {
        if (EXPLAIN_STRICT) {
          throw new Error(
            `${check.label} failed in strict mode: EXPLAIN unsupported. Original error: ${message}`
          )
        }

        console.log(
          JSON.stringify(
            {
              status: 'skipped',
              reason: 'explain_unsupported',
              strict: EXPLAIN_STRICT,
              check: check.label,
              message,
            },
            null,
            2
          )
        )
        return
      }
      throw new Error(`${check.label} failed: ${message}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        status: 'pass',
        strict: EXPLAIN_STRICT,
        checksRun: checks.map((check) => check.label),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
