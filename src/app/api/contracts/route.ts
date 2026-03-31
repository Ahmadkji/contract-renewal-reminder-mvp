import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import {
  getAllContracts,
  createContract,
  searchContractsPaginated,
  getUpcomingExpiriesPaginated,
  type ContractsCountMode,
} from '@/lib/db/contracts'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRequestIp,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/security/rate-limit'
import { validateContractInput } from '@/lib/validation/contract-schema'
import { logger } from '@/lib/logger'
import { getRequestIdFromHeaders } from '@/lib/observability/request-id'

interface ContractsListItem {
  id: string
  name: string
  vendor: string
  type: string
  startDate: string
  endDate: string
  expiryDate: string
  daysLeft: number
  status: string
  value: number
  currency: string
  autoRenew: boolean
  emailReminders: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
}

type ContractListSource = Partial<ContractsListItem> & {
  id?: unknown
  name?: unknown
  vendor?: unknown
  type?: unknown
  startDate?: unknown
  endDate?: unknown
  expiryDate?: unknown
  daysLeft?: unknown
  status?: unknown
  value?: unknown
  currency?: unknown
  autoRenew?: unknown
  emailReminders?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  tags?: unknown
}

const ENABLE_CONTRACTS_TIMING_LOGS = process.env.CONTRACTS_API_TIMING_LOGS === '1'
const CONTRACTS_LIST_RATE_LIMIT: RateLimitOptions = {
  limit: 120,
  windowMs: 60_000,
}
const CONTRACTS_MUTATION_RATE_LIMIT: RateLimitOptions = {
  limit: 40,
  windowMs: 60_000,
}

function getContractsRateLimitedResponse(
  rateResult: RateLimitResult,
  options: RateLimitOptions
): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.min(300, Math.trunc(rateResult.retryAfterSeconds || 30)))
  return NextResponse.json(
    {
      success: false,
      code: 'CONTRACTS_RATE_LIMITED',
      error: 'Too many requests. Please try again shortly.',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(
        {
          allowed: false,
          remaining: Math.max(0, Math.trunc(rateResult.remaining || 0)),
          retryAfterSeconds,
        },
        options
      ),
    }
  )
}

function parsePositiveIntParam(
  value: string | null,
  fallback: number,
  {
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
  }: {
    min?: number
    max?: number
  } = {}
): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function toContractsListItem(contract: ContractListSource): ContractsListItem {
  return {
    id: String(contract.id || ''),
    name: String(contract.name || ''),
    vendor: String(contract.vendor || ''),
    type: String(contract.type || ''),
    startDate: String(contract.startDate || ''),
    endDate: String(contract.endDate || ''),
    expiryDate: String(contract.expiryDate || ''),
    daysLeft: typeof contract.daysLeft === 'number' && Number.isFinite(contract.daysLeft) ? contract.daysLeft : 0,
    status: String(contract.status || 'active'),
    value: typeof contract.value === 'number' && Number.isFinite(contract.value) ? contract.value : 0,
    currency: String(contract.currency || 'USD'),
    autoRenew: Boolean(contract.autoRenew),
    emailReminders: contract.emailReminders ?? false,
    createdAt: String(contract.createdAt || ''),
    updatedAt: String(contract.updatedAt || ''),
    tags: Array.isArray(contract.tags) ? contract.tags.map((tag) => String(tag)) : [],
  }
}

function roundMs(value: number): number {
  return Number(value.toFixed(2))
}

function mapContractMutationError(error: unknown): {
  status: number
  code: string
  message: string
} {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('Free plan contract limit reached')) {
    return {
      status: 403,
      code: 'PLAN_LIMIT_REACHED',
      message: 'Free plan limit reached. Please upgrade to add more contracts.',
    }
  }

  if (message.includes('Email reminders require an active premium subscription')) {
    return {
      status: 403,
      code: 'FEATURE_REQUIRES_PREMIUM',
      message: 'Email reminders require an active premium subscription.',
    }
  }

  return {
    status: 500,
    code: 'CONTRACT_MUTATION_FAILED',
    message: 'Failed to save contract. Please try again.',
  }
}

/**
 * GET /api/contracts - Fetch contracts for authenticated user
 * 
 * Supports:
 * - Pagination: ?page=1&limit=20
 * - Search: ?search=keyword
 * - Upcoming expiries: ?upcoming=true
 */
