import { NextRequest } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

interface RateLimitBucket {
  count: number
  expiresAt: number
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  /**
   * When true, deny requests if persistent limiter storage is unavailable.
   * Use this for security-sensitive flows (auth, billing, webhook ingestion).
   */
  failClosedWhenUnhealthy?: boolean
  /**
   * Retry-After value used when fail-closed mode blocks due to backend outage.
   */
  failClosedRetryAfterSeconds?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const buckets = new Map<string, RateLimitBucket>()
let lastRateLimitFallbackLogAtMs = 0
const RATE_LIMIT_AUDIT_ACTION = 'rate_limit_consume'
const MEMORY_FALLBACK_MAX_BUCKETS = 5_000
const RATE_LIMIT_KEY_MAX_LENGTH = 256
const TRUST_PROXY_HEADERS =
  process.env.RATE_LIMIT_TRUST_PROXY_HEADERS === '1' ||
  process.env.VERCEL === '1' ||
  process.env.CF_PAGES === '1'

function nowMs(): number {
  return Date.now()
}

function normalizeRateLimitKey(rawKey: string): string {
  const normalized = rawKey.trim()
  if (!normalized) {
    return 'rate-limit:anonymous'
  }

  if (normalized.length <= RATE_LIMIT_KEY_MAX_LENGTH) {
    return normalized
  }

  const hashed = createHash('sha256').update(normalized).digest('hex')
  return `rate-limit:hash:${hashed}`
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 1
  }
  return Math.max(1, Math.trunc(limit))
}

function normalizeWindowMs(windowMs: number): number {
  if (!Number.isFinite(windowMs)) {
    return 1000
  }
  return Math.max(1000, Math.trunc(windowMs))
}

function normalizeRetryAfterSeconds(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 1
  }
  return Math.max(1, Math.trunc(parsed))
}

function normalizeFailClosedRetryAfterSeconds(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30
  }
  return Math.max(1, Math.min(300, Math.trunc(parsed)))
}

function normalizeRemaining(value: unknown, limit: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.min(limit, Math.trunc(parsed)))
}

function maybeLogFallback(reason: string, error: unknown): void {
  const now = nowMs()
  if (now - lastRateLimitFallbackLogAtMs < 30_000) {
    return
  }
  lastRateLimitFallbackLogAtMs = now
  logger.warn(`[RateLimit] Falling back (${reason})`, {
    context: 'RateLimit',
    errorMessage: error instanceof Error ? error.message : String(error),
  })
}

function cleanupMemoryFallbackBuckets(currentTime: number): void {
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= currentTime) {
      buckets.delete(bucketKey)
    }
  }

  while (buckets.size >= MEMORY_FALLBACK_MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined
    if (!oldestKey) {
      break
    }
    buckets.delete(oldestKey)
  }
}

function checkRateLimitMemoryFallback(key: string, options: RateLimitOptions): RateLimitResult {
  const currentTime = nowMs()
  cleanupMemoryFallbackBuckets(currentTime)
  const existing = buckets.get(key)

  if (!existing || existing.expiresAt <= currentTime) {
    const expiresAt = currentTime + options.windowMs
    buckets.set(key, {
      count: 1,
      expiresAt,
    })

    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      retryAfterSeconds: 0,
    }
  }

  const nextCount = existing.count + 1
  buckets.set(key, {
    count: nextCount,
    expiresAt: existing.expiresAt,
  })

  if (nextCount > options.limit) {
    const retryAfterMs = Math.max(existing.expiresAt - currentTime, 1000)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(options.limit - nextCount, 0),
    retryAfterSeconds: 0,
  }
}

function buildAuditBucketId(key: string, windowSeconds: number, bucketEpochSeconds: number): string {
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24)
  return `rl:${windowSeconds}:${hash}:${bucketEpochSeconds}`
}

async function checkRateLimitAuditFallback(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const now = nowMs()
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000))
  const bucketEpochSeconds = Math.floor(now / 1000 / windowSeconds) * windowSeconds
  const bucketId = buildAuditBucketId(key, windowSeconds, bucketEpochSeconds)
  const requestId = `${bucketId}:${randomUUID()}`

  const { error: insertError } = await admin
    .from('billing_audit_logs')
    .insert({
      actor_type: 'system',
      actor_id: 'rate_limiter',
      action: RATE_LIMIT_AUDIT_ACTION,
      request_id: requestId,
      provider_event_id: bucketId,
      metadata: {
        windowSeconds,
      },
    })

  if (insertError) {
    throw new Error(insertError.message)
  }

  const { count, error: countError } = await admin
    .from('billing_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('provider_event_id', bucketId)
    .eq('action', RATE_LIMIT_AUDIT_ACTION)

  if (countError) {
    throw new Error(countError.message)
  }

  const currentCount = Math.max(0, Math.trunc(Number(count || 0)))
  const allowed = currentCount <= options.limit
  const remaining = Math.max(options.limit - currentCount, 0)
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, bucketEpochSeconds + windowSeconds - Math.floor(now / 1000))

  return {
    allowed,
    remaining,
    retryAfterSeconds,
  }
}

