import 'server-only'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { addDays, dateInTimeZone, timeInTimeZone } from '@/utils/dates'
import { fetchAllRows } from '@/utils/fetch-all-rows'

const MAX_RANGE_DAYS = 366

export type ReportRange = '7d' | '30d' | 'this-month' | 'last-month' | 'custom'

/** Turn the ?range= preset (or custom from/to) into start/end dates. Unknown values fall back to 30 days. */
export function resolveReportRange(range?: string, from?: string, to?: string): { range: ReportRange; start: string; end: string } {
  const today = dateInTimeZone()
  const monthStart = `${today.slice(0, 7)}-01`
  switch (range) {
    case '7d':
      return { range, start: addDays(today, -6), end: today }
    case 'this-month':
      return { range, start: monthStart, end: today }
    case 'last-month': {
      const lastMonthEnd = addDays(monthStart, -1)
      return { range, start: `${lastMonthEnd.slice(0, 7)}-01`, end: lastMonthEnd }
    }
    case 'custom':
      // getBranchReport validates these
      return { range, start: from ?? '', end: to ?? '' }
    default:
      return { range: '30d', start: addDays(today, -29), end: today }
  }
}

type RawCounts = {
  activeStudents: number
  newStudents: number
  classes: number
  cancelledClasses: number
  unmarkedStudentMarks: number
  expectedMarks: number
  recordedDueMarks: number
  recordedMarks: number
  present: number
  late: number
  absent: number
  excused: number
}

export type BranchCounts = RawCounts & {
  attendanceRate: number | null
  recordingCoverage: number | null
}

export type BranchReportRow = BranchCounts & { branchId: number; branchName: string }

export type BranchReport = {
  range: { start: string; end: string; requestedEnd: string; endClampedToToday: boolean }
  branches: BranchReportRow[]
  totals: BranchCounts
  sessions: BranchReportSession[]
}

export type BranchReportSessionMark = {
  studentId: number
  studentName: string
  status: 'Present' | 'Late' | 'Absent' | 'Excused' | null
}

export type BranchReportSession = {
  id: number
  date: string
  timeStart: string
  timeEnd: string
  branchId: number
  branchName: string
  coachName: string
  cancelled: boolean
  ended: boolean
  expectedMarks: number | null
  recordedMarks: number
  unrecordedMarks: number
  present: number
  late: number
  absent: number
  excused: number
  students: BranchReportSessionMark[]
}

export type BranchReportResult =
  | { data: BranchReport; error: null }
  | { data: null; error: string }

const emptyCounts = (): RawCounts => ({
  activeStudents: 0, newStudents: 0, classes: 0, cancelledClasses: 0,
  unmarkedStudentMarks: 0,
  expectedMarks: 0, recordedDueMarks: 0, recordedMarks: 0,
  present: 0, late: 0, absent: 0, excused: 0,
})

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value
}

