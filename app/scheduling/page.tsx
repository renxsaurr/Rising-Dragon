import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import ScheduleBoard from '@/components/ScheduleBoard'
import { getCurrentUser } from '@/utils/getCurrentUser'
import type { Schedule } from '@/components/WeeklyScheduleBoard'

// local-safe date formatter — avoids the UTC-shift bug from toISOString()
function toDateISO(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Monday-start week containing baseDate
function getWeekDates(baseDate: Date) {
  const day = baseDate.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + diffToMonday)

  const week: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    week.push(toDateISO(d))
  }
  return week
}

// Full 6-row month grid (Sun–Sat) including leading/trailing days from adjacent months
function getMonthDates(baseDate: Date) {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const startDay = firstOfMonth.getDay()
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - startDay)

  const endDay = lastOfMonth.getDay()
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(lastOfMonth.getDate() + (6 - endDay))

  const dates: string[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    dates.push(toDateISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const { date, view: viewParam } = await searchParams
  const view: 'week' | 'month' = viewParam === 'month' ? 'month' : 'week'
  const baseDate = date ? new Date(date + 'T00:00:00') : new Date()

  const weekDates = getWeekDates(baseDate)
  const monthDates = getMonthDates(baseDate)
  const rangeDates = view === 'month' ? monthDates : weekDates

  const { data: branches } = await supabase.from('Branch').select('id, name').order('name')
  const { data: coaches } = await supabase.from('User').select('id, name, role').order('name')

  const { data: schedules, error } = await supabase
    .from('ClassSchedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, Branch(name), User(name)')
    .gte('date', rangeDates[0])
    .lte('date', rangeDates[rangeDates.length - 1])
    .order('date')
    .order('time_start')

  if (error) {
    return (
      <DashboardShell title="Schedule" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Schedule" currentUser={currentUser}>
      <ScheduleBoard
        view={view}
        weekDates={weekDates}
        monthDates={monthDates}
        baseDateISO={toDateISO(baseDate)}
        initialSchedules={(schedules ?? []) as unknown as Schedule[]}
        branches={branches ?? []}
        coaches={coaches ?? []}
      />
    </DashboardShell>
  )
}