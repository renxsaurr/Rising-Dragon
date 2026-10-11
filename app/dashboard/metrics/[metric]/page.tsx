import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import BackToDashboardButton from '@/components/BackToDashboardButton'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createClient } from '@/utils/supabase/server'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { dateInTimeZone, formatTime } from '@/utils/dates'
import { beltTextColorClass, formatBeltLabel } from '@/utils/belts'
import { formatPeso } from '@/utils/payment-fees'

type MetricKey = 'students' | 'classes' | 'attendance' | 'payments'
type Cell = { text: string; className?: string }
type DetailRow = { id: number; cells: Cell[] }
type ScheduleRow = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch: { name: string } | null
  coach: { first_name: string; middle_name: string | null; last_name: string } | null
}

const titles: Record<MetricKey, (isHeadCoach: boolean) => string> = {
  students: (isHeadCoach) => isHeadCoach ? 'Active students' : 'Students at today’s branches',
  classes: (isHeadCoach) => isHeadCoach ? 'Classes today' : 'My classes today',
  attendance: () => 'Attendance to record',
  payments: () => 'Payments due or overdue',
}

function manilaClock() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Manila' })
      .formatToParts(new Date()).map((part) => [part.type, part.value]),
  )
  return `${parts.hour}:${parts.minute}:${parts.second}`
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function RecordsTable({ headers, rows }: { headers: string[]; rows: DetailRow[] }) {
  if (!rows.length) return <p className="px-5 py-12 text-center text-sm text-gray-700">There are no records for this metric right now.</p>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-white text-sm text-gray-700">
          <tr className="border-b border-gray-200">
            {headers.map((header) => <th key={header} scope="col" className="whitespace-nowrap px-5 py-4 font-medium">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 last:border-b-0">
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className={`px-5 py-4 text-sm ${index === 0 ? 'text-gray-600' : 'font-medium text-gray-950'} ${cell.className ?? ''}`}>
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function DashboardMetricPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric: rawMetric } = await params
  if (!['students', 'classes', 'attendance', 'payments'].includes(rawMetric)) notFound()
  const metric = rawMetric as MetricKey

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const isHeadCoach = currentUser.role === 'head_coach'
  if (metric === 'payments' && !isHeadCoach) notFound()

  const today = dateInTimeZone()
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  let headers: string[] = []
  let rows: DetailRow[] = []
  let error: string | null = null

  if (metric === 'students') {
    let assignedBranchIds: number[] = []
    if (!isHeadCoach) {
      try {
        assignedBranchIds = await getCoachBranchIdsForDate(currentUser.id, today)
      } catch {
        assignedBranchIds = []
      }
    }
    let query = supabase
      .from('student')
      .select('id, first_name, middle_name, last_name, belt_level, branch:branch!student_branch_id_fkey(name)')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name')
    if (!isHeadCoach) query = assignedBranchIds.length ? query.in('branch_id', assignedBranchIds) : query.eq('branch_id', -1)
    const result = await query
    error = result.error?.message ?? null
    headers = ['#', 'Student', 'Branch', 'Belt level']
    rows = ((result.data ?? []) as unknown as Array<{
      id: number
      first_name: string
      middle_name: string | null
      last_name: string
      belt_level: string
      branch: { name: string } | null
    }>).map((student, index) => ({
      id: student.id,
      cells: [
        { text: String(index + 1) },
        { text: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') },
        { text: student.branch?.name ?? '—' },
        { text: formatBeltLabel(student.belt_level), className: beltTextColorClass(student.belt_level) },
      ],
    }))
  } else if (metric === 'classes' || metric === 'attendance') {
    let query = supabase
      .from('class_schedule')
      .select('id, date, time_start, time_end, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
      .eq('date', today)
      .neq('status', 'Cancelled')
      .neq('status', 'Draft')
      .order('time_start')
    if (!isHeadCoach) query = query.eq('coach_id', currentUser.id)
    const result = await query
    error = result.error?.message ?? null
    const schedules = (result.data ?? []) as unknown as ScheduleRow[]
    const now = manilaClock()
    const selectedSchedules = metric === 'attendance'
      ? schedules.filter((schedule) => schedule.time_end <= now)
      : schedules
    let pendingIds = new Set<number>()
    if (metric === 'attendance' && selectedSchedules.length) {
      const attendanceResult = await supabase
        .from('attendance')
        .select('schedule_id')
        .in('schedule_id', selectedSchedules.map((schedule) => schedule.id))
      if (attendanceResult.error) error = attendanceResult.error.message
      const recordedIds = new Set((attendanceResult.data ?? []).map((entry) => Number(entry.schedule_id)))
      pendingIds = new Set(selectedSchedules.filter((schedule) => !recordedIds.has(schedule.id)).map((schedule) => schedule.id))
    }
    const displayedSchedules = metric === 'attendance'
      ? selectedSchedules.filter((schedule) => pendingIds.has(schedule.id))
      : selectedSchedules
    headers = metric === 'attendance' ? ['#', 'Branch', 'Class time', 'Status'] : ['#', 'Branch', 'Class time', 'Coach', 'Status']
    rows = displayedSchedules.map((schedule, index) => {
      const ended = schedule.time_end <= now
      const active = schedule.time_start <= now && now < schedule.time_end
      const state = metric === 'attendance' ? 'Not recorded' : active ? 'In session' : ended ? 'Completed' : 'Upcoming'
      const cells: Cell[] = [
        { text: String(index + 1) },
        { text: schedule.branch?.name ?? '—' },
        { text: `${formatTime(schedule.time_start)}–${formatTime(schedule.time_end)}` },
      ]
      if (metric === 'classes') cells.push({ text: schedule.coach ? [schedule.coach.first_name, schedule.coach.middle_name, schedule.coach.last_name].filter(Boolean).join(' ') : '—' })
      cells.push({ text: state, className: state === 'Not recorded' ? 'text-red-700' : 'text-gray-700' })
      return { id: schedule.id, cells }
    })
  } else {
    const result = await supabase
      .from('payment')
      .select('id, amount, due_date, student:student(first_name, middle_name, last_name, branch:branch!student_branch_id_fkey(name))')
      .neq('status', 'Paid')
      .lte('due_date', today)
      .order('due_date')
    error = result.error?.message ?? null
    headers = ['#', 'Student', 'Branch', 'Amount due', 'Due date', 'Status']
    rows = ((result.data ?? []) as unknown as Array<{
      id: number
      amount: number
      due_date: string
      student: {
        first_name: string
        middle_name: string | null
        last_name: string
        branch: { name: string } | null
      } | null
    }>).map((payment, index) => {
      const overdue = payment.due_date < today
      return {
        id: payment.id,
        cells: [
          { text: String(index + 1) },
          { text: payment.student ? [payment.student.first_name, payment.student.middle_name, payment.student.last_name].filter(Boolean).join(' ') : '—' },
          { text: payment.student?.branch?.name ?? '—' },
          { text: formatPeso(payment.amount) },
          { text: formatDate(payment.due_date) },
          { text: overdue ? 'Overdue' : 'Due today', className: overdue ? 'text-red-700' : 'text-amber-700' },
        ],
      }
    })
  }

  return (
    <DashboardShell title="Dashboard" currentUser={currentUser}>
      <div className="space-y-5">
        <BackToDashboardButton />
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-5">
            <h2 className="text-lg font-semibold tracking-tight text-gray-950">{titles[metric](isHeadCoach)}</h2>
            <span className="text-sm tabular-nums text-gray-700">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
          </header>
          {error ? <p role="alert" className="px-5 py-8 text-sm text-red-700">Could not load these records: {error}</p> : <RecordsTable headers={headers} rows={rows} />}
        </section>
      </div>
    </DashboardShell>
  )
}
