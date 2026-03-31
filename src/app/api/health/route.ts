import { connection, NextResponse } from 'next/server'

export async function GET() {
  await connection()

  return NextResponse.json(
    {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
