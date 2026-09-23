import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/DashboardShell'
import AttendanceAreaChart, { type WeekPoint } from '@/components/AttendanceAreaChart'
import { AttendanceDonut, Avatar, Card, ClassTable, Delta, EmptyNote, StatCard, type ClassRow } from '@/components/DashboardWidgets'
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
  coach: { name: string } | null
}
type AttendanceRow = { schedule_id: number; date: string; status: 'Present' | 'Absent' }

const WINDOW_DAYS = 30
const CHART_WEEKS = 12

function presentRate(rows: AttendanceRow[]) {
  return rows.length ? Math.round((rows.filter((row) => row.status === 'Present').length / rows.length) * 100) : null
}

function mondayOf(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return addDays(isoDate, day === 0 ? -6 : 1 - day)
}

function shortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildWeeks(attendance: AttendanceRow[], firstMonday: string): WeekPoint[] {
  return Array.from({ length: CHART_WEEKS }, (_, index) => {
    const start = addDays(firstMonday, index * 7)
    const end = addDays(start, 6)
    const rows = attendance.filter((row) => row.date >= start && row.date <= end)
    return {
      label: shortDate(start),
      range: `${shortDate(start)} – ${shortDate(end)}`,
      present: rows.filter((row) => row.status === 'Present').length,
      total: rows.length,
    }
  })
}

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
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const today = dateInTimeZone()
  const now = manilaClock()
  const windowStart = addDays(today, -(WINDOW_DAYS - 1))
  const previousStart = addDays(windowStart, -WINDOW_DAYS)
  const chartStart = addDays(mondayOf(today), -(CHART_WEEKS - 1) * 7)
  const rangeStart = chartStart < previousStart ? chartStart : previousStart
  const weekEnd = addDays(today, 6)

  let scheduleQuery = supabase
    .from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(name)')
    .gte('date', rangeStart)
    .lte('date', weekEnd)
    .neq('status', 'Cancelled')
    .order('date')
    .order('time_start')
  if (!isHeadCoach) scheduleQuery = scheduleQuery.eq('coach_id', currentUser.id)
  const { data: scheduleData, error: scheduleError } = await scheduleQuery
  const schedules = (scheduleData ?? []) as unknown as ScheduleRow[]

  // assistant coaches only see attendance for their own classes
  let attendanceQuery = supabase.from('attendance').select('schedule_id, date, status').gte('date', rangeStart).lte('date', today)
  if (!isHeadCoach) attendanceQuery = attendanceQuery.in('schedule_id', schedules.length ? schedules.map((schedule) => schedule.id) : [-1])
  const { data: attendanceData, error: attendanceError } = await attendanceQuery
  const allAttendance = (attendanceData ?? []) as AttendanceRow[]

  const loadError = scheduleError?.message ?? attendanceError?.message
  if (loadError) {
    return <DashboardShell title="Dashboard" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load the dashboard: {loadError}</p></DashboardShell>
  }

  const attendance = allAttendance.filter((row) => row.date >= windowStart)
  const previousAttendance = allAttendance.filter((row) => row.date >= previousStart && row.date < windowStart)
  const rate = presentRate(attendance)
  const previousRate = presentRate(previousAttendance)
  const presentCount = attendance.filter((row) => row.status === 'Present').length
  const marked = new Set(allAttendance.map((row) => Number(row.schedule_id)))
  const isOver = (s: ScheduleRow) => s.date < today || (s.date === today && s.time_end <= now)

  const toRow = (s: ScheduleRow): ClassRow => {
    let status: ClassRow['status'] = { tone: 'gray', label: 'Upcoming' }
    if (s.date === today && s.time_start <= now && now < s.time_end) status = { tone: 'amber', label: 'In session' }
    else if (isOver(s)) status = marked.has(s.id) ? { tone: 'green', label: 'Recorded' } : { tone: 'red', label: 'Not recorded' }
    return {
      id: s.id,
      date: s.date,
      time: `${formatTime(s.time_start)} – ${formatTime(s.time_end)}`,
      branch: s.branch?.name ?? 'Branch',
      coach: s.coach?.name ?? 'Coach',
      status,
    }
  }

  const todaysClasses = schedules.filter((s) => s.date === today)
  const upcomingClasses = schedules.filter((s) => s.date > today)
  const pendingClasses = schedules.filter((s) => s.date >= windowStart && isOver(s) && !marked.has(s.id)).reverse()
  const todayChip = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const rateCard = (
    <StatCard
      title="Attendance rate"
      chip="30 days"
      value={rate === null ? '–' : `${rate}%`}
      delta={rate !== null && previousRate !== null ? <Delta value={rate - previousRate} suffix=" pts" /> : undefined}
      compare={previousRate === null ? 'No records in the previous 30 days' : `Compared to ${previousRate}% the previous 30 days`}
      footer={{ label: 'Check-ins recorded', value: attendance.length }}
    />
  )

  const donutCard = (
    <Card title="Present vs Absent" chip="30 days">
      <AttendanceDonut present={presentCount} absent={attendance.length - presentCount} />
    </Card>
  )

  const todayCard = (
    <Card title="Today's classes" chip={todayChip} flush>
      {todaysClasses.length
        ? <div className="pb-2"><ClassTable rows={todaysClasses.map(toRow)} /></div>
        : <div className="px-5 pb-5"><EmptyNote>No classes scheduled today.</EmptyNote></div>}
    </Card>
  )

  const chartCard = (
    <Card title="Attendance summary" chip={`Last ${CHART_WEEKS} weeks`}>
      <AttendanceAreaChart weeks={buildWeeks(allAttendance.filter((row) => row.date >= chartStart), chartStart)} />
    </Card>
  )

  const pendingCard = pendingClasses.length > 0 && (
    <Card
      title="Attendance not recorded"
      flush
      action={<Link href={`/attendance?date=${pendingClasses[0].date}&scheduleId=${pendingClasses[0].id}`} className="text-xs font-medium text-red-600 hover:text-red-700">Record now</Link>}
    >
      <div className="pb-2"><ClassTable rows={pendingClasses.slice(0, 5).map(toRow)} showDate /></div>
    </Card>
  )

  if (!isHeadCoach) {
    let assignedBranchIds: number[] = []
    try {
      assignedBranchIds = await getCoachBranchIdsForDate(currentUser.id, today)
    } catch {
      // falls back to 0 if assignments cannot be read
    }
    const { count: studentCount } = assignedBranchIds.length
      ? await supabase.from('student').select('id', { count: 'exact', head: true }).in('branch_id', assignedBranchIds)
      : { count: 0 }
    const coached = schedules.filter((s) => s.date >= windowStart && isOver(s)).length
    const coachedBefore = schedules.filter((s) => s.date >= previousStart && s.date < windowStart).length

    return (
      <DashboardShell title="Dashboard" currentUser={currentUser}>
        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <div className="space-y-6">
            <StatCard
              title="My classes"
              chip="Today"
              value={todaysClasses.length}
              compare={`${upcomingClasses.length} more in the next 7 days`}
              footer={{ label: 'Students at my branches', value: studentCount ?? 0 }}
            />
            {rateCard}
            <StatCard
              title="Classes coached"
              chip="30 days"
              value={coached}
              delta={<Delta value={coached - coachedBefore} suffix="" />}
              compare={`Compared to ${coachedBefore} the previous 30 days`}
              footer={{ label: 'Awaiting attendance', value: pendingClasses.length }}
            />
            {donutCard}
          </div>
          <div className="min-w-0 space-y-6">
            {todayCard}
            {pendingCard}
            {chartCard}
            <Card title="Upcoming classes" chip="Next 7 days" flush>
              {upcomingClasses.length
                ? <div className="pb-2"><ClassTable rows={upcomingClasses.map(toRow)} showDate /></div>
                : <div className="px-5 pb-5"><EmptyNote>Nothing scheduled in the next 7 days.</EmptyNote></div>}
            </Card>
          </div>
        </div>
      </DashboardShell>
    )
  }

  const [studentsResult, branchesResult, coachesResult] = await Promise.all([
    supabase.from('student').select('id, first_name, last_name, belt_level, branch_id, enrollment_date, branch:branch!student_branch_id_fkey(name)').order('enrollment_date', { ascending: false }),
    supabase.from('branch').select('id, name').order('name'),
    supabase.from('user').select('id', { count: 'exact', head: true }).in('role', ['head_coach', 'assistant_coach']),
  ])
  const extraError = studentsResult.error?.message ?? branchesResult.error?.message ?? coachesResult.error?.message
  if (extraError) {
    return <DashboardShell title="Dashboard" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load the dashboard: {extraError}</p></DashboardShell>
  }

  const students = (studentsResult.data ?? []) as unknown as { id: number; first_name: string; last_name: string; belt_level: string; branch_id: number; enrollment_date: string; branch: { name: string } | null }[]
  const branches = branchesResult.data ?? []
  const monthStart = `${today.slice(0, 7)}-01`
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`
  const newThisMonth = students.filter((student) => student.enrollment_date >= monthStart).length
  const newLastMonth = students.filter((student) => student.enrollment_date >= lastMonthStart && student.enrollment_date < monthStart).length

  const branchOfSchedule = new Map(schedules.map((s) => [Number(s.id), Number(s.branch_id)]))
  const branchRows = branches.map((branch) => {
    const id = Number(branch.id)
    return {
      id,
      name: branch.name as string,
      students: students.filter((student) => Number(student.branch_id) === id).length,
      rate: presentRate(attendance.filter((row) => branchOfSchedule.get(Number(row.schedule_id)) === id)),
      classes: schedules.filter((s) => Number(s.branch_id) === id && s.date >= today).length,
    }
  }).sort((a, b) => b.students - a.students)

  return (
    <DashboardShell title="Dashboard" currentUser={currentUser}>
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <StatCard
            title="Students"
            chip="This month"
            value={students.length}
            delta={<Delta value={newThisMonth} suffix=" new" />}
            compare={`Compared to ${newLastMonth} new last month`}
            footer={{ label: 'Branches · Coaches', value: `${branches.length} · ${coachesResult.count ?? 0}` }}
          />
          {rateCard}
          {donutCard}
        </div>

        <div className="min-w-0 space-y-6">
          {todayCard}
          {pendingCard}
          {chartCard}

          <div className="grid gap-6 2xl:grid-cols-[1.4fr_1fr]">
            <Card title="Branch overview" flush action={<Link href="/branches" className="text-xs font-medium text-gray-500 hover:text-gray-900">View all</Link>}>
              {branchRows.length === 0 ? <div className="px-5 pb-5"><EmptyNote>No branches yet.</EmptyNote></div> : (
                <div className="overflow-x-auto pb-2">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="th w-14">No.</th>
                        <th className="th">Branch</th>
                        <th className="th text-right">Students</th>
                        <th className="th w-2/5">Attendance</th>
                        <th className="th text-right">Classes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {branchRows.map((branch, index) => (
                        <tr key={branch.id}>
                          <td className="px-5 py-3 text-[13px] tabular-nums text-gray-500">{String(index + 1).padStart(2, '0')}</td>
                          <td className="px-5 py-3"><Link href={`/branches/${branch.id}`} className="text-sm font-medium text-gray-900 hover:text-red-600">{branch.name}</Link></td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-700">{branch.students}</td>
                          <td className="px-5 py-3">
                            {branch.rate === null ? <span className="text-[13px] text-gray-400">No records</span> : (
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 flex-1 rounded-full bg-gray-100"><div className="h-full rounded-full bg-red-500" style={{ width: `${branch.rate}%` }} /></div>
                                <span className="w-9 text-right text-[13px] tabular-nums text-gray-700">{branch.rate}%</span>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-700">{branch.classes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Recent enrollments" flush action={<Link href="/students" className="text-xs font-medium text-gray-500 hover:text-gray-900">View all</Link>}>
              {students.length === 0 ? <div className="px-5 pb-5"><EmptyNote>No students yet.</EmptyNote></div> : (
                <ul className="divide-y divide-gray-100 border-t border-gray-100 pb-2">
                  {students.slice(0, 5).map((student) => (
                    <li key={student.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={`${student.first_name} ${student.last_name}`} soft />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{student.first_name} {student.last_name}</p>
                        <p className="truncate text-xs text-gray-500">{student.branch?.name ?? 'Branch'} · {formatBeltLabel(student.belt_level)}</p>
                      </div>
                      <span className="chip">{shortDate(student.enrollment_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
