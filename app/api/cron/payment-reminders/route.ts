import { NextResponse } from 'next/server'
import { runPaymentReminders } from '@/utils/payment-reminders'

export const dynamic = 'force-dynamic'
// Up to 90 emails with a 600ms pause between them takes about a minute.
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Cron authentication is not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const result = await runPaymentReminders()
  if (result.error) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
