import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/DashboardShell'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { addDays, dateInTimeZone, formatTime } from '@/utils/dates'
import { formatBeltLabel } from '@/utils/belts'

type ScheduleRow = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  status: string
  branch: { name: string } | null
  coach: { first_name: string; middle_name: string | null; last_name: string } | null
}

type AttendanceRow = { schedule_id: number; date: string; status: string }

function manilaClock() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Manila' })
      .formatToParts(new Date()).map((part) => [part.type, part.value]),
  )
  return `${parts.hour}:${parts.minute}:${parts.second}`
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const isHeadCoach = currentUser.role === 'head_coach'
  const today = dateInTimeZone()
  const weekStart = addDays(today, -6)
  const now = manilaClock()
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  let assignedBranchIds: number[] = []
  if (!isHeadCoach) {
    try {
      assignedBranchIds = await getCoachBranchIdsForDate(currentUser.id, today)
    } catch {
      // Fail closed: if today's assignments cannot be read, show no branch data.
      assignedBranchIds = []
    }
  }

  let scheduleQuery = supabase
    .from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
    .gte('date', weekStart)
    .lte('date', today)
    .neq('status', 'Cancelled')
    .order('time_start')
  if (!isHeadCoach) scheduleQuery = scheduleQuery.eq('coach_id', currentUser.id)

  const [scheduleResult, studentResult, beltResult, paymentResult] = await Promise.all([
    scheduleQuery,
    (() => {
      let query = supabase.from('student').select('id', { count: 'exact', head: true }).eq('is_active', true)
      if (!isHeadCoach) query = assignedBranchIds.length ? query.in('branch_id', assignedBranchIds) : query.eq('branch_id', -1)
      return query
    })(),
    (() => {
      let query = supabase.from('student').select('belt_level').eq('is_active', true)
      if (!isHeadCoach) query = assignedBranchIds.length ? query.in('branch_id', assignedBranchIds) : query.eq('branch_id', -1)
      return query
    })(),
    isHeadCoach
      ? supabase.from('payment').select('id', { count: 'exact', head: true }).neq('status', 'Paid').lte('due_date', today)
      : Promise.resolve({ count: null, error: null }),
  ])

  const schedules = (scheduleResult.data ?? []) as unknown as ScheduleRow[]
  const todaysSchedules = schedules.filter((schedule) => schedule.date === today)
  const scheduleIds = schedules.map((schedule) => Number(schedule.id))
  const attendanceResult = scheduleIds.length
    ? await supabase.from('attendance').select('schedule_id, date, status').in('schedule_id', scheduleIds)
    : { data: [], error: null }
  const attendance = (attendanceResult.data ?? []) as AttendanceRow[]

  const error = scheduleResult.error?.message ?? studentResult.error?.message ?? beltResult.error?.message ?? paymentResult.error?.message ?? attendanceResult.error?.message
  if (error) {
    return <DashboardShell title="Dashboard" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load the dashboard: {error}</p></DashboardShell>
  }

  const attendanceBySchedule = new Set(attendance.map((row) => Number(row.schedule_id)))
  const isPast = (schedule: ScheduleRow) => schedule.time_end <= now
  const pendingAttendance = todaysSchedules.filter((schedule) => isPast(schedule) && !attendanceBySchedule.has(Number(schedule.id)))
  const dailyAttendance = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      count: attendance.filter((row) => row.date === date && row.status === 'Present').length,
    }
  })
  const maxDailyAttendance = Math.max(1, ...dailyAttendance.map((day) => day.count))
  const weeklyCheckIns = dailyAttendance.reduce((total, day) => total + day.count, 0)

  const beltCounts = new Map<string, number>()
  for (const student of beltResult.data ?? []) beltCounts.set(student.belt_level, (beltCounts.get(student.belt_level) ?? 0) + 1)
  const sortedBelts = [...beltCounts.entries()].sort((a, b) => b[1] - a[1])
  const shownBelts = sortedBelts.slice(0, 5)
  const otherBelts = sortedBelts.slice(5).reduce((total, [, count]) => total + count, 0)
  if (otherBelts) shownBelts.push(['other', otherBelts])

  const metrics = [
    { label: isHeadCoach ? 'Active students' : 'Students at today’s branches', value: studentResult.count ?? 0 },
    { label: isHeadCoach ? 'Classes today' : 'My classes today', value: todaysSchedules.length },
    { label: 'Attendance to record', value: pendingAttendance.length },
    ...(isHeadCoach ? [{ label: 'Payments due or overdue', value: paymentResult.count ?? 0 }] : []),
  ]
  const todayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <DashboardShell title="Dashboard" currentUser={currentUser}>
      <div className="space-y-5">
        <section aria-label="Dashboard metrics" className="card overflow-hidden bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Today at a glance</h2>
              <p className="mt-0.5 text-xs text-gray-500">{isHeadCoach ? 'A quick view across all branches' : 'Your scheduled branches and classes'}</p>
            </div>
            <span className="text-xs font-medium text-gray-500">{todayLabel}</span>
          </div>
          <div className={`grid grid-cols-2 divide-x divide-y divide-gray-100 sm:divide-y-0 ${isHeadCoach ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {metrics.map((metric) => (
              <div key={metric.label} className="px-5 py-4 sm:py-5">
                <p className="text-2xl font-semibold tracking-tight text-gray-950 tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid items-stretch gap-5 xl:grid-cols-3">
          <Card title="Today’s classes" chip={`${todaysSchedules.length}`} flush className="bg-white">
            {todaysSchedules.length ? (
              <ul className="divide-y divide-gray-100 pb-1">
                {todaysSchedules.map((schedule) => {
                  const active = schedule.time_start <= now && now < schedule.time_end
                  const ended = isPast(schedule)
                  const hasAttendance = attendanceBySchedule.has(Number(schedule.id))
                  const label = active ? 'In session' : ended ? hasAttendance ? 'Attendance entered' : 'Not recorded' : 'Upcoming'
                  const tone = active ? 'bg-amber-50 text-amber-700' : ended ? hasAttendance ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                  return (
                    <li key={schedule.id}>
                      <Link href={`/attendance?date=${schedule.date}&scheduleId=${schedule.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50">
                        <span className="min-w-[84px] rounded-lg bg-gray-50 px-2 py-2 text-center text-xs font-semibold tabular-nums text-gray-700">{formatTime(schedule.time_start)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900">{schedule.branch?.name ?? 'Branch'}</span>
                          <span className="mt-0.5 block truncate text-xs text-gray-500">{schedule.coach ? [schedule.coach.first_name, schedule.coach.middle_name, schedule.coach.last_name].filter(Boolean).join(' ') : 'Coach'}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${tone}`}>{label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : <div className="px-5 pb-5"><EmptyNote>{isHeadCoach ? 'No classes are scheduled across the branches today.' : 'You have no classes assigned today.'}</EmptyNote></div>}
          </Card>

          <Card title="Attendance activity" chip="Last 7 days" className="bg-white">
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{weeklyCheckIns}</span>
              <span className="text-xs text-gray-500">check-ins recorded</span>
            </div>
            {weeklyCheckIns ? (
              <div className="flex h-32 items-end justify-between gap-2 border-b border-gray-100 pb-2" role="img" aria-label={`Daily attendance check-ins for the last seven days; ${weeklyCheckIns} total`}>
                {dailyAttendance.map((day) => (
                  <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] tabular-nums text-gray-400">{day.count || ''}</span>
                    <div className="flex h-20 w-full items-end rounded-t-md bg-gray-50">
                      <div className="w-full rounded-t-md bg-red-500 transition-all" style={{ height: `${day.count ? Math.max(8, (day.count / maxDailyAttendance) * 100) : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{day.label}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyNote>No attendance entries in the last seven days.</EmptyNote>}
            <p className="mt-3 text-[11px] text-gray-400">Only recorded present entries are counted.</p>
          </Card>

          <Card title="Students by belt" chip={`${studentResult.count ?? 0} active`} className="bg-white">
            {shownBelts.length ? (
              <ul className="space-y-3">
                {shownBelts.map(([belt, count]) => {
                  const label = belt === 'other' ? 'Other belts' : formatBeltLabel(belt)
                  const percent = Math.round((count / Math.max(1, studentResult.count ?? 0)) * 100)
                  const barColor = belt.includes('black') ? 'bg-gray-800' : belt.includes('yellow') ? 'bg-yellow-400' : belt.includes('blue') ? 'bg-blue-500' : belt.includes('red') ? 'bg-red-500' : belt.includes('brown') ? 'bg-amber-800' : belt === 'practitioner' ? 'bg-emerald-500' : 'bg-gray-300'
                  return (
                    <li key={belt}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-gray-700">{label}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : <EmptyNote>No active student records to summarize.</EmptyNote>}
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
