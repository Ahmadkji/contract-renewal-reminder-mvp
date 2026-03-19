import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/supabase/server'
import { getContractById, updateContract, deleteContract } from '@/lib/db/contracts'
import { validateOrigin, getOriginErrorResponse, logInvalidOriginAttempt } from '@/lib/security/csrf'
import { validateContractInput } from '@/lib/validation/contract-schema'
import { updateTag } from 'next/cache'

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
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[GET /api/contracts/[id]] Session error:', sessionError)
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
    
    return NextResponse.json({ success: true, data: contract })
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
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[PATCH /api/contracts/[id]] Session error:', sessionError)
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

    const { id } = await params
    const body = await request.json()
    
    // Check ownership before updating
    let existingContract
    try {
      existingContract = await getContractById(id, user.id)
    } catch (dbError) {
      console.error('[PATCH /api/contracts/[id]] Database error (fetch):', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify contract ownership' },
        { status: 500 }
      )
    }
    
    if (!existingContract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or access denied' },
        { status: 404 }
      )
    }
    
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
      })
    } catch (dbError) {
      console.error('[PATCH /api/contracts/[id]] Database error (update):', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to update contract in database' },
        { status: 500 }
      )
    }

    // Invalidate cache
    updateTag(`user-${user.id}`)

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: contract })
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
    
    // Validate session using enhanced validation
    const { user, error: sessionError } = await validateSession()
    
    if (sessionError) {
      console.error('[DELETE /api/contracts/[id]] Session error:', sessionError)
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

    const { id } = await params
    
    // Check ownership before deleting
    let existingContract
    try {
      existingContract = await getContractById(id, user.id)
    } catch (dbError) {
      console.error('[DELETE /api/contracts/[id]] Database error (fetch):', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify contract ownership' },
        { status: 500 }
      )
    }
    
    if (!existingContract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or access denied' },
        { status: 404 }
      )
    }
    
    try {
      await deleteContract(id)
    } catch (dbError) {
      console.error('[DELETE /api/contracts/[id]] Database error (delete):', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete contract from database' },
        { status: 500 }
      )
    }

    // Invalidate cache
    updateTag(`user-${user.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/contracts/[id]] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
