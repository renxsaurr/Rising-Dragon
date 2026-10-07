import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, MapPin, Users } from 'lucide-react'
import DashboardShell from '@/components/DashboardShell'
import EditBranchModal from '@/components/EditBranchModal'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import PaginatedListItems from '@/components/PaginatedListItems'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone, formatTimeRange, timeInTimeZone } from '@/utils/dates'
import { BELT_COLORS, formatBeltLabel } from '@/utils/belts'

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
function classStatus(schedule: ScheduleRow, now: string, attendance: { complete: boolean; marked: number }) {
  if (schedule.status === 'Cancelled') return { label: 'Cancelled', tone: 'bg-gray-100 text-gray-500' }
  if (schedule.time_start <= now && now < schedule.time_end) return { label: 'In session', tone: 'bg-amber-50 text-amber-700' }
  if (schedule.time_end <= now) {
    if (attendance.complete) return { label: 'Attendance complete', tone: 'bg-emerald-50 text-emerald-700' }
    if (attendance.marked) return { label: 'Attendance incomplete', tone: 'bg-amber-50 text-amber-700' }
    return { label: 'Not recorded', tone: 'bg-red-50 text-red-700' }
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
    .select('id, name, address, description, photo_url, is_active')
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
  const loadSchedule = async () => {
    // Cancelled is shown (not linked); Draft never is
    const { data, error } = await supabase
      .from('class_schedule')
      .select('id, date, time_start, time_end, status, coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
      .eq('branch_id', branchId)
      .eq('date', today)
      .neq('status', 'Draft')
      .order('time_start')
    if (error) return { rows: [], attendance: new Map<number, { complete: boolean; marked: number }>(), error: error.message }
    const rows = (data ?? []) as unknown as ScheduleRow[]
    const ids = rows.filter((row) => row.status !== 'Cancelled').map((row) => Number(row.id))
    if (!ids.length) return { rows, attendance: new Map<number, { complete: boolean; marked: number }>(), error: null }
    const [attendanceResult, rosterResult] = await Promise.all([
      supabase.from('attendance').select('schedule_id, student_id').in('schedule_id', ids),
      supabase.from('student').select('id, enrollment_date').eq('branch_id', branchId).eq('is_active', true).lte('enrollment_date', today),
    ])
    const attendanceError = attendanceResult.error ?? rosterResult.error
    if (attendanceError) return { rows: [], attendance: new Map<number, { complete: boolean; marked: number }>(), error: attendanceError.message }
    const markedBySchedule = new Map<number, Set<number>>()
    for (const mark of attendanceResult.data ?? []) {
      const key = Number(mark.schedule_id)
      markedBySchedule.set(key, new Set([...(markedBySchedule.get(key) ?? []), Number(mark.student_id)]))
    }
    const attendance = new Map<number, { complete: boolean; marked: number }>()
    for (const schedule of rows) {
      const markedIds = markedBySchedule.get(Number(schedule.id)) ?? new Set<number>()
      const expectedIds = new Set((rosterResult.data ?? [])
        .filter((student) => student.enrollment_date <= schedule.date)
        .map((student) => Number(student.id)))
      for (const id of markedIds) expectedIds.add(id)
      attendance.set(Number(schedule.id), { complete: expectedIds.size > 0 && markedIds.size >= expectedIds.size, marked: markedIds.size })
    }
    return { rows, attendance, error: null }
  }

  // each section fails on its own, so one error never blanks the whole page
  const [schedule, studentResult] = await Promise.all([
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

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-950">Branch details</h2>
          {!branch.is_active && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Archived</span>}
        </div>
        {branch.address && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{branch.address}
          </p>
        )}
        {branch.description && <p className="mt-3 text-sm text-gray-700">{branch.description}</p>}
      </section>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <Card title={<><CalendarDays className="h-4 w-4 text-gray-950" aria-hidden />Today’s schedule</>} chip={schedule.error ? undefined : String(schedule.rows.length)} flush className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {schedule.error
            ? <p role="alert" className="px-5 pb-5 text-sm text-red-600">Could not load today’s schedule: {schedule.error}</p>
            : schedule.rows.length
              ? <ul className="divide-y divide-gray-100 pb-1">
                {schedule.rows.map((row) => {
                  const status = classStatus(row, now, schedule.attendance.get(Number(row.id)) ?? { complete: false, marked: 0 })
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

        <Card title={<><Users className="h-4 w-4 text-gray-950" aria-hidden />Active students</>} chip={studentResult.error ? undefined : String(students.length)} flush className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {studentResult.error
            ? <p role="alert" className="px-5 pb-5 text-sm text-red-600">Could not load students: {studentResult.error.message}</p>
            : students.length
              ? <div className="divide-y divide-gray-100">
                <PaginatedListItems itemLabel="students" pageSize={6} showSummary>
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 break-words text-sm text-gray-900">{fullName(student)}</span>
                    {student.belt_level
                      ? <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${BELT_COLORS[student.belt_level] ?? 'bg-gray-100 text-gray-700'}`}>
                        {formatBeltLabel(student.belt_level)}
                      </span>
                      : <span className="text-xs text-gray-400">—</span>}
                    <Link href={`/students/${student.id}/progress`} aria-label={`View ${fullName(student)} progress`} title="View student progress" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
                </PaginatedListItems>
              </div>
              : <div className="px-5 pb-5"><EmptyNote>No active students in this branch.</EmptyNote></div>}
        </Card>
      </div>
    </DashboardShell>
  )
}
