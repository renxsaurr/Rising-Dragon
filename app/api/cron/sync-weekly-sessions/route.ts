import { NextResponse } from 'next/server'
import { addDays, dateInTimeZone } from '@/utils/dates'
import { syncWeeklySessions } from '@/utils/weekly-sessions'
import { ensureUpcomingMonthlyBills } from '@/utils/monthly-billing'
import { sendScheduledPaymentReminders } from '@/utils/payment-reminders'

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
  const [sessions, bills] = await Promise.all([
    syncWeeklySessions(today, addDays(today, 27)),
    ensureUpcomingMonthlyBills(today),
  ])
  const reminders = await sendScheduledPaymentReminders(today)
  const status = sessions.error || bills.error || reminders.error ? 500 : 200
  return NextResponse.json({ sessions, monthlyBills: bills, reminders }, { status })
}
