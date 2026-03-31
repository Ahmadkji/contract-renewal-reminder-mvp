import { serverEnv as env } from '@/lib/env/server'

export interface CreemCheckoutRequest {
  product_id: string
  success_url: string
  request_id?: string
  metadata?: Record<string, unknown>
  customer?: {
    id?: string
    email?: string
  }
}

export interface CreemPortalRequest {
  customer_id: string
}

interface CreemApiError {
  message?: string | string[]
  error?: string
  code?: string
}

interface CreemRequestErrorOptions {
  status?: number | null
  code?: string | null
  retryable?: boolean
  retryAfterSeconds?: number | null
}

export class CreemRequestError extends Error {
  status: number | null
  code: string | null
  retryable: boolean
  retryAfterSeconds: number | null

  constructor(message: string, options: CreemRequestErrorOptions = {}) {
    super(message)
    this.name = 'CreemRequestError'
    this.status = options.status ?? null
    this.code = options.code ?? null
    this.retryable = options.retryable ?? false
    this.retryAfterSeconds = options.retryAfterSeconds ?? null
  }
}

function getCreemApiBaseUrl(): string {
  return env.CREEM_API_BASE_URL || 'https://api.creem.io'
}

function getApiKey(): string {
  if (!env.CREEM_API_KEY) {
    throw new Error('CREEM_API_KEY is not configured on the server')
  }

  return env.CREEM_API_KEY
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_CONNECT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_ABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'REQUEST_TIMEOUT',
])
const CREEM_REQUEST_TIMEOUT_MS = 5_000
const CREEM_MAX_RETRY_ATTEMPTS = 2
const CREEM_BASE_RETRY_DELAY_MS = 250
const CREEM_MAX_RETRY_DELAY_MS = 5_000
const CREEM_RETRY_JITTER_MS = 200
const CREEM_CIRCUIT_OPEN_MS = 10_000
const CREEM_CIRCUIT_FAILURE_THRESHOLD = 5

const circuitState = {
  retryableFailures: 0,
  openUntilMs: 0,
  halfOpenProbeInFlight: false,
}

function parseApiErrorMessage(apiError: CreemApiError, status: number): string {
  if (Array.isArray(apiError.message)) {
    const joined = apiError.message.filter(Boolean).join('; ').trim()
    if (joined) return joined
  }

  if (typeof apiError.message === 'string' && apiError.message.trim()) {
    return apiError.message.trim()
  }

  if (typeof apiError.error === 'string' && apiError.error.trim()) {
    return apiError.error.trim()
  }

  return `Creem API request failed (${status})`
}

function getNetworkErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'UNKNOWN'
  }

  const typed = error as { code?: unknown; cause?: unknown }
  if (typeof typed.code === 'string' && typed.code) {
    return typed.code
  }

  if (typed.cause && typeof typed.cause === 'object') {
    const causeCode = (typed.cause as { code?: unknown }).code
    if (typeof causeCode === 'string' && causeCode) {
      return causeCode
    }
  }

  return 'UNKNOWN'
}

function isRetryableNetworkErrorCode(code: string): boolean {
  return RETRYABLE_NETWORK_ERROR_CODES.has(code)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) return null
  const numeric = Number.parseInt(value, 10)
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric
  }

  const parsedDate = Date.parse(value)
  if (Number.isNaN(parsedDate)) {
    return null
  }

  const seconds = Math.ceil((parsedDate - Date.now()) / 1000)
  return seconds > 0 ? seconds : null
}

function computeRetryDelayMs(attempt: number, retryAfterSeconds?: number | null): number {
  const exponentialDelay = Math.min(
    CREEM_MAX_RETRY_DELAY_MS,
    CREEM_BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(attempt - 1, 0))
  )
  const jitter = Math.floor(Math.random() * CREEM_RETRY_JITTER_MS)
  const hintedDelay = retryAfterSeconds ? retryAfterSeconds * 1000 : 0
  return Math.max(exponentialDelay + jitter, hintedDelay)
}

function shouldTreatStatusAsRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function recordRetryableFailure(fromHalfOpenProbe: boolean = false): void {
  if (fromHalfOpenProbe) {
    circuitState.openUntilMs = Date.now() + CREEM_CIRCUIT_OPEN_MS
    circuitState.retryableFailures = 0
    circuitState.halfOpenProbeInFlight = false
    return
  }

  circuitState.retryableFailures += 1
  if (circuitState.retryableFailures >= CREEM_CIRCUIT_FAILURE_THRESHOLD) {
    circuitState.openUntilMs = Date.now() + CREEM_CIRCUIT_OPEN_MS
    circuitState.retryableFailures = 0
    circuitState.halfOpenProbeInFlight = false
  }
}

