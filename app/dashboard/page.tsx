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
import { Activity, ArrowUpRight, CalendarDays, ClipboardCheck, Medal, UsersRound, WalletCards } from 'lucide-react'

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
    .neq('status', 'Draft')
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
    { label: isHeadCoach ? 'Active students' : 'Students at today’s branches', value: studentResult.count ?? 0, note: 'Current enrollment', Icon: UsersRound },
    { label: isHeadCoach ? 'Classes today' : 'My classes today', value: todaysSchedules.length, note: todaysSchedules.length ? 'On the schedule today' : 'No classes scheduled', Icon: CalendarDays },
    { label: 'Attendance to record', value: pendingAttendance.length, note: pendingAttendance.length ? 'Completed classes need attention' : 'No completed classes waiting', Icon: ClipboardCheck },
    ...(isHeadCoach ? [{ label: 'Payments due or overdue', value: paymentResult.count ?? 0, note: paymentResult.count ? 'Needs follow-up' : 'No payments due today', Icon: WalletCards }] : []),
  ]
  const todayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <DashboardShell title="Dashboard" currentUser={currentUser}>
      <div className="space-y-5">
        <section aria-label="Dashboard metrics" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-950">Today at a glance</h2>
              <p className="mt-1 text-sm text-gray-700">{isHeadCoach ? 'A quick view across all branches' : 'Your scheduled branches and classes'}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-800">
              <CalendarDays className="h-4 w-4 text-gray-950" aria-hidden />{todayLabel}
            </span>
          </div>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5 ${isHeadCoach ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-gray-900">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{metric.value}</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-950 ring-1 ring-inset ring-gray-200/80">
                    <metric.Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                </div>
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-5 text-gray-700">{metric.note}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid items-stretch gap-5 xl:grid-cols-3">
          <Card title={<><CalendarDays className="h-4 w-4 text-gray-950" aria-hidden />Today’s classes</>} chip={`${todaysSchedules.length}`} flush className="rounded-2xl border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03] transition-shadow duration-200 hover:shadow-md">
            {todaysSchedules.length ? (
              <ul className="divide-y divide-gray-100 pb-1">
                {todaysSchedules.map((schedule) => {
                  const active = schedule.time_start <= now && now < schedule.time_end
                  const ended = isPast(schedule)
                  const hasAttendance = attendanceBySchedule.has(Number(schedule.id))
                  const label = active ? 'In session' : ended && !hasAttendance ? 'Not recorded' : !ended ? 'Upcoming' : null
                  const tone = active ? 'bg-amber-50 text-amber-700' : ended ? hasAttendance ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                  return (
                    <li key={schedule.id}>
                      <Link href={`/attendance?date=${schedule.date}&scheduleId=${schedule.id}`} className="group/row grid grid-cols-[minmax(84px,auto)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3.5 transition hover:bg-red-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                        <span className="min-w-[84px] shrink-0 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-center text-xs font-semibold tabular-nums text-gray-800 transition group-hover/row:border-red-100 group-hover/row:bg-white">{formatTime(schedule.time_start)}</span>
                        <span className="min-w-0 break-words">
                          <span className="block whitespace-normal break-words text-sm font-medium leading-5 text-gray-950">{schedule.branch?.name ?? 'Branch'}</span>
                          <span className="mt-0.5 block whitespace-normal break-words text-xs leading-5 text-gray-700">{schedule.coach ? [schedule.coach.first_name, schedule.coach.middle_name, schedule.coach.last_name].filter(Boolean).join(' ') : 'Coach'}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {label && <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${tone}`}>{label}</span>}
                          <ArrowUpRight className="h-4 w-4 text-gray-600 transition group-hover/row:text-gray-950" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : <div className="px-5 pb-5"><EmptyNote>{isHeadCoach ? 'No classes are scheduled across the branches today.' : 'You have no classes assigned today.'}</EmptyNote></div>}
          </Card>

          <Card title={<><Activity className="h-4 w-4 text-gray-950" aria-hidden />Attendance activity</>} chip="Last 7 days" className="flex h-full flex-col rounded-2xl border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03] transition-shadow duration-200 hover:shadow-md" contentClassName="flex flex-1 flex-col">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{weeklyCheckIns}</span>
                <span className="text-xs text-gray-700">check-ins</span>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700">Present</span>
            </div>
            {weeklyCheckIns ? (
              <div className="flex min-h-48 flex-1 items-end justify-between gap-2 rounded-xl bg-white px-3 pt-3" role="img" aria-label={`Daily attendance check-ins for the last seven days; ${weeklyCheckIns} total`}>
                {dailyAttendance.map((day) => (
                  <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${day.label}: ${day.count} present`}>
                    <span className="text-[10px] font-medium tabular-nums text-gray-800">{day.count || ''}</span>
                    <div className="flex min-h-20 w-full max-w-8 flex-1 items-end rounded-t-md bg-gray-200/70">
                      <div className="w-full rounded-t-md bg-gradient-to-t from-red-600 to-rose-400 transition-all" style={{ height: `${day.count ? Math.max(8, (day.count / maxDailyAttendance) * 100) : 0}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-700">{day.label}</span>
                  </div>
                ))}
              </div>
            ) : <p className="grid min-h-48 flex-1 place-items-center rounded-lg bg-white text-sm text-gray-700">No attendance entries in the last seven days.</p>}
          </Card>

          <Card title={<><Medal className="h-4 w-4 text-gray-950" aria-hidden />Students by belt</>} chip={`${studentResult.count ?? 0} active`} className="rounded-2xl border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03] transition-shadow duration-200 hover:shadow-md">
            {shownBelts.length ? (
              <ul className="space-y-3">
                {shownBelts.map(([belt, count]) => {
                  const label = belt === 'other' ? 'Other belts' : formatBeltLabel(belt)
                  const percent = Math.round((count / Math.max(1, studentResult.count ?? 0)) * 100)
                  const barColor = belt.includes('black') ? 'bg-gray-800' : belt.includes('yellow') ? 'bg-yellow-400' : belt.includes('blue') ? 'bg-blue-500' : belt.includes('red') ? 'bg-red-500' : belt.includes('brown') ? 'bg-amber-800' : belt === 'practitioner' ? 'bg-emerald-500' : 'bg-gray-300'
                  return (
                    <li key={belt}>
                      <div className="mb-1.5 flex items-start justify-between gap-2 text-xs">
                        <span className="min-w-0 whitespace-normal break-words font-medium leading-5 text-gray-900">{label}</span>
                        <span className="shrink-0 tabular-nums text-gray-800">{count}<span className="ml-1 text-gray-700">· {percent}%</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
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
