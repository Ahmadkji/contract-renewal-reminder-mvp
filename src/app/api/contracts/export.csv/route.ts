import { NextRequest, NextResponse, connection } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { validateSession } from '@/lib/supabase/server'
import { getAllContracts } from '@/lib/db/contracts'
import { canUseFeature, getOrCreateEntitlementSnapshot } from '@/lib/billing/entitlements'

const FORMULA_PREFIX_PATTERN = /^[\t\r ]*[=+\-@]/

function sanitizeCsvFormula(value: string): string {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`
  }

  return value
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = typeof value === 'string' ? sanitizeCsvFormula(value) : String(value)
  if (!/[",\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return 'name,vendor,type,startDate,endDate,status,daysLeft,value,currency,autoRenew,emailReminders\n'
  }

  const headers = [
    'name',
    'vendor',
    'type',
    'startDate',
    'endDate',
    'status',
    'daysLeft',
    'value',
    'currency',
    'autoRenew',
    'emailReminders',
  ]

  const lines = [headers.join(',')]

  for (const row of rows) {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(','))
  }

  return `${lines.join('\n')}\n`
}

export async function GET(_request: NextRequest) {
  try {
    await connection()

    const { user, error: sessionError } = await validateSession()
    if (sessionError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const snapshot = await getOrCreateEntitlementSnapshot(user.id, 'contracts_export')
    if (!canUseFeature(snapshot, 'csvExport')) {
      return NextResponse.json(
        {
          success: false,
          code: 'FEATURE_REQUIRES_PREMIUM',
          error: 'CSV export requires an active premium subscription.',
        },
        { status: 403 }
      )
    }

    const result = await getAllContracts(user.id, 1, 5000)

    const csv = buildCsv(
      result.contracts.map((contract) => ({
        name: contract.name,
        vendor: contract.vendor,
        type: contract.type,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        daysLeft: contract.daysLeft,
        value: contract.value,
        currency: contract.currency,
        autoRenew: contract.autoRenew,
        emailReminders: contract.emailReminders,
      }))
    )

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contracts.csv"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    unstable_rethrow(error)
    console.error('[Contracts Export] Failed to export CSV:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export contracts',
      },
      { status: 500 }
    )
  }
}
