import { NextResponse } from 'next/server'
import { addDays, dateInTimeZone } from '@/utils/dates'
import { syncWeeklySessions } from '@/utils/weekly-sessions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Cron authentication is not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const today = dateInTimeZone()
  const result = await syncWeeklySessions(today, addDays(today, 27))
  if (result.error) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