export async function GET(request: NextRequest) {
  const requestStartedAt = performance.now()
  const requestId = getRequestIdFromHeaders(request.headers)
  try {
    // CSRF Protection: Validate origin for cross-origin requests
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'GET /api/contracts')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`contracts-list:ip:${ip}`, CONTRACTS_LIST_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getContractsRateLimitedResponse(ipRate, CONTRACTS_LIST_RATE_LIMIT)
    }
   
    // Validate session using enhanced validation function
    const authStartedAt = performance.now()
    const { user, error: sessionError } = await validateSession()
    const authMs = roundMs(performance.now() - authStartedAt)
    
    if (sessionError) {
      console.error('[GET /api/contracts] Session error:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Authentication error. Please sign in again.' },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const userRate = await checkRateLimit(`contracts-list:user:${user.id}`, CONTRACTS_LIST_RATE_LIMIT)
    if (!userRate.allowed) {
      return getContractsRateLimitedResponse(userRate, CONTRACTS_LIST_RATE_LIMIT)
    }
    
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const upcoming = searchParams.get('upcoming')
    const page = parsePositiveIntParam(searchParams.get('page'), 1, { min: 1, max: 10_000 })
    const limit = parsePositiveIntParam(searchParams.get('limit'), 20, { min: 1, max: 50 })
    const countMode: ContractsCountMode =
      searchParams.get('countMode') === 'exact' ? 'exact' : 'planned'

    let result
    
    try {
      if (upcoming === 'true') {
        result = await getUpcomingExpiriesPaginated(user.id, page, limit, countMode)
      } else if (search) {
        result = await searchContractsPaginated(user.id, search, page, limit, countMode)
      } else {
        result = await getAllContracts(user.id, page, limit, countMode)
      }
    } catch (dbError) {
      console.error('[GET /api/contracts] Database error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contracts from database' },
        { status: 500 }
      )
    }

    const transformStartedAt = performance.now()
    const listItems = result.contracts.map(toContractsListItem)
    const transformMs = roundMs(performance.now() - transformStartedAt)
    const countMs = roundMs(result.timings?.countMs ?? 0)
    const listMs = roundMs(result.timings?.listMs ?? 0)
    const totalMs = roundMs(performance.now() - requestStartedAt)

    const serverTiming = [
      `auth;dur=${authMs}`,
      `db_count;dur=${countMs}`,
      `db_list;dur=${listMs}`,
      `transform;dur=${transformMs}`,
      `total;dur=${totalMs}`,
    ].join(', ')

    if (ENABLE_CONTRACTS_TIMING_LOGS) {
      logger.info('[GET /api/contracts] timing', {
        context: 'ContractsApi',
        requestId,
        userId: user.id,
        page,
        limit,
        countMode,
        hasSearch: Boolean(search),
        upcoming: upcoming === 'true',
        authMs,
        countMs,
        listMs,
        transformMs,
        totalMs,
      })
    }

    return NextResponse.json(
      { 
        success: true, 
        data: listItems,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          countMode,
        }
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Server-Timing': serverTiming,
          ...getRateLimitHeaders(userRate, CONTRACTS_LIST_RATE_LIMIT),
        }
      }
    )
  } catch (error) {
    console.error('[GET /api/contracts] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new contract - Authentication required
export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers)
  try {
    // CSRF Protection: Validate origin for cross-origin requests
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/contracts')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`contracts-mutate:ip:${ip}`, CONTRACTS_MUTATION_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getContractsRateLimitedResponse(ipRate, CONTRACTS_MUTATION_RATE_LIMIT)
    }
 
    // Validate session using enhanced validation function
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[POST /api/contracts] Session error:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Authentication error. Please sign in again.' },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const userRate = await checkRateLimit(`contracts-mutate:user:${user.id}`, CONTRACTS_MUTATION_RATE_LIMIT)
    if (!userRate.allowed) {
      return getContractsRateLimitedResponse(userRate, CONTRACTS_MUTATION_RATE_LIMIT)
    }
    
    const body = await request.json()
    
    // Validate with Zod schema
    const validationResult = validateContractInput(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }
    
    const data = validationResult.data

    let contract
    try {
      contract = await createContract(user.id, {
        name: data.name,
        vendor: data.vendor,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        value: data.value,
        currency: data.currency,
        autoRenew: data.autoRenew,
        renewalTerms: data.renewalTerms,
        notes: data.notes,
        tags: data.tags,
        vendorContact: data.vendorContact,
        vendorEmail: data.vendorEmail,
        reminderDays: data.reminderDays,
        emailReminders: data.emailReminders,
        notifyEmails: data.notifyEmails
      })
    } catch (dbError) {
      console.error('[POST /api/contracts] Database error:', {
        error: dbError instanceof Error ? dbError.message : 'unknown',
        userId: user.id,
      })
      const mappedError = mapContractMutationError(dbError)

      return NextResponse.json(
        {
          success: false,
          error: mappedError.message,
          code: mappedError.code,
        },
        { status: mappedError.status }
      )
    }

    return NextResponse.json(
      { success: true, data: contract },
      {
        status: 201,
        headers: {
          ...getRateLimitHeaders(userRate, CONTRACTS_MUTATION_RATE_LIMIT),
          'X-Request-Id': requestId,
        },
      }
    )
  } catch (error) {
    console.error('[POST /api/contracts] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
