import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { serverEnv as env } from '@/lib/env/server'
import { reconcileBillingState } from '@/lib/billing/reconciliation'

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return false
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    return false
  }

  return safeEqual(token, secret)
}

function parseLimit(request: NextRequest): number {
  const queryLimit = request.nextUrl.searchParams.get('limit')
  const parsed = Number.parseInt(queryLimit || '200', 10)
  if (!Number.isFinite(parsed)) {
    return 200
  }

  return Math.max(1, Math.min(parsed, 1000))
}

function parseConcurrency(request: NextRequest): number {
  const queryConcurrency = request.nextUrl.searchParams.get('concurrency')
  const parsed = Number.parseInt(queryConcurrency || '10', 10)
  if (!Number.isFinite(parsed)) {
    return 10
  }

  return Math.max(1, Math.min(parsed, 50))
}

function parseMaxAttempts(request: NextRequest): number {
  const queryMaxAttempts = request.nextUrl.searchParams.get('maxAttempts')
  const parsed = Number.parseInt(queryMaxAttempts || '8', 10)
  if (!Number.isFinite(parsed)) {
    return 8
  }

  return Math.max(1, Math.min(parsed, 20))
}

function parseMaxBatches(request: NextRequest): number {
  const queryMaxBatches = request.nextUrl.searchParams.get('maxBatches')
  const parsed = Number.parseInt(queryMaxBatches || '5', 10)
  if (!Number.isFinite(parsed)) {
    return 5
  }

  return Math.max(1, Math.min(parsed, 30))
}

async function handleRequest(request: NextRequest) {
  try {
    const secret = env.CRON_SECRET

    if (!isAuthorized(request, secret)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const limit = parseLimit(request)
    const concurrency = parseConcurrency(request)
    const maxAttempts = parseMaxAttempts(request)
    const maxBatches = parseMaxBatches(request)
    const result = await reconcileBillingState({ limit, concurrency, maxAttempts, maxBatches })

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Billing Reconcile] Failed to reconcile billing state:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reconcile billing state',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    {
      status: 405,
      headers: {
        Allow: 'POST',
      },
    }
  )
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}
