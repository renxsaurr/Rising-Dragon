import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AttendanceRoster from '@/components/AttendanceRoster'
import AttendanceDatePicker from '@/components/AttendanceDatePicker'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { addDays, dateInTimeZone, formatTime } from '@/utils/dates'

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

// Monday of the week containing isoDate
function weekStart(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return addDays(isoDate, day === 0 ? -6 : 1 - day)
}

const ChevronLeft = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
const ChevronRight = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scheduleId?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const { date: requestedDate, scheduleId: requestedScheduleId } = await searchParams
  const today = dateInTimeZone()
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const isAssistant = currentUser.role === 'assistant_coach'

  const monday = weekStart(date)
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(monday, index))

  // one query for the whole week: feeds both the day strip counts and the selected day's sessions
  let scheduleQuery = supabase.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(name)')
    .gte('date', weekDates[0])
    .lte('date', weekDates[6])
    .neq('status', 'Cancelled')
    .order('time_start')
  if (isAssistant) scheduleQuery = scheduleQuery.eq('coach_id', currentUser.id)
  const { data: weekData, error: scheduleError } = await scheduleQuery

  if (scheduleError) {
    return <DashboardShell title="Attendance" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load class sessions: {scheduleError.message}</p></DashboardShell>
  }

  const weekSchedules = (weekData ?? []) as unknown as ScheduleRow[]
  const schedules = weekSchedules.filter((schedule) => schedule.date === date)
  const selectedSchedule = schedules.find((schedule) => String(schedule.id) === requestedScheduleId) ?? schedules[0] ?? null

  // progress per session: marked records vs students enrolled at that branch
  const branchIds = [...new Set(schedules.map((schedule) => Number(schedule.branch_id)))]
  const [branchStudentsResult, dayAttendanceResult] = schedules.length
    ? await Promise.all([
      supabase.from('student').select('branch_id').in('branch_id', branchIds),
      supabase.from('attendance').select('schedule_id').in('schedule_id', schedules.map((schedule) => schedule.id)),
    ])
    : [{ data: [] }, { data: [] }]
  const studentsPerBranch = new Map<number, number>()
  for (const row of branchStudentsResult.data ?? []) studentsPerBranch.set(Number(row.branch_id), (studentsPerBranch.get(Number(row.branch_id)) ?? 0) + 1)
  const markedPerSchedule = new Map<number, number>()
  for (const row of dayAttendanceResult.data ?? []) markedPerSchedule.set(Number(row.schedule_id), (markedPerSchedule.get(Number(row.schedule_id)) ?? 0) + 1)

  let students: { id: number; first_name: string; middle_name: string | null; last_name: string; belt_level: string }[] = []
  let attendance: { student_id: number; status: 'Present' | 'Absent' }[] = []
  let rosterError = ''

  if (selectedSchedule) {
    const [studentsResult, attendanceResult] = await Promise.all([
      supabase.from('student').select('id, first_name, middle_name, last_name, belt_level').eq('branch_id', selectedSchedule.branch_id).order('last_name').order('first_name'),
      supabase.from('attendance').select('student_id, status').eq('schedule_id', selectedSchedule.id),
    ])
    if (studentsResult.error) rosterError = studentsResult.error.message
    else students = (studentsResult.data ?? []) as typeof students
    if (attendanceResult.error) rosterError = rosterError || attendanceResult.error.message
    else attendance = (attendanceResult.data ?? []) as typeof attendance
  }

  const canMarkAttendance = Boolean(selectedSchedule && selectedSchedule.date <= today)
  const selectedDay = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const monthLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <DashboardShell title="Attendance" currentUser={currentUser}>
      {/* 1 — choose a day */}
      <section className="mb-5 rounded-xl border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/attendance?date=${addDays(monday, -7)}`} aria-label="Previous week" className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronLeft /></Link>
            <Link href={`/attendance?date=${addDays(monday, 7)}`} aria-label="Next week" className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronRight /></Link>
            <h2 className="ml-1 text-base font-semibold text-gray-950">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            {date !== today && <Link href="/attendance" className="h-9 rounded-lg bg-red-600 px-3.5 text-sm font-semibold leading-9 text-white hover:bg-red-700">Today</Link>}
            <AttendanceDatePicker date={date} />
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((day) => {
            const count = weekSchedules.filter((schedule) => schedule.date === day).length
            const active = day === date
            const d = new Date(`${day}T12:00:00`)
            return (
              <Link
                key={day}
                href={`/attendance?date=${day}`}
                aria-current={active ? 'date' : undefined}
                className={`flex flex-col items-center rounded-lg px-1 py-2.5 transition-colors ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span className={`text-[11px] font-medium uppercase ${active ? 'text-gray-400' : 'text-gray-500'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="mt-0.5 flex items-center gap-1 text-lg font-semibold tabular-nums">
                  {d.getDate()}
                  {day === today && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-red-500' : 'bg-red-600'}`} aria-label="today" />}
                </span>
                <span className={`mt-0.5 text-[11px] ${count ? (active ? 'text-white' : 'text-gray-600') : active ? 'text-gray-500' : 'text-gray-300'}`}>
                  {count ? `${count} class${count === 1 ? '' : 'es'}` : 'No class'}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 2 — choose a class */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{selectedDay}</h3>
        <Link href={`/scheduling?date=${date}`} className="text-xs font-medium text-gray-600 hover:text-red-600">Open calendar →</Link>
      </div>

      {schedules.length === 0 ? (
        <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-surface px-5 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">No classes on this day</p>
          <p className="mt-1 text-sm text-gray-500">{isAssistant ? 'Only your assigned classes appear here. Pick another day above.' : 'Pick another day above, or add a session in the calendar.'}</p>
        </div>
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {schedules.map((schedule) => {
            const active = selectedSchedule?.id === schedule.id
            const total = studentsPerBranch.get(Number(schedule.branch_id)) ?? 0
            const marked = markedPerSchedule.get(Number(schedule.id)) ?? 0
            const done = total > 0 && marked >= total
            const upcoming = schedule.date > today
            return (
              <Link
                key={schedule.id}
                href={`/attendance?date=${date}&scheduleId=${schedule.id}`}
                aria-current={active ? 'true' : undefined}
                className={`rounded-xl border p-4 transition-all ${active ? 'border-black bg-surface shadow-sm ring-1 ring-black' : 'border-gray-200 bg-surface hover:border-gray-300'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950">{schedule.branch?.name ?? 'Branch'}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{formatTime(schedule.time_start)}–{formatTime(schedule.time_end)} · {schedule.coach?.name ?? 'Coach'}</p>
                  </div>
                  {upcoming
                    ? <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Upcoming</span>
                    : done
                      ? <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ Done</span>
                      : <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">{marked ? 'In progress' : 'To do'}</span>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-900'}`} style={{ width: `${total ? Math.min(100, (marked / total) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] tabular-nums text-gray-500">{marked}/{total} marked</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* 3 — mark the roster */}
      {rosterError && <p role="alert" className="mb-4 text-sm text-red-600">Could not load the roster: {rosterError}</p>}
      {selectedSchedule && !rosterError && <AttendanceRoster
        key={selectedSchedule.id}
        scheduleId={Number(selectedSchedule.id)}
        classLabel={`${selectedSchedule.branch?.name ?? 'Branch'} · ${formatTime(selectedSchedule.time_start)}`}
        students={students}
        initialAttendance={attendance}
        canMarkAttendance={canMarkAttendance}
      />}
    </DashboardShell>
  )
}
