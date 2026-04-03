import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { serverEnv as env } from '@/lib/env/server'
import { processDueEmailReminders } from '@/lib/reminders/reminder-processor'

interface ReminderProcessRequestBody {
  dryRun?: boolean
  limit?: number
  runAt?: string
}

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

  const providedSecret = authorization.slice('Bearer '.length).trim()
  if (!providedSecret) {
    return false
  }

  return safeEqual(providedSecret, secret)
}

function parseBoolean(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  return value === 'true' || value === '1'
}

function parseLimit(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseRunAt(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

async function parseBody(request: NextRequest): Promise<ReminderProcessRequestBody> {
  if (request.method !== 'POST') {
    return {}
  }

  try {
    return (await request.json()) as ReminderProcessRequestBody
  } catch {
    return {}
  }
}

async function handleRequest(request: NextRequest) {
  try {
    const cronSecret = env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'CRON_SECRET is not configured on the server',
        },
        { status: 500 }
      )
    }

    if (!isAuthorized(request, cronSecret)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const body = await parseBody(request)
    const searchParams = request.nextUrl.searchParams
    const result = await processDueEmailReminders({
      dryRun: parseBoolean(body.dryRun ?? searchParams.get('dryRun')),
      limit: parseLimit(body.limit ?? searchParams.get('limit')),
      runAt: parseRunAt(body.runAt ?? searchParams.get('runAt')),
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process reminders',
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
