import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { getContractById, updateContract, deleteContract } from '@/lib/db/contracts'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRequestIp,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/security/rate-limit'
import { validateContractInput } from '@/lib/validation/contract-schema'

const CONTRACT_DETAIL_RATE_LIMIT: RateLimitOptions = {
  limit: 120,
  windowMs: 60_000,
}
const CONTRACT_MUTATION_RATE_LIMIT: RateLimitOptions = {
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

function mapContractUpdateError(error: unknown): {
  status: number
  code: string
  message: string
} {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('Contract not found or access denied')) {
    return {
      status: 404,
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found or access denied',
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
    code: 'CONTRACT_UPDATE_FAILED',
    message: 'Failed to update contract. Please try again.',
  }
}

/**
 * GET /api/contracts/[id] - Fetch single contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF Protection
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'GET /api/contracts/[id]')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`contract-detail:ip:${ip}`, CONTRACT_DETAIL_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getContractsRateLimitedResponse(ipRate, CONTRACT_DETAIL_RATE_LIMIT)
    }
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[GET /api/contracts/[id]] Session error:', sessionError)
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

    const userRate = await checkRateLimit(`contract-detail:user:${user.id}`, CONTRACT_DETAIL_RATE_LIMIT)
    if (!userRate.allowed) {
      return getContractsRateLimitedResponse(userRate, CONTRACT_DETAIL_RATE_LIMIT)
    }
    
    const { id } = await params
    
    let contract
    try {
      contract = await getContractById(id, user.id)
    } catch (dbError) {
      console.error('[GET /api/contracts/[id]] Database error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contract from database' },
        { status: 500 }
      )
    }
    
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or access denied' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { success: true, data: contract },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...getRateLimitHeaders(userRate, CONTRACT_DETAIL_RATE_LIMIT),
        },
      }
    )
  } catch (error) {
    console.error('[GET /api/contracts/[id]] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/contracts/[id] - Update contract
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF Protection
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'PATCH /api/contracts/[id]')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`contracts-mutate:ip:${ip}`, CONTRACT_MUTATION_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getContractsRateLimitedResponse(ipRate, CONTRACT_MUTATION_RATE_LIMIT)
    }
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[PATCH /api/contracts/[id]] Session error:', sessionError)
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

    const userRate = await checkRateLimit(`contracts-mutate:user:${user.id}`, CONTRACT_MUTATION_RATE_LIMIT)
    if (!userRate.allowed) {
      return getContractsRateLimitedResponse(userRate, CONTRACT_MUTATION_RATE_LIMIT)
    }

    const { id } = await params
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
      contract = await updateContract(id, {
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
      }, user.id)
    } catch (dbError) {
      console.error('[PATCH /api/contracts/[id]] Database error (update):', dbError)
      const mappedError = mapContractUpdateError(dbError)
      return NextResponse.json(
        {
          success: false,
          error: mappedError.message,
          code: mappedError.code,
        },
        { status: mappedError.status }
      )
    }

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: true, data: contract },
      {
        headers: getRateLimitHeaders(userRate, CONTRACT_MUTATION_RATE_LIMIT),
      }
    )
  } catch (error) {
    console.error('[PATCH /api/contracts/[id]] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/contracts/[id] - Delete contract
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF Protection
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'DELETE /api/contracts/[id]')
      return getOriginErrorResponse()
    }

    const ip = getRequestIp(request)
    const ipRate = await checkRateLimit(`contracts-mutate:ip:${ip}`, CONTRACT_MUTATION_RATE_LIMIT)
    if (!ipRate.allowed) {
      return getContractsRateLimitedResponse(ipRate, CONTRACT_MUTATION_RATE_LIMIT)
    }
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[DELETE /api/contracts/[id]] Session error:', sessionError)
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

    const userRate = await checkRateLimit(`contracts-mutate:user:${user.id}`, CONTRACT_MUTATION_RATE_LIMIT)
    if (!userRate.allowed) {
      return getContractsRateLimitedResponse(userRate, CONTRACT_MUTATION_RATE_LIMIT)
    }

    const { id } = await params
    
    let deleted = false
    try {
      deleted = await deleteContract(id, user.id)
    } catch (dbError) {
      console.error('[DELETE /api/contracts/[id]] Database error (delete):', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete contract from database' },
        { status: 500 }
      )
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: true },
      {
        headers: getRateLimitHeaders(userRate, CONTRACT_MUTATION_RATE_LIMIT),
      }
    )
  } catch (error) {
    console.error('[DELETE /api/contracts/[id]] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