function resetCircuitState(): void {
  circuitState.retryableFailures = 0
  circuitState.openUntilMs = 0
  circuitState.halfOpenProbeInFlight = false
}

function clearHalfOpenProbe(): void {
  if (circuitState.halfOpenProbeInFlight) {
    circuitState.halfOpenProbeInFlight = false
  }
}

function enterCircuitState(): boolean {
  const now = Date.now()
  if (circuitState.openUntilMs <= now) {
    if (circuitState.openUntilMs > 0) {
      if (circuitState.halfOpenProbeInFlight) {
        throw new CreemRequestError(
          'Billing provider recovery probe in progress. Retry shortly.',
          {
            code: 'CIRCUIT_HALF_OPEN',
            retryable: true,
            retryAfterSeconds: 1,
          }
        )
      }

      circuitState.halfOpenProbeInFlight = true
      return true
    }

    return false
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((circuitState.openUntilMs - now) / 1000))
  throw new CreemRequestError(
    'Billing provider is temporarily unavailable. Retry after cooldown.',
    {
      code: 'CIRCUIT_OPEN',
      retryable: true,
      retryAfterSeconds,
    }
  )
}

async function creemRequest<T>(path: string, init: RequestInit): Promise<T> {
  const halfOpenProbe = enterCircuitState()

  const apiKey = getApiKey()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  const requestUrl = `${getCreemApiBaseUrl()}${path}`
  const maxAttempts = CREEM_MAX_RETRY_ATTEMPTS

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), CREEM_REQUEST_TIMEOUT_MS)
      const response = await (async () => {
        try {
          return await fetch(requestUrl, {
            ...init,
            headers,
            cache: 'no-store',
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeout)
        }
      })()

      const body = await parseJsonSafe(response)

      if (!response.ok) {
        const apiError: CreemApiError = body || {}
        const message = parseApiErrorMessage(apiError, response.status)
        const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'))
        const retryable = shouldTreatStatusAsRetryable(response.status)
        const requestError = new CreemRequestError(
          `Creem API request failed (${response.status}): ${message}`,
          {
            status: response.status,
            code: typeof apiError.code === 'string' ? apiError.code : null,
            retryable,
            retryAfterSeconds,
          }
        )

        if (retryable && attempt < maxAttempts) {
          await sleep(computeRetryDelayMs(attempt, retryAfterSeconds))
          continue
        }

        if (retryable) {
          recordRetryableFailure(halfOpenProbe)
        } else if (halfOpenProbe) {
          resetCircuitState()
        }

        throw requestError
      }

      resetCircuitState()
      return body as T
    } catch (error) {
      if (error instanceof CreemRequestError) {
        throw error
      }

      const code =
        error && typeof error === 'object' && 'name' in error && String((error as { name: unknown }).name) === 'AbortError'
          ? 'REQUEST_TIMEOUT'
          : getNetworkErrorCode(error)
      const retryable = isRetryableNetworkErrorCode(code)

      if (retryable && attempt < maxAttempts) {
        await sleep(computeRetryDelayMs(attempt))
        continue
      }

      if (retryable) {
        recordRetryableFailure(halfOpenProbe)
      } else if (halfOpenProbe) {
        resetCircuitState()
      }

      throw new CreemRequestError(`Creem network request failed (${code})`, {
        code,
        retryable,
      })
    }
  }

  clearHalfOpenProbe()
  throw new CreemRequestError('Creem network request failed after retries', {
    retryable: true,
  })
}

export async function createCreemCheckoutSession(
  payload: CreemCheckoutRequest
): Promise<unknown> {
  return creemRequest('/v1/checkouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createCreemCustomerBillingPortal(
  payload: CreemPortalRequest
): Promise<unknown> {
  return creemRequest('/v1/customers/billing', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getCreemSubscription(subscriptionId: string): Promise<unknown> {
  return creemRequest(`/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`, {
    method: 'GET',
  })
}

export async function getCreemProduct(productId: string): Promise<unknown> {
  return creemRequest(`/v1/products?product_id=${encodeURIComponent(productId)}`, {
    method: 'GET',
  })
}
