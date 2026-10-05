import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, ChevronLeft, MapPin, Users } from 'lucide-react'
import DashboardShell from '@/components/DashboardShell'
import EditBranchModal from '@/components/EditBranchModal'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import { NeedsAttention, ReportKpis, ReportRangeLine } from '@/app/branches/_components/BranchReportSummary'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone, formatTimeRange, timeInTimeZone } from '@/utils/dates'
import { BELT_COLORS, formatBeltLabel } from '@/utils/belts'
import { getBranchReportWithComparison, resolveReportRange } from '@/utils/branch-reports'
import { cardClass } from '@/utils/branch-report-format'

export const dynamic = 'force-dynamic'

// the only keys "Back to reports" may carry — a full back URL is never taken from the query
const BACK_KEYS = ['range', 'from', 'to', 'branches', 'sort', 'dir']

type ScheduleRow = {
  id: number
  date: string
  time_start: string
  time_end: string
  status: string
  coach: { first_name: string; middle_name: string | null; last_name: string } | null
}

type StudentRow = { id: number; first_name: string; middle_name: string | null; last_name: string; belt_level: string | null }

const fullName = (person: { first_name: string; middle_name: string | null; last_name: string }) =>
  [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')

// same labels and colors as the dashboard's Today's classes
function classStatus(schedule: ScheduleRow, now: string, hasAttendance: boolean) {
  if (schedule.status === 'Cancelled') return { label: 'Cancelled', tone: 'bg-gray-100 text-gray-500' }
  if (schedule.time_start <= now && now < schedule.time_end) return { label: 'In session', tone: 'bg-amber-50 text-amber-700' }
  if (schedule.time_end <= now) {
    return hasAttendance
      ? { label: 'Attendance entered', tone: 'bg-emerald-50 text-emerald-700' }
      : { label: 'Not recorded', tone: 'bg-red-50 text-red-700' }
  }
  return { label: 'Upcoming', tone: 'bg-gray-100 text-gray-600' }
}

export default async function BranchDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  // same role gate as the list page — Head Coach only
  if (!currentUser || currentUser.role !== 'head_coach') redirect('/students')

  // /branches/abc, /branches/-1 or /branches/0 → 404 without touching the database
  const { id } = await params
  const branchId = /^\d+$/.test(id) ? Number(id) : NaN
  if (!Number.isSafeInteger(branchId) || branchId <= 0) notFound()

  const query = await searchParams
  const param = (key: string) => {
    const value = query[key]
    return Array.isArray(value) ? value[0] : value
  }

  const supabase = await createClient(await cookies())
  const { data: branch, error: branchError } = await supabase
    .from('branch')
    .select('id, name, address, description, photo_url')
    .eq('id', branchId)
    .maybeSingle()

  if (branchError) {
    return (
      <DashboardShell title="Branch" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">Could not load this branch: {branchError.message}</p>
      </DashboardShell>
    )
  }
  if (!branch) notFound()

  const today = dateInTimeZone()
  const now = timeInTimeZone()
  const reportRange = resolveReportRange(param('range'), param('from'), param('to'))

  const loadSchedule = async () => {
    // Cancelled is shown (not linked); Draft never is
    const { data, error } = await supabase
      .from('class_schedule')
      .select('id, date, time_start, time_end, status, coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
      .eq('branch_id', branchId)
      .eq('date', today)
      .neq('status', 'Draft')
      .order('time_start')
    if (error) return { rows: [], marked: new Set<number>(), error: error.message }
    const rows = (data ?? []) as unknown as ScheduleRow[]
    const ids = rows.filter((row) => row.status !== 'Cancelled').map((row) => Number(row.id))
    if (!ids.length) return { rows, marked: new Set<number>(), error: null }
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance').select('schedule_id').in('schedule_id', ids)
    if (attendanceError) return { rows: [], marked: new Set<number>(), error: attendanceError.message }
    return { rows, marked: new Set((attendance ?? []).map((row) => Number(row.schedule_id))), error: null }
  }

  // each section fails on its own, so one error never blanks the whole page
  const [report, schedule, studentResult] = await Promise.all([
    getBranchReportWithComparison({ start: reportRange.start, end: reportRange.end, branchIds: [branchId] }),
    loadSchedule(),
    supabase
      .from('student')
      .select('id, first_name, middle_name, last_name, belt_level')
      .eq('is_active', true)
      .eq('branch_id', branchId)
      .order('last_name')
      .order('first_name'),
  ])
  const students = (studentResult.data ?? []) as StudentRow[]

  const fromReports = param('ref') === 'reports'
  const backQuery = new URLSearchParams({ view: 'reports' })
  for (const key of BACK_KEYS) {
    const value = param(key)
    if (value) backQuery.set(key, value)
  }
  const backHref = fromReports ? `/branches?${backQuery.toString().replace(/%2C/g, ',')}` : '/branches'

  return (
    <DashboardShell title={branch.name} currentUser={currentUser}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {fromReports ? 'Back to reports' : 'Back to branches'}
        </Link>
        <EditBranchModal branch={{ ...branch, address: branch.address ?? '' }} />
      </div>

      {/* banner — same photo / letter fallback as the branch cards */}
      <section className={`mt-4 overflow-hidden border ${cardClass}`}>
        {branch.photo_url
          ? <img src={branch.photo_url} alt={branch.name} className="h-44 w-full object-cover" />
          : <div className="flex h-44 items-center justify-center bg-gradient-to-br from-red-600 to-red-800 text-5xl font-bold text-white" aria-hidden>
            {branch.name.charAt(0)}
          </div>}
        <div className="p-5">
          <h1 className="text-xl font-semibold text-gray-950">{branch.name}</h1>
          {branch.address && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{branch.address}
            </p>
          )}
          {branch.description && <p className="mt-3 text-sm text-gray-600">{branch.description}</p>}
        </div>
      </section>

      <section aria-label="Branch report" className="mt-6 space-y-4">
        {report.current.error
          ? <p role="alert" className="text-sm text-red-600">Could not load the branch report: {report.current.error}</p>
          : report.current.data && <>
            <ReportRangeLine range={report.current.data.range} comparison={report.comparison} />
            <ReportKpis totals={report.current.data.totals} comparison={report.comparison} />
            <NeedsAttention branches={report.current.data.branches} comparison={report.comparison} single />
          </>}
      </section>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <Card title={<><CalendarDays className="h-4 w-4 text-gray-950" aria-hidden />Today’s schedule</>} chip={schedule.error ? undefined : String(schedule.rows.length)} flush className={cardClass}>
          {schedule.error
            ? <p role="alert" className="px-5 pb-5 text-sm text-red-600">Could not load today’s schedule: {schedule.error}</p>
            : schedule.rows.length
              ? <ul className="divide-y divide-gray-100 pb-1">
                {schedule.rows.map((row) => {
                  const status = classStatus(row, now, schedule.marked.has(Number(row.id)))
                  const content = <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium tabular-nums text-gray-900">{formatTimeRange(row.time_start, row.time_end)}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">{row.coach ? fullName(row.coach) : 'Unassigned'}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${status.tone}`}>{status.label}</span>
                  </>
                  return (
                    <li key={row.id}>
                      {row.status === 'Cancelled'
                        ? <div className="flex items-center gap-3 px-5 py-3.5 opacity-70">{content}</div>
                        : <Link href={`/attendance?date=${row.date}&scheduleId=${row.id}`} className="group/row flex items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-red-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                          {content}
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover/row:text-gray-950" aria-hidden />
                        </Link>}
                    </li>
                  )
                })}
              </ul>
              : <div className="px-5 pb-5"><EmptyNote>No classes scheduled today.</EmptyNote></div>}
        </Card>

        <Card title={<><Users className="h-4 w-4 text-gray-950" aria-hidden />Active students</>} chip={studentResult.error ? undefined : String(students.length)} flush className={cardClass}>
          {studentResult.error
            ? <p role="alert" className="px-5 pb-5 text-sm text-red-600">Could not load students: {studentResult.error.message}</p>
            : students.length
              ? <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto pb-1">
                {students.map((student) => (
                  <li key={student.id} className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors duration-200 hover:bg-red-600/5">
                    <span className="min-w-0 truncate text-sm text-gray-900">{fullName(student)}</span>
                    {student.belt_level
                      ? <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${BELT_COLORS[student.belt_level] ?? 'bg-gray-100 text-gray-700'}`}>
                        {formatBeltLabel(student.belt_level)}
                      </span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </li>
                ))}
              </ul>
              : <div className="px-5 pb-5"><EmptyNote>No active students in this branch.</EmptyNote></div>}
        </Card>
      </div>
    </DashboardShell>
  )
}
