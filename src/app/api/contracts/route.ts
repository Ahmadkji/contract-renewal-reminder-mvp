import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import {
  getAllContracts,
  createContract,
  searchContractsPaginated,
  getUpcomingExpiriesPaginated
} from '@/lib/db/contracts'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { validateContractInput } from '@/lib/validation/contract-schema'
import { revalidateTag } from 'next/cache'

/**
 * GET /api/contracts - Fetch contracts for authenticated user
 * 
 * Supports:
 * - Pagination: ?page=1&limit=20
 * - Search: ?search=keyword
 * - Upcoming expiries: ?upcoming=true
 */
export async function GET(request: NextRequest) {
  try {
    // CSRF Protection: Validate origin for cross-origin requests
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'GET /api/contracts')
      return getOriginErrorResponse()
    }
   
    // Validate session using enhanced validation function
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[GET /api/contracts] Session error:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Authentication error. Please sign in again.', details: sessionError },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }
    
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const upcoming = searchParams.get('upcoming')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    let result
    
    try {
      if (upcoming === 'true') {
        result = await getUpcomingExpiriesPaginated(user.id, page, limit)
      } else if (search) {
        result = await searchContractsPaginated(user.id, search, page, limit)
      } else {
        result = await getAllContracts(user.id, page, limit)
      }
    } catch (dbError) {
      console.error('[GET /api/contracts] Database error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contracts from database' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        data: result.contracts,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
          'Pragma': 'no-cache'
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
  try {
    // CSRF Protection: Validate origin for cross-origin requests
    if (!validateOrigin(request)) {
      logInvalidOriginAttempt(request, 'POST /api/contracts')
      return getOriginErrorResponse()
    }
 
    // Validate session using enhanced validation function
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[POST /api/contracts] Session error:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Authentication error. Please sign in again.', details: sessionError },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
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
      // FIX #5: Return specific error details for debugging
      console.error('[POST /api/contracts] Database error:', {
        error: dbError,
        userId: user.id,
        input: data
      })
      
      const errorMessage = dbError instanceof Error
        ? dbError.message
        : 'Failed to create contract in database';
      
      // Include error code for client handling
      const errorCode = dbError instanceof Error && 'code' in (dbError as any)
        ? (dbError as any).code
        : 'UNKNOWN';
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: errorCode
        },
        { status: 500 }
      )
    }

    // FIX #7: Revalidate cache after success (use revalidateTag for Route Handlers)
    // Next.js 16: revalidateTag now requires a second argument for cacheLife profile
    revalidateTag(`user-${user.id}`, 'max')

    return NextResponse.json({ success: true, data: contract }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/contracts] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
