import 'server-only'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { addDays, dateInTimeZone } from '@/utils/dates'
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
  classesWithAttendance: number
  incompletePastClasses: number
  unmarkedStudentMarks: number
  present: number
  absent: number
  progressEntries: number
  assessedStudents: number
  readyForAssessment: number
}

export type BranchCounts = RawCounts & {
  attendanceRate: number | null
  avgPresentPerClass: number | null
}

export type BranchReportRow = BranchCounts & { branchId: number; branchName: string }

export type ProgressReportCheck = {
  id: number
  branchId: number
  branchName: string
  studentId: number
  studentName: string
  coachName: string
  assessedOn: string
  focusArea: string
  progressLevel: string
  assessmentReadiness: string
  observation: string
  nextSteps: string | null
}

export type BranchReport = {
  range: { start: string; end: string; requestedEnd: string; endClampedToToday: boolean }
  branches: BranchReportRow[]
  totals: BranchCounts
  progressChecks: ProgressReportCheck[]
}

export type BranchReportResult =
  | { data: BranchReport; error: null }
  | { data: null; error: string }

const emptyCounts = (): RawCounts => ({
  activeStudents: 0, newStudents: 0, classes: 0, cancelledClasses: 0,
  classesWithAttendance: 0, incompletePastClasses: 0, unmarkedStudentMarks: 0,
  present: 0, absent: 0, progressEntries: 0, assessedStudents: 0, readyForAssessment: 0,
})

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
  const marked = counts.present + counts.absent
  return {
    ...counts,
    // null instead of 0% when nobody has been marked yet
    attendanceRate: marked ? counts.present / marked : null,
    avgPresentPerClass: counts.classesWithAttendance ? counts.present / counts.classesWithAttendance : null,
  }
}

/** Per-branch activity for a date range. Callers must do the head coach check first. */
export async function getBranchReport({ start, end, branchIds }: {
  start: string
  end: string
  branchIds?: number[]
}): Promise<BranchReportResult> {
  if (!isIsoDate(start) || !isIsoDate(end)) return { data: null, error: 'Dates must be in YYYY-MM-DD format.' }
  if (start > end) return { data: null, error: 'The start date must be on or before the end date.' }
  if (daysInRange(start, end) > MAX_RANGE_DAYS) return { data: null, error: 'Please pick a range of one year or less.' }
  if (branchIds?.some((id) => !Number.isSafeInteger(id) || id <= 0)) return { data: null, error: 'The branch filter is invalid.' }

  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'head_coach') return { data: null, error: 'Only the Head Coach can view branch reports.' }

  const today = dateInTimeZone()
  // classes after today haven't happened yet, so the report stops at today
  const effectiveEnd = end > today ? today : end
  if (start > effectiveEnd) return { data: null, error: 'The report range starts after today.' }

  // same cookie-based client the attendance page reads attendance with
  const supabase = await createClient(await cookies())
  const admin = createAdminClient()
  const filterIds = branchIds?.length ? branchIds : null

  try {
    const [branchRows, activeRows, newRows, scheduleRows, attendanceRows, progressRows] = await Promise.all([
      (async () => {
        let query = supabase.from('branch').select('id, name').order('name')
        if (filterIds) query = query.in('id', filterIds)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return (data ?? []) as { id: number; name: string }[]
      })(),
      // today's snapshot, not range-based
      fetchAllRows<{ id: number; branch_id: number; enrollment_date: string; billing_plan: string | null }>((from, to) => {
        let query = supabase.from('student').select('id, branch_id, enrollment_date, billing_plan').eq('is_active', true)
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      fetchAllRows<{ branch_id: number }>((from, to) => {
        let query = supabase.from('student').select('branch_id')
          .gte('enrollment_date', start).lte('enrollment_date', effectiveEnd)
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      // Cancelled is kept here so it can be counted separately; Draft never counts
      fetchAllRows<{ id: number; date: string; branch_id: number; status: string }>((from, to) => {
        let query = supabase.from('class_schedule').select('id, date, branch_id, status')
          .gte('date', start).lte('date', effectiveEnd).neq('status', 'Draft')
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('id').range(from, to)
      }),
      // by date range instead of a huge .in() list; matched to counted classes below
      fetchAllRows<{ schedule_id: number; student_id: number; status: string }>((from, to) =>
        supabase.from('attendance').select('schedule_id, student_id, status')
          .gte('date', start).lte('date', effectiveEnd)
          .order('schedule_id').order('student_id').range(from, to)),
      fetchAllRows<{ branch_id: number; student_id: number; assessed_on: string; id: number; coach_id: number; assessment_readiness: string; focus_area: string; progress_level: string; observation: string; next_steps: string | null }>((from, to) => {
        let query = admin.from('student_progress')
          .select('branch_id, student_id, assessed_on, id, coach_id, assessment_readiness, focus_area, progress_level, observation, next_steps')
          .gte('assessed_on', start).lte('assessed_on', effectiveEnd)
        if (filterIds) query = query.in('branch_id', filterIds)
        return query.order('branch_id').order('assessed_on').order('id').range(from, to)
      }),
    ])

    const progressStudentIds = [...new Set(progressRows.map((row) => Number(row.student_id)))]
    const progressCoachIds = [...new Set(progressRows.map((row) => Number(row.coach_id)))]
    const [progressStudents, progressCoaches] = await Promise.all([
      progressStudentIds.length
        ? admin.from('student').select('id, first_name, middle_name, last_name').in('id', progressStudentIds)
        : Promise.resolve({ data: [], error: null }),
      progressCoachIds.length
        ? admin.from('user').select('id, first_name, middle_name, last_name').in('id', progressCoachIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (progressStudents.error) throw new Error(progressStudents.error.message)
    if (progressCoaches.error) throw new Error(progressCoaches.error.message)
    const displayName = (person: { first_name: string; middle_name: string | null; last_name: string }) =>
      [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
    const studentNameById = new Map((progressStudents.data ?? []).map((row) => [Number(row.id), displayName(row)]))
    const coachNameById = new Map((progressCoaches.data ?? []).map((row) => [Number(row.id), displayName(row)]))

    const countsByBranch = new Map<number, RawCounts>(branchRows.map((branch) => [Number(branch.id), emptyCounts()]))

    const activeRosterByBranch = new Map<number, { id: number; enrollmentDate: string }[]>()
    for (const row of activeRows) {
      const counts = countsByBranch.get(Number(row.branch_id))
      if (counts) counts.activeStudents += 1
      if (row.billing_plan !== 'Per session') {
        activeRosterByBranch.set(Number(row.branch_id), [
          ...(activeRosterByBranch.get(Number(row.branch_id)) ?? []),
          { id: Number(row.id), enrollmentDate: row.enrollment_date },
        ])
      }
    }
    for (const row of newRows) {
      const counts = countsByBranch.get(Number(row.branch_id))
      if (counts) counts.newStudents += 1
    }

    // counted (not Cancelled / Draft) classes, keyed by id, so attendance can find its branch
    const countedClasses = new Map<number, { branchId: number; date: string }>()
    for (const schedule of scheduleRows) {
      const counts = countsByBranch.get(Number(schedule.branch_id))
      if (!counts) continue
      if (schedule.status === 'Cancelled') {
        counts.cancelledClasses += 1
      } else {
        counts.classes += 1
        countedClasses.set(Number(schedule.id), { branchId: Number(schedule.branch_id), date: schedule.date })
      }
    }

    // only real attendance rows count — students with no record are left out entirely
    const markedStudentIdsByClass = new Map<number, Set<number>>()
    for (const row of attendanceRows) {
      const scheduleId = Number(row.schedule_id)
      const schedule = countedClasses.get(scheduleId)
      if (!schedule) continue // cancelled, draft, or a branch outside the filter
      const counts = countsByBranch.get(schedule.branchId)!
      if (row.status === 'Present') counts.present += 1
      else if (row.status === 'Absent') counts.absent += 1
      else continue
      markedStudentIdsByClass.set(scheduleId, new Set([
        ...(markedStudentIdsByClass.get(scheduleId) ?? []), Number(row.student_id),
      ]))
    }

    for (const [scheduleId, schedule] of countedClasses) {
      const counts = countsByBranch.get(schedule.branchId)!
      const markedIds = markedStudentIdsByClass.get(scheduleId) ?? new Set<number>()
      if (markedIds.size) counts.classesWithAttendance += 1
      if (schedule.date < today) {
        const expectedIds = new Set(
          (activeRosterByBranch.get(schedule.branchId) ?? [])
            .filter((student) => student.enrollmentDate <= schedule.date)
            .map((student) => student.id),
        )
        // Existing marks are evidence for students who are now inactive or
        // whose current branch differs from the branch where class occurred.
        for (const studentId of markedIds) expectedIds.add(studentId)
        const missing = Math.max(expectedIds.size - markedIds.size, 0)
        if (missing) {
          counts.incompletePastClasses += 1
          counts.unmarkedStudentMarks += missing
        }
      }
    }

    // Use the latest assessment per student in this range for readiness totals;
    // repeated checks do not inflate the number of students.
    const latestProgress = new Map<string, { branchId: number; studentId: number; assessedOn: string; id: number; readiness: string }>()
    for (const row of progressRows) {
      const branchId = Number(row.branch_id)
      const studentId = Number(row.student_id)
      const counts = countsByBranch.get(branchId)
      if (!counts) continue
      counts.progressEntries += 1
      const key = `${branchId}:${studentId}`
      const prior = latestProgress.get(key)
      if (!prior || row.assessed_on > prior.assessedOn || (row.assessed_on === prior.assessedOn && Number(row.id) > prior.id)) {
        latestProgress.set(key, { branchId, studentId, assessedOn: row.assessed_on, id: Number(row.id), readiness: row.assessment_readiness })
      }
    }
    for (const assessment of latestProgress.values()) {
      const counts = countsByBranch.get(assessment.branchId)!
      counts.assessedStudents += 1
      if (assessment.readiness === 'ready_for_assessment') counts.readyForAssessment += 1
    }
    const latestByStudent = new Map<number, { assessedOn: string; id: number; readiness: string }>()
    for (const assessment of latestProgress.values()) {
      const prior = latestByStudent.get(assessment.studentId)
      if (!prior || assessment.assessedOn > prior.assessedOn || (assessment.assessedOn === prior.assessedOn && assessment.id > prior.id)) {
        latestByStudent.set(assessment.studentId, assessment)
      }
    }

    const branchNameById = new Map(branchRows.map((branch) => [Number(branch.id), branch.name]))
    const recentProgressChecks = [...progressRows]
      .sort((a, b) => b.assessed_on.localeCompare(a.assessed_on) || Number(b.id) - Number(a.id))
      .reduce<ProgressReportCheck[]>((checks, row) => {
        const branchId = Number(row.branch_id)
        if (checks.filter((check) => check.branchId === branchId).length >= 5) return checks
        checks.push({
          id: Number(row.id), branchId, branchName: branchNameById.get(branchId) ?? 'Branch',
          studentId: Number(row.student_id), studentName: studentNameById.get(Number(row.student_id)) ?? 'Student',
          coachName: coachNameById.get(Number(row.coach_id)) ?? 'Coach', assessedOn: row.assessed_on,
          focusArea: row.focus_area, progressLevel: row.progress_level,
          assessmentReadiness: row.assessment_readiness, observation: row.observation, nextSteps: row.next_steps,
        })
        return checks
      }, [])

    // "All branches": add up the raw counts, then work out rate / average from the sums
    const totals = emptyCounts()
    for (const counts of countsByBranch.values()) {
      for (const key of Object.keys(totals) as (keyof RawCounts)[]) totals[key] += counts[key]
    }
    totals.assessedStudents = latestByStudent.size
    totals.readyForAssessment = [...latestByStudent.values()].filter((assessment) => assessment.readiness === 'ready_for_assessment').length

    return {
      data: {
        range: { start, end: effectiveEnd, requestedEnd: end, endClampedToToday: effectiveEnd !== end },
        branches: branchRows.map((branch) => ({
          branchId: Number(branch.id),
          branchName: branch.name,
          ...finishCounts(countsByBranch.get(Number(branch.id))!),
        })),
        totals: finishCounts(totals),
        progressChecks: recentProgressChecks,
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
    getBranchReport({ start, end, branchIds }),
    range ? getBranchReport({ ...range, branchIds }) : null,
  ])
  return {
    current,
    // a failed previous period only hides the comparison; it never blocks the report
    comparison: range && { ...range, report: previous?.data ?? null, failed: Boolean(previous?.error) },
  }
}