const studentName = (student: { first_name: string | null; middle_name: string | null; last_name: string | null }) =>
  [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || 'Student'

// real calendar dates only — rejects 2026-02-30, 2026-13-01, etc.
function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// number of calendar days from start to end, both included
function daysInRange(start: string, end: string) {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1
}

/** Same number of days right before start. Length is measured after clamping end to today. */
export function previousRange(start: string, end: string) {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return null
  const today = dateInTimeZone()
  const effectiveEnd = end > today ? today : end
  if (start > effectiveEnd) return null
  const prevEnd = addDays(start, -1)
  return { start: addDays(prevEnd, -(daysInRange(start, effectiveEnd) - 1)), end: prevEnd }
}

function finishCounts(counts: RawCounts): BranchCounts {
  const marked = counts.present + counts.late + counts.absent
  return {
    ...counts,
    // null instead of 0% when nobody has been marked yet
    attendanceRate: marked ? (counts.present + counts.late) / marked : null,
    recordingCoverage: counts.expectedMarks ? counts.recordedDueMarks / counts.expectedMarks : null,
  }
}

/** Per-branch activity for a date range. Callers must do the head coach check first. */
export async function getBranchReport({ start, end, branchIds, includeSessions = false }: {
  start: string
  end: string
  branchIds?: number[]
  includeSessions?: boolean
}): Promise<BranchReportResult> {
  if (!isIsoDate(start) || !isIsoDate(end)) return { data: null, error: 'Dates must be in YYYY-MM-DD format.' }
  if (start > end) return { data: null, error: 'The start date must be on or before the end date.' }
  if (daysInRange(start, end) > MAX_RANGE_DAYS) return { data: null, error: 'Please pick a range of one year or less.' }
  if (branchIds?.some((id) => !Number.isSafeInteger(id) || id <= 0)) return { data: null, error: 'The branch filter is invalid.' }

  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'head_coach') return { data: null, error: 'Only the Head Coach can view branch reports.' }

  const today = dateInTimeZone()
  const currentTime = timeInTimeZone()
  // classes after today haven't happened yet, so the report stops at today
  const effectiveEnd = end > today ? today : end
  if (start > effectiveEnd) return { data: null, error: 'The report range starts after today.' }

  // same cookie-based client the attendance page reads attendance with
  const supabase = await createClient(await cookies())
  const admin = createAdminClient()
  const filterIds = branchIds?.length ? branchIds : null

  try {
    const [branchRows, activeRows, newRows, scheduleRows, attendanceRows] = await Promise.all([
      (async () => {
        let query = supabase.from('branch').select('id, name').order('name')
        if (filterIds) query = query.in('id', filterIds)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return (data ?? []) as { id: number; name: string }[]
      })(),
      // today's snapshot, not range-based. admin: billing_plan isn't granted to logged-in users (Head Coach checked above)
      fetchAllRows<{ id: number; branch_id: number; enrollment_date: string; billing_plan: string | null; first_name: string | null; middle_name: string | null; last_name: string | null }>((from, to) => {
        let query = admin.from('student').select('id, branch_id, enrollment_date, billing_plan, first_name, middle_name, last_name').eq('is_active', true)
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      fetchAllRows<{ branch_id: number }>((from, to) => {
        let query = admin.from('student').select('branch_id')
          .gte('enrollment_date', start).lte('enrollment_date', effectiveEnd)
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      // Cancelled is kept here so it can be counted separately; Draft never counts
      fetchAllRows<{ id: number; date: string; time_start: string; time_end: string; branch_id: number; status: string; coach: { first_name: string | null; middle_name: string | null; last_name: string | null } | { first_name: string | null; middle_name: string | null; last_name: string | null }[] | null }>((from, to) => {
        let query = supabase.from('class_schedule').select('id, date, time_start, time_end, branch_id, status, coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
          .gte('date', start).lte('date', effectiveEnd).neq('status', 'Draft')
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      // by date range instead of a huge .in() list; matched to counted classes below
      fetchAllRows<{ schedule_id: number; student_id: number; status: string }>((from, to) =>
        admin.from('attendance').select('schedule_id, student_id, status')
          .gte('date', start).lte('date', effectiveEnd)
          .order('schedule_id').order('student_id').range(from, to)),
    ])

    const countsByBranch = new Map<number, RawCounts>(branchRows.map((branch) => [Number(branch.id), emptyCounts()]))

    const activeRosterByBranch = new Map<number, { id: number; enrollmentDate: string; name: string }[]>()
    for (const row of activeRows) {
      const counts = countsByBranch.get(Number(row.branch_id))
      if (counts) counts.activeStudents += 1
      if (row.billing_plan !== 'Per session') {
        activeRosterByBranch.set(Number(row.branch_id), [
          ...(activeRosterByBranch.get(Number(row.branch_id)) ?? []),
          { id: Number(row.id), enrollmentDate: row.enrollment_date, name: studentName(row) },
        ])
      }
    }
    for (const row of newRows) {
      const counts = countsByBranch.get(Number(row.branch_id))
      if (counts) counts.newStudents += 1
    }

    // counted (not Cancelled / Draft) classes, keyed by id, so attendance can find its branch
    const branchNames = new Map(branchRows.map((branch) => [Number(branch.id), branch.name]))
    const countedClasses = new Map<number, {
      branchId: number
      date: string
      ended: boolean
    }>()
    const sessions: BranchReportSession[] = []
    for (const schedule of scheduleRows) {
      const counts = countsByBranch.get(Number(schedule.branch_id))
      if (!counts) continue
      const coach = firstRelation(schedule.coach)
      const cancelled = schedule.status === 'Cancelled'
      const ended = schedule.date < today || (schedule.date === today && schedule.time_end <= currentTime)
      const session: BranchReportSession = {
        id: Number(schedule.id),
        date: schedule.date,
        timeStart: schedule.time_start,
        timeEnd: schedule.time_end,
        branchId: Number(schedule.branch_id),
        branchName: branchNames.get(Number(schedule.branch_id)) ?? 'Branch',
        coachName: coach ? studentName(coach) : 'Unassigned',
        cancelled,
        ended,
        expectedMarks: null,
        recordedMarks: 0,
        unrecordedMarks: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        students: [],
      }
      sessions.push(session)
      if (schedule.status === 'Cancelled') {
        counts.cancelledClasses += 1
      } else {
        counts.classes += 1
        countedClasses.set(Number(schedule.id), {
          branchId: Number(schedule.branch_id),
          date: schedule.date,
          ended,
        })
      }
    }

    const sessionById = new Map(sessions.map((session) => [session.id, session]))
    // Only actual saved statuses count. An absent attendance row is never treated as an Absent status.
    const markedByClass = new Map<number, Map<number, 'Present' | 'Late' | 'Absent' | 'Excused'>>()
    for (const row of attendanceRows) {
      const scheduleId = Number(row.schedule_id)
      const schedule = countedClasses.get(scheduleId)
      if (!schedule) continue // cancelled, draft, or a branch outside the filter
      const counts = countsByBranch.get(schedule.branchId)!
      if (row.status === 'Present') counts.present += 1
      else if (row.status === 'Late') counts.late += 1
      else if (row.status === 'Absent') counts.absent += 1
      else if (row.status === 'Excused') counts.excused += 1
      else continue
      counts.recordedMarks += 1
      const session = sessionById.get(scheduleId)
      if (session) {
        session.recordedMarks += 1
        if (row.status === 'Present') session.present += 1
        else if (row.status === 'Late') session.late += 1
        else if (row.status === 'Absent') session.absent += 1
        else session.excused += 1
      }
      const classMarks = markedByClass.get(scheduleId) ?? new Map()
      classMarks.set(Number(row.student_id), row.status as 'Present' | 'Late' | 'Absent' | 'Excused')
      markedByClass.set(scheduleId, classMarks)
    }

    const studentNamesById = new Map<number, string>(activeRows.map((student) => [Number(student.id), studentName(student)]))
    const markedStudentIds = [...new Set([...markedByClass.values()].flatMap((marks) => [...marks.keys()]))]
    const unknownNameIds = markedStudentIds.filter((studentId) => !studentNamesById.has(studentId))
    for (let offset = 0; offset < unknownNameIds.length; offset += 500) {
      const batch = unknownNameIds.slice(offset, offset + 500)
      const { data, error } = await admin.from('student')
        .select('id, first_name, middle_name, last_name')
        .in('id', batch)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) studentNamesById.set(Number(row.id), studentName(row))
    }

    for (const [scheduleId, schedule] of countedClasses) {
      const counts = countsByBranch.get(schedule.branchId)!
      const marksByStudent = markedByClass.get(scheduleId) ?? new Map()
      const markedIds = new Set(marksByStudent.keys())
      const session = sessionById.get(scheduleId)

      const expectedStudents = (activeRosterByBranch.get(schedule.branchId) ?? [])
        .filter((student) => student.enrollmentDate <= schedule.date)
      const expectedById = new Map(expectedStudents.map((student) => [student.id, student.name]))
      // A per-session student is expected only when a check-in exists; a missing check-in is not an absence.
      for (const studentId of markedIds) {
        if (!expectedById.has(studentId)) expectedById.set(studentId, '')
      }

      if (schedule.ended) {
        const expectedCount = expectedById.size
        const recordedCount = [...expectedById.keys()].filter((studentId) => marksByStudent.has(studentId)).length
        const missing = Math.max(expectedCount - recordedCount, 0)
        counts.expectedMarks += expectedCount
        counts.recordedDueMarks += recordedCount
        if (missing) {
          counts.unmarkedStudentMarks += missing
        }
        if (session) {
          session.expectedMarks = expectedCount
          session.unrecordedMarks = missing
        }
      }

      if (includeSessions && session) {
        const studentsToDisplay = new Set(expectedById.keys())
        for (const studentId of markedIds) studentsToDisplay.add(studentId)
        session.students = [...studentsToDisplay]
          .map((studentId) => ({
            studentId,
            studentName: expectedById.get(studentId) || studentNamesById.get(studentId) || 'Student',
            status: marksByStudent.get(studentId) ?? null,
          }))
          .sort((a, b) => a.studentName.localeCompare(b.studentName))
      }
    }

    // "All branches": add up raw counts, then derive rates from those combined totals
    const totals = emptyCounts()
    for (const counts of countsByBranch.values()) {
      for (const key of Object.keys(totals) as (keyof RawCounts)[]) totals[key] += counts[key]
    }
    return {
      data: {
        range: { start, end: effectiveEnd, requestedEnd: end, endClampedToToday: effectiveEnd !== end },
        branches: branchRows.map((branch) => ({
          branchId: Number(branch.id),
          branchName: branch.name,
          ...finishCounts(countsByBranch.get(Number(branch.id))!),
        })),
        totals: finishCounts(totals),
        sessions: includeSessions ? sessions.sort((a, b) => b.date.localeCompare(a.date) || b.timeStart.localeCompare(a.timeStart)) : [],
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Could not load the branch report.' }
  }
}

export type ReportComparison = { start: string; end: string; report: BranchReport | null; failed: boolean }

/** A range plus the same-length period right before it, loaded together. */
export async function getBranchReportWithComparison({ start, end, branchIds }: {
  start: string
  end: string
  branchIds?: number[]
}): Promise<{ current: BranchReportResult; comparison: ReportComparison | null }> {
  const range = previousRange(start, end)
  const [current, previous] = await Promise.all([
    getBranchReport({ start, end, branchIds, includeSessions: true }),
    range ? getBranchReport({ ...range, branchIds }) : null,
  ])
  return {
    current,
    // a failed previous period only hides the comparison; it never blocks the report
    comparison: range && { ...range, report: previous?.data ?? null, failed: Boolean(previous?.error) },
  }
}