function parseIpCandidate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const first = value
    .split(',')[0]
    ?.trim()
    .replace(/^"|"$/g, '')

  if (!first) {
    return null
  }

  // Support common proxy formats:
  // - IPv4 with port: "203.0.113.10:52344"
  // - Bracketed IPv6 with port: "[2001:db8::1]:443"
  // - Bare bracketed IPv6: "[2001:db8::1]"
  const bracketedIpv6 = first.match(/^\[([^[\]]+)\](?::\d+)?$/)?.[1]
  if (bracketedIpv6 && isIP(bracketedIpv6)) {
    return bracketedIpv6
  }

  const ipv4WithPort = first.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)?.[1]
  if (ipv4WithPort && isIP(ipv4WithPort)) {
    return ipv4WithPort
  }

  return isIP(first) ? first : null
}

function buildUnknownIpFingerprint(request: NextRequest): string {
  const fingerprintSource = [
    request.headers.get('x-forwarded-for') || '',
    request.headers.get('x-vercel-forwarded-for') || '',
    request.headers.get('x-real-ip') || '',
    request.headers.get('cf-connecting-ip') || '',
    request.headers.get('x-vercel-id') || '',
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.nextUrl.host || '',
  ].join('|')

  const digest = createHash('sha256').update(fingerprintSource).digest('hex').slice(0, 24)
  return `unknown:${digest}`
}

export function getRequestIp(request: NextRequest): string {
  const directRequestIp = parseIpCandidate((request as NextRequest & { ip?: string }).ip || null)
  if (directRequestIp) {
    return directRequestIp
  }

  if (TRUST_PROXY_HEADERS) {
    const vercelForwardedFor = parseIpCandidate(request.headers.get('x-vercel-forwarded-for'))
    if (vercelForwardedFor) {
      return vercelForwardedFor
    }

    const cfConnectingIp = parseIpCandidate(request.headers.get('cf-connecting-ip'))
    if (cfConnectingIp) {
      return cfConnectingIp
    }

    const forwardedFor = parseIpCandidate(request.headers.get('x-forwarded-for'))
    if (forwardedFor) {
      return forwardedFor
    }

    const realIp = parseIpCandidate(request.headers.get('x-real-ip'))
    if (realIp) {
      return realIp
    }
  }

  return buildUnknownIpFingerprint(request)
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const normalizedKey = normalizeRateLimitKey(key)
  const limit = normalizeLimit(options.limit)
  const windowMs = normalizeWindowMs(options.windowMs)
  const failClosedWhenUnhealthy = options.failClosedWhenUnhealthy === true
  const failClosedRetryAfterSeconds = normalizeFailClosedRetryAfterSeconds(
    options.failClosedRetryAfterSeconds
  )
  const normalizedOptions = { limit, windowMs }
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_limiter_key: normalizedKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object') {
      throw new Error('Invalid consume_rate_limit response payload')
    }

    const typedRow = row as {
      allowed?: unknown
      remaining?: unknown
      retry_after_seconds?: unknown
      retryAfterSeconds?: unknown
    }

    const allowed = Boolean(typedRow.allowed)
    const remaining = normalizeRemaining(typedRow.remaining, limit)
    const retryAfterSeconds = allowed
      ? 0
      : normalizeRetryAfterSeconds(
          typedRow.retry_after_seconds ?? typedRow.retryAfterSeconds
        )

    return {
      allowed,
      remaining,
      retryAfterSeconds,
    }
  } catch (error) {
    maybeLogFallback('consume_rate_limit_rpc_unavailable', error)
    try {
      return await checkRateLimitAuditFallback(normalizedKey, normalizedOptions)
    } catch (auditFallbackError) {
      maybeLogFallback('database_unavailable_using_memory', auditFallbackError)
      if (failClosedWhenUnhealthy) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: failClosedRetryAfterSeconds,
        }
      }
      return checkRateLimitMemoryFallback(normalizedKey, normalizedOptions)
    }
  }
}

export function getRateLimitHeaders(result: RateLimitResult, options: RateLimitOptions): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(options.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(result.retryAfterSeconds),
  }
}
