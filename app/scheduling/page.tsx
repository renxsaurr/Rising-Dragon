import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import WeeklyScheduleBoard from '@/components/WeeklyScheduleBoard'
import { getCurrentUser } from '@/utils/getCurrentUser'
import type { Schedule } from '@/components/WeeklyScheduleBoard'

// helper — get Monday of the current week as YYYY-MM-DD
function getWeekDates() {
  const today = new Date()
  const day = today.getDay() // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)

  const week = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    week.push(d.toISOString().split('T')[0]) // "2026-09-21" format
  }
  return week
}

export default async function SchedulingPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const weekDates = getWeekDates()

  // fetch branches (for the "add schedule" dropdown)
  const { data: branches } = await supabase.from('Branch').select('id, name').order('name')

  // fetch coaches — everyone in User table can be assigned a class
  const { data: coaches } = await supabase.from('User').select('id, name, role').order('name')

  // fetch this week's schedule, joined with branch + coach names
  const { data: schedules, error } = await supabase
    .from('ClassSchedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, Branch(name), User(name)')
    .gte('date', weekDates[0])
    .lte('date', weekDates[6])
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
      <WeeklyScheduleBoard
        weekDates={weekDates}
        initialSchedules={(schedules ?? []) as unknown as Schedule[]}
        branches={branches ?? []}
        coaches={coaches ?? []}
      />
    </DashboardShell>
  )
}