'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { addDays, dateInTimeZone } from '@/utils/dates'
import { syncWeeklySessions, type WeeklySessionSyncResult } from '@/utils/weekly-sessions'
import { branchOperatingHoursConflict, parseBranchOperatingHours } from '@/utils/branch-operating-hours'

export type ScheduleInput = {
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  status: 'Scheduled' | 'Cancelled' | 'Completed'
}

type WeeklyAvailabilityInput = {
  weekday: number
  time_start: string
  time_end: string
}

type WeeklyTemplateInput = {
  branch_id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
}

export type ScheduleAbsenceInput = {
  starts_on: string
  ends_on: string
  reason: string
}

export type AbsenceCoverageCoachOption = { id: number; name: string }
export type AbsenceCoverageSession = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_name: string
  status: 'Scheduled' | 'Cancelled'
  assistant_options: AbsenceCoverageCoachOption[]
  head_coach: AbsenceCoverageCoachOption | null
}
export type AbsenceCoverageDecision = { session_id: number; coach_id: number | null }

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isRealDate = (value: string) => {
  if (!isDate(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const isWeekday = (value: number) => Number.isInteger(value) && value >= 1 && value <= 7
const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
  startA.slice(0, 5) < endB.slice(0, 5) && endA.slice(0, 5) > startB.slice(0, 5)
const isoWeekday = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}
async function validateCoach(admin: ReturnType<typeof createAdminClient>, coachId: number) {
  const { data: coach, error } = await admin.from('user')
    .select('id, auth_id, role')
    .eq('id', coachId)
    .maybeSingle()
  if (error || !coach || !['head_coach', 'assistant_coach'].includes(coach.role)) return false
  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(coach.auth_id)
  return !authError && !!authResult.user && !(authResult.user.banned_until && Date.parse(authResult.user.banned_until) > Date.now())
}

async function coachWeeklyAvailabilityConflict(admin: ReturnType<typeof createAdminClient>, coachId: number, date: string, start: string, end: string, required: boolean) {
  if (!required) return false
  // Supabase returns PostgreSQL `time` values with seconds (HH:mm:ss), while
  // callers may pass either HH:mm or HH:mm:ss. Compare normalized values so an
  // exact availability boundary such as 11:00–12:00 is accepted.
  const classStart = start.slice(0, 5)
  const classEnd = end.slice(0, 5)
  const weekday = isoWeekday(date)
  const { data, error } = await admin.from('coach_weekly_availability')
    .select('time_start, time_end')
    .eq('coach_id', coachId)
    .eq('weekday', weekday)
  if (error) throw new Error(error.message)
  return !(data ?? []).some((slot) =>
    slot.time_start.slice(0, 5) <= classStart && slot.time_end.slice(0, 5) >= classEnd,
  )
}

const scheduleSelection = 'id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id, is_cross_branch_override, absence_report_id, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)'

async function activeClosureConflict(admin: ReturnType<typeof createAdminClient>, branchId: number, date: string) {
  const { data, error } = await admin.from('schedule_closure')
    .select('branch_id')
    .eq('is_active', true)
    .lte('starts_on', date)
    .gte('ends_on', date)
  if (error) throw new Error(error.message)
  return (data ?? []).some((closure) => closure.branch_id === null || Number(closure.branch_id) === branchId)
}

function withCoachName(data: Record<string, unknown> | null) {
  if (!data) return null
  const coach = data.coach as { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null
  return {
    ...data,
    coach: coach ? { name: [coach.first_name, coach.middle_name, coach.last_name].filter(Boolean).join(' ') || 'Coach' } : null,
  }
}

export async function saveSchedule(scheduleId: number | null, input: ScheduleInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedules.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can change schedules.' }

  const { date, branch_id, coach_id, status } = input
  const time_start = String(input.time_start ?? '').slice(0, 5)
  const time_end = String(input.time_end ?? '').slice(0, 5)
  if (!isDate(date) || !isTime(time_start) || !isTime(time_end)) return { error: 'Enter a valid date and time range.' }
  if (time_start >= time_end) return { error: 'End time must be after start time.' }
  if (!Number.isInteger(branch_id) || !Number.isInteger(coach_id)) return { error: 'Select a branch and coach.' }
  if (!['Scheduled', 'Cancelled', 'Completed'].includes(status)) return { error: 'Select a valid schedule status.' }
  if (scheduleId !== null && !Number.isInteger(scheduleId)) return { error: 'Select a valid schedule.' }

  const admin = createAdminClient()
  let isManualOverride = false
  if (scheduleId !== null) {
    const { data: existing, error } = await admin.from('class_schedule')
      .select('date, weekly_template_id, is_manual_override')
      .eq('id', scheduleId)
      .maybeSingle()
    if (error || !existing) return { error: 'Schedule not found. It may have already been removed.' }
    if (existing.weekly_template_id !== null && input.date !== existing.date) {
      return { error: 'A recurring class stays on its weekly date. Change the coach or cancel this session instead.' }
    }
    isManualOverride = Boolean(existing.is_manual_override) || existing.weekly_template_id !== null
  }
  const { data: branch, error: branchError } = await admin.from('branch')
    .select('id, operating_hours')
    .eq('id', branch_id)
    .eq('is_active', true)
    .maybeSingle()
  if (branchError || !branch) return { error: 'Select an active branch.' }
  const { data: coachAssignment, error: coachAssignmentError } = await admin.from('user')
    .select('role')
    .eq('id', coach_id)
    .maybeSingle()
  if (coachAssignmentError || !coachAssignment) return { error: 'Select an active coach account.' }
  if (!(await validateCoach(admin, coach_id))) return { error: 'Select an active coach account.' }

  const assistantCoach = coachAssignment.role === 'assistant_coach'

  if (status === 'Scheduled') {
    try {
      if (await activeClosureConflict(admin, branch_id, date)) return { error: 'This branch is closed on that date.' }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not check branch closures.' }
    }
    const operatingHours = parseBranchOperatingHours(branch.operating_hours)
    const hoursConflict = branchOperatingHoursConflict(operatingHours, isoWeekday(date), time_start, time_end)
    // Legacy branches may not have operating hours yet. Let the Head Coach update
    // an existing session while those hours are being entered, but don't create
    // a new one without a known schedule.
    if (hoursConflict && (branch.operating_hours !== null || scheduleId === null)) return { error: hoursConflict }
  }

  if (status !== 'Cancelled') {
    const { data: sameDay, error } = await admin.from('class_schedule')
      .select('id, time_start, time_end')
      .eq('date', date)
      .eq('coach_id', coach_id)
      .neq('status', 'Cancelled')
    if (error) return { error: error.message }
    if ((sameDay ?? []).some((slot) => Number(slot.id) !== scheduleId && overlaps(time_start, time_end, slot.time_start, slot.time_end))) {
      return { error: 'This coach already has an overlapping class at another branch or this branch.' }
    }
  }

  if (status === 'Scheduled' && assistantCoach) {
    try {
      if (await coachWeeklyAvailabilityConflict(admin, coach_id, date, time_start, time_end, true)) return { error: 'This class falls outside the assistant coach’s submitted weekly availability.' }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not validate coach availability.' }
    }
  }

  const payload = {
    date,
    time_start,
    time_end,
    branch_id,
    coach_id,
    status,
    auto_cancelled: false,
    closure_id: null,
    is_manual_override: isManualOverride,
    is_cross_branch_override: false,
  }
  const result = scheduleId === null
    ? await admin.from('class_schedule').insert(payload).select(scheduleSelection).single()
    : await admin.from('class_schedule').update(payload).eq('id', scheduleId).select(scheduleSelection).single()
  if (result.error) return { error: result.error.message }
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return { data: withCoachName(result.data as unknown as Record<string, unknown>) }
}

export async function deleteSchedule(scheduleId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedules.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can change schedules.' }
  if (!Number.isInteger(scheduleId)) return { error: 'Invalid schedule.' }

  const admin = createAdminClient()
  const { count, error: attendanceError } = await admin.from('attendance')
    .select('schedule_id', { count: 'exact', head: true })
    .eq('schedule_id', scheduleId)
  if (attendanceError) return { error: attendanceError.message }
  if (count) return { error: 'Attendance is already recorded for this class. Set its status to Cancelled instead.' }

  const { data, error } = await admin.from('class_schedule').delete().eq('id', scheduleId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Schedule not found. It may have already been deleted.' }
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return { success: true }
}

export async function saveWeeklyAvailability(id: number | null, input: WeeklyAvailabilityInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to submit availability.' }
  if (currentUser.role !== 'assistant_coach') return { error: 'Weekly availability is submitted by Assistant Coaches.' }
  if (!isWeekday(input.weekday) || !isTime(input.time_start) || !isTime(input.time_end)) return { error: 'Enter a valid weekday and time range.' }
  if (input.time_start >= input.time_end) return { error: 'End time must be after start time.' }

  const admin = createAdminClient()
  const { data: existing, error: queryError } = await admin.from('coach_weekly_availability')
    .select('id, time_start, time_end')
    .eq('coach_id', currentUser.id)
    .eq('weekday', input.weekday)
  if (queryError) return { error: queryError.message }
  const conflict = (existing ?? []).some((slot) => {
    return Number(slot.id) !== id && overlaps(input.time_start, input.time_end, slot.time_start, slot.time_end)
  })
  if (conflict) return { error: 'This time overlaps another weekly availability block for that weekday.' }

  const result = id === null
    ? await admin.from('coach_weekly_availability').insert({ ...input, coach_id: currentUser.id }).select('id').single()
    : await admin.from('coach_weekly_availability').update(input).eq('id', id).eq('coach_id', currentUser.id).select('id').maybeSingle()
  const { data, error } = result
  if (error) return { error: error.message }
  if (id !== null && !data) return { error: 'Availability entry not found.' }
  const today = dateInTimeZone()
  const sync = await syncWeeklySessions(addDays(today, 1), addDays(today, 28))
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return { success: true, message: availabilitySyncMessage(sync) }
}

export async function removeWeeklyAvailability(id: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage availability.' }
  if (!Number.isInteger(id)) return { error: 'Invalid availability entry.' }
  const admin = createAdminClient()
  let query = admin.from('coach_weekly_availability').delete().eq('id', id)
  if (currentUser.role === 'assistant_coach') query = query.eq('coach_id', currentUser.id)
  else if (currentUser.role !== 'head_coach') return { error: 'You do not have permission to manage availability.' }
  const { data, error } = await query.select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Availability entry not found.' }
  if (currentUser.role === 'assistant_coach') {
    const today = dateInTimeZone()
    const sync = await syncWeeklySessions(addDays(today, 1), addDays(today, 28))
    revalidatePath('/attendance')
    revalidatePath('/scheduling')
    return { success: true, message: availabilitySyncMessage(sync) }
  }
  revalidatePath('/scheduling')
  return { success: true }
}

function availabilitySyncMessage(sync: WeeklySessionSyncResult) {
  if (sync.error) return `Availability saved, but upcoming classes could not be fully updated: ${sync.error}`
  if (sync.cancelled > 0) return `Availability saved. ${sync.cancelled} upcoming class${sync.cancelled === 1 ? ' was' : 'es were'} cancelled because a closure or schedule rule now conflicts. The Head Coach should review the master schedule.`
  return 'Availability saved. Upcoming classes were checked against the updated availability.'
}

export async function saveWeeklyTemplate(id: number | null, input: WeeklyTemplateInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage recurring classes.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage recurring classes.' }
  if (!isWeekday(input.weekday) || !isTime(input.time_start) || !isTime(input.time_end)) return { error: 'Enter a valid weekday and time range.' }
  if (input.time_start >= input.time_end || !Number.isInteger(input.branch_id) || !Number.isInteger(input.coach_id)) {
    return { error: 'Select a branch and coach, and check the time range.' }
  }

  const admin = createAdminClient()
  const { data: branch, error: branchError } = await admin.from('branch')
    .select('id, operating_hours')
    .eq('id', input.branch_id)
    .eq('is_active', true)
    .maybeSingle()
  if (branchError || !branch) return { error: 'Select an active branch.' }
  const branchHoursConflict = branchOperatingHoursConflict(
    parseBranchOperatingHours(branch.operating_hours),
    input.weekday,
    input.time_start,
    input.time_end,
  )
  if (branchHoursConflict) return { error: branchHoursConflict }
  const { data: coach, error: coachError } = await admin.from('user')
    .select('id, auth_id, role, primary_branch_id')
    .eq('id', input.coach_id)
    .maybeSingle()
  if (coachError || !coach || coach.role !== 'assistant_coach') return { error: 'Choose an active Assistant Coach for a recurring class.' }
  if (!(await validateCoach(admin, input.coach_id))) return { error: 'The selected coach login is inactive.' }

  const { data: availability, error: availabilityError } = await admin.from('coach_weekly_availability')
    .select('time_start, time_end')
    .eq('coach_id', input.coach_id)
    .eq('weekday', input.weekday)
  if (availabilityError) return { error: availabilityError.message }
  const isWithinAvailability = (availability ?? []).some((slot) =>
    slot.time_start.slice(0, 5) <= input.time_start && slot.time_end.slice(0, 5) >= input.time_end,
  )
  if (!isWithinAvailability) return { error: 'This assistant coach has not marked the full class time as available for that weekday.' }

  const { data: samePattern, error: patternError } = await admin.from('weekly_class_template')
    .select('id, time_start, time_end')
    .eq('coach_id', input.coach_id)
    .eq('weekday', input.weekday)
    .eq('is_active', true)
  if (patternError) return { error: patternError.message }
  if ((samePattern ?? []).some((template) => Number(template.id) !== id && overlaps(input.time_start, input.time_end, template.time_start, template.time_end))) {
    return { error: 'This coach already has an overlapping class in the weekly master schedule.' }
  }

  // The master schedule is ongoing. Keep the existing DB columns populated for
  // compatibility, but do not expose or use an active date range in the UI.
  const payload = { ...input, active_from: dateInTimeZone(), active_until: null, is_active: true }
  const result = id === null
    ? await admin.from('weekly_class_template').insert(payload).select('id').single()
    : await admin.from('weekly_class_template').update(payload).eq('id', id).select('id').single()
  if (result.error) return { error: result.error.message }

  const today = dateInTimeZone()
  const sync = await syncWeeklySessions(addDays(today, 1), addDays(today, 28))
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return {
    success: true,
    message: sync.error
      ? `Weekly class saved, but upcoming sessions could not be fully updated: ${sync.error}`
      : 'Weekly class saved. Upcoming sessions have been updated automatically.',
  }
}

export async function deleteWeeklyTemplate(id: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage recurring classes.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage recurring classes.' }
  if (!Number.isInteger(id)) return { error: 'Invalid recurring class.' }
  const admin = createAdminClient()
  const today = dateInTimeZone()
  const { data: futureSessions, error: queryError } = await admin.from('class_schedule')
    .select('id')
    .eq('weekly_template_id', id)
    .eq('status', 'Scheduled')
    .gt('date', today)
  if (queryError) return { error: queryError.message }
  const ids = (futureSessions ?? []).map((session) => Number(session.id))
  let attendedIds = new Set<number>()
  if (ids.length) {
    const { data: attendance, error: attendanceError } = await admin.from('attendance').select('schedule_id').in('schedule_id', ids)
    if (attendanceError) return { error: attendanceError.message }
    attendedIds = new Set((attendance ?? []).map((row) => Number(row.schedule_id)))
  }
  const cancellableIds = ids.filter((sessionId) => !attendedIds.has(sessionId))
  const { data: updatedTemplate, error: templateError } = await admin.from('weekly_class_template')
    .update({ is_active: false })
    .eq('id', id)
    .eq('is_active', true)
    .select('id')
  if (templateError) return { error: templateError.message }
  if (!updatedTemplate?.length) return { error: 'Recurring class not found or already removed.' }
  if (cancellableIds.length) {
    const { error } = await admin.from('class_schedule').update({ status: 'Cancelled', auto_cancelled: true })
      .in('id', cancellableIds).eq('status', 'Scheduled')
    if (error) return { error: `The weekly class was removed, but future sessions could not be cancelled: ${error.message}` }
  }
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return { success: true, message: `${cancellableIds.length} upcoming session${cancellableIds.length === 1 ? ' was' : 's were'} cancelled. Past sessions and sessions with attendance records were preserved.` }
}

export async function ensureWeeklySessions(startDate: string, endDate: string): Promise<WeeklySessionSyncResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { created: 0, updated: 0, cancelled: 0, conflicts: [], error: 'Please sign in to load the schedule.' }
  if (currentUser.role !== 'head_coach') return { created: 0, updated: 0, cancelled: 0, conflicts: [] }
  return syncWeeklySessions(startDate, endDate)
}

export type ScheduleClosureInput = {
  branch_id: number | null
  starts_on: string
  ends_on: string
  reason: string
}

export async function createScheduleClosure(input: ScheduleClosureInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedule closures.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can mark a branch closed.' }
  if (!input || typeof input !== 'object') return { error: 'Closure details are invalid.' }
  if (!isRealDate(input.starts_on) || !isRealDate(input.ends_on) || input.starts_on < dateInTimeZone() || input.starts_on > input.ends_on) {
    return { error: 'Choose a valid date range starting today or later.' }
  }
  if (input.branch_id !== null && (!Number.isInteger(input.branch_id) || input.branch_id <= 0)) {
    return { error: 'Choose a branch or all branches.' }
  }
  const reason = String(input.reason ?? '').trim()
  if (reason.length > 120) return { error: 'The note must be 120 characters or fewer.' }

  const admin = createAdminClient()
  if (input.branch_id !== null) {
    const { data: branch, error } = await admin.from('branch').select('id').eq('id', input.branch_id).eq('is_active', true).maybeSingle()
    if (error || !branch) return { error: 'Choose an active branch.' }
  }

  const { data: overlaps, error: overlapError } = await admin.from('schedule_closure')
    .select('branch_id')
    .eq('is_active', true)
    .lte('starts_on', input.ends_on)
    .gte('ends_on', input.starts_on)
  if (overlapError) return { error: overlapError.message }
  const conflictingClosure = (overlaps ?? []).some((closure) =>
    closure.branch_id === null || input.branch_id === null || Number(closure.branch_id) === input.branch_id,
  )
  if (conflictingClosure) return { error: 'A closure already covers some of those dates for this branch.' }

  let impactedQuery = admin.from('class_schedule')
    .select('id')
    .eq('status', 'Scheduled')
    .gte('date', input.starts_on)
    .lte('date', input.ends_on)
  if (input.branch_id !== null) impactedQuery = impactedQuery.eq('branch_id', input.branch_id)
  const { data: impacted, error: sessionsError } = await impactedQuery
  if (sessionsError) return { error: sessionsError.message }
  const impactedIds = (impacted ?? []).map((session) => Number(session.id))
  const attendedIds = new Set<number>()
  if (impactedIds.length) {
    const { data: attendance, error } = await admin.from('attendance').select('schedule_id').in('schedule_id', impactedIds)
    if (error) return { error: error.message }
    for (const row of attendance ?? []) attendedIds.add(Number(row.schedule_id))
  }

  const { data: closure, error: insertError } = await admin.from('schedule_closure').insert({
    branch_id: input.branch_id,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    reason: reason || null,
    created_by: currentUser.id,
  }).select('id').single()
  if (insertError || !closure) return { error: insertError?.message ?? 'Could not save the closure.' }

  const cancellableIds = impactedIds.filter((id) => !attendedIds.has(id))
  if (cancellableIds.length) {
    const { error } = await admin.from('class_schedule')
      .update({ status: 'Cancelled', auto_cancelled: true, closure_id: Number(closure.id) })
      .in('id', cancellableIds)
      .eq('status', 'Scheduled')
    if (error) {
      revalidatePath('/scheduling')
      revalidatePath('/attendance')
      return { success: true, message: `Closure saved, but some sessions could not be cancelled: ${error.message}` }
    }
  }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  const protectedCount = impactedIds.length - cancellableIds.length
  return {
    success: true,
    message: `${cancellableIds.length} scheduled session${cancellableIds.length === 1 ? '' : 's'} cancelled.${protectedCount ? ` ${protectedCount} session${protectedCount === 1 ? ' has' : 's have'} attendance recorded and was left unchanged.` : ''}`,
  }
}

export async function removeScheduleClosure(closureId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedule closures.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can remove a closure.' }
  if (!Number.isInteger(closureId) || closureId <= 0) return { error: 'Choose a valid closure.' }

  const admin = createAdminClient()
  const today = dateInTimeZone()
  const { data: closure, error: closureError } = await admin.from('schedule_closure')
    .select('id, branch_id, starts_on, ends_on')
    .eq('id', closureId)
    .eq('is_active', true)
    .maybeSingle()
  if (closureError || !closure) return { error: 'Closure not found. It may already have been removed.' }
  if (closure.ends_on < today) return { error: 'Past closures cannot be removed.' }

  const { data: candidates, error: candidateError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, weekly_template_id, is_manual_override, is_cross_branch_override')
    .eq('closure_id', closureId)
    .eq('status', 'Cancelled')
    .eq('auto_cancelled', true)
    .gte('date', today)
  if (candidateError) return { error: candidateError.message }
  const candidateRows = candidates ?? []
  const candidateIds = candidateRows.map((row) => Number(row.id))
  const candidateCoachIds = [...new Set(candidateRows.map((row) => Number(row.coach_id)))]
  const { data: candidateCoaches, error: candidateCoachesError } = candidateCoachIds.length
    ? await admin.from('user').select('id, role, primary_branch_id').in('id', candidateCoachIds)
    : { data: [], error: null }
  if (candidateCoachesError) return { error: candidateCoachesError.message }
  const candidateCoachById = new Map((candidateCoaches ?? []).map((coach) => [Number(coach.id), coach]))
  const attendedIds = new Set<number>()
  if (candidateIds.length) {
    const { data: attendance, error } = await admin.from('attendance').select('schedule_id').in('schedule_id', candidateIds)
    if (error) return { error: error.message }
    for (const row of attendance ?? []) attendedIds.add(Number(row.schedule_id))
  }

  const { data: otherClosures, error: otherClosureError } = await admin.from('schedule_closure')
    .select('branch_id, starts_on, ends_on')
    .eq('is_active', true)
    .neq('id', closureId)
  if (otherClosureError) return { error: otherClosureError.message }
  const { error: deactivateError } = await admin.from('schedule_closure').update({ is_active: false }).eq('id', closureId).eq('is_active', true)
  if (deactivateError) return { error: deactivateError.message }

  let restoredOneOff = 0
  let leftCancelled = 0
  for (const session of candidateRows) {
    const id = Number(session.id)
    if (attendedIds.has(id)) { leftCancelled += 1; continue }
    const stillClosed = (otherClosures ?? []).some((other) =>
      other.starts_on <= session.date
      && other.ends_on >= session.date
      && (other.branch_id === null || Number(other.branch_id) === Number(session.branch_id)),
    )
    if (stillClosed) { leftCancelled += 1; continue }
    if (session.weekly_template_id !== null && !session.is_manual_override) continue

    const assignedCoach = candidateCoachById.get(Number(session.coach_id))
    if (!assignedCoach || (assignedCoach.role === 'assistant_coach' && (
      assignedCoach.primary_branch_id === null
      || (Number(assignedCoach.primary_branch_id) !== Number(session.branch_id) && !session.is_cross_branch_override)
    ))) { leftCancelled += 1; continue }

    const { data: branch, error: branchError } = await admin.from('branch')
      .select('id, operating_hours')
      .eq('id', session.branch_id)
      .eq('is_active', true)
      .maybeSingle()
    const operatingHours = branch ? parseBranchOperatingHours(branch.operating_hours) : null
    if (branchError || !branch || (operatingHours !== null && branchOperatingHoursConflict(operatingHours, isoWeekday(session.date), session.time_start, session.time_end))) {
      leftCancelled += 1
      continue
    }
    if (!(await validateCoach(admin, Number(session.coach_id)))) { leftCancelled += 1; continue }
    try {
      if (await coachWeeklyAvailabilityConflict(admin, Number(session.coach_id), session.date, session.time_start, session.time_end, assignedCoach.role === 'assistant_coach')) { leftCancelled += 1; continue }
    } catch { leftCancelled += 1; continue }

    const { data: sameDay, error: conflictError } = await admin.from('class_schedule')
      .select('id, time_start, time_end')
      .eq('date', session.date)
      .eq('coach_id', session.coach_id)
      .neq('status', 'Cancelled')
      .neq('id', id)
    if (conflictError || (sameDay ?? []).some((other) => overlaps(session.time_start, session.time_end, other.time_start, other.time_end))) {
      leftCancelled += 1
      continue
    }
    const { data: restored, error } = await admin.from('class_schedule')
      .update({ status: 'Scheduled', auto_cancelled: false, closure_id: null })
      .eq('id', id)
      .eq('closure_id', closureId)
      .eq('status', 'Cancelled')
      .select('id')
    if (error) { leftCancelled += 1; continue }
    if (restored?.length) restoredOneOff += 1
  }

  const syncStart = closure.starts_on < today ? today : closure.starts_on
  const sync = syncStart <= closure.ends_on ? await syncWeeklySessions(syncStart, closure.ends_on) : null
  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  const syncWarning = sync?.error ? ` Weekly sessions may need review: ${sync.error}` : ''
  return {
    success: true,
    message: `Closure removed. ${restoredOneOff} one-time session${restoredOneOff === 1 ? ' was' : 's were'} restored.${leftCancelled ? ` ${leftCancelled} session${leftCancelled === 1 ? ' remains' : 's remain'} cancelled because of attendance, another closure, or a scheduling conflict.` : ''}${syncWarning}`,
  }
}

export async function reportScheduleAbsence(input: ScheduleAbsenceInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to report time away.' }
  if (currentUser.role !== 'assistant_coach') return { error: 'Assistant Coaches submit time-away reports.' }
  if (!input || !isRealDate(input.starts_on) || !isRealDate(input.ends_on) || input.starts_on < dateInTimeZone() || input.starts_on > input.ends_on) {
    return { error: 'Choose a valid date range starting today or later.' }
  }
  const reason = String(input.reason ?? '').trim()
  if (reason.length > 200) return { error: 'The note must be 200 characters or fewer.' }

  const admin = createAdminClient()
  const { data: overlappingReports, error: overlapError } = await admin.from('schedule_absence_report')
    .select('id')
    .eq('coach_id', currentUser.id)
    .eq('status', 'pending')
    .lte('starts_on', input.ends_on)
    .gte('ends_on', input.starts_on)
  if (overlapError) return { error: overlapError.message }
  if (overlappingReports?.length) return { error: 'You already have a pending report for some of these dates.' }

  const { error } = await admin.from('schedule_absence_report').insert({
    coach_id: currentUser.id,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    reason: reason || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  revalidatePath('/notifications')
  return {
    success: true,
    message: 'Time away reported. The Head Coach can now review the affected classes and arrange coverage.',
  }
}

export async function assignAbsenceCover(reportId: number, substituteCoachId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedule coverage.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can assign a substitute.' }
  if (!Number.isSafeInteger(reportId) || reportId <= 0 || !Number.isSafeInteger(substituteCoachId) || substituteCoachId <= 0) {
    return { error: 'Choose a valid report and substitute.' }
  }

  const admin = createAdminClient()
  const { data: report, error: reportError } = await admin.from('schedule_absence_report')
    .select('id, coach_id, starts_on, ends_on, status')
    .eq('id', reportId)
    .maybeSingle()
  if (reportError || !report) return { error: 'Time-away report not found.' }
  if (report.status !== 'pending') return { error: 'This time-away report has already been resolved.' }
  if (Number(report.coach_id) === substituteCoachId) return { error: 'Choose a different Assistant Coach.' }

  const syncStart = report.starts_on < dateInTimeZone() ? dateInTimeZone() : report.starts_on
  if (syncStart <= report.ends_on) {
    const sync = await syncWeeklySessions(syncStart, report.ends_on)
    if (sync.error) return { error: `Could not prepare the affected schedule: ${sync.error}` }
  }

  const { data: originalSessions, error: originalError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, absence_report_id')
    .eq('coach_id', report.coach_id)
    .eq('status', 'Scheduled')
    .gte('date', report.starts_on)
    .lte('date', report.ends_on)
  if (originalError) return { error: originalError.message }
  const { data: previouslyCoveredSessions, error: coveredError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, absence_report_id')
    .eq('absence_report_id', reportId)
    .eq('status', 'Scheduled')
  if (coveredError) return { error: coveredError.message }
  const combinedSessions = [...(originalSessions ?? []), ...(previouslyCoveredSessions ?? [])]
  const sessionsById = new Map(combinedSessions.map((session) => [Number(session.id), session]))
  const affectedSessions = [...sessionsById.values()]
  if (!affectedSessions.length) {
    const { error } = await admin.from('schedule_absence_report').update({
      status: 'resolved', resolution: 'no_sessions', resolved_by: currentUser.id, resolved_at: new Date().toISOString(),
    }).eq('id', reportId).eq('status', 'pending')
    if (error) return { error: error.message }
    revalidatePath('/scheduling')
    revalidatePath('/notifications')
    return { success: true, message: 'No scheduled classes need coverage during these dates. The report was marked reviewed.' }
  }

  const substituteResult = await admin.from('user')
    .select('id, auth_id, role')
    .eq('id', substituteCoachId)
    .maybeSingle()
  const substitute = substituteResult.data
  if (substituteResult.error || !substitute || !['assistant_coach', 'head_coach'].includes(substitute.role)) {
    return { error: 'Choose an active assistant coach or the Head Coach.' }
  }
  if (!(await validateCoach(admin, substituteCoachId))) return { error: 'The selected coach login is inactive.' }

  const sessionIds = affectedSessions.map((session) => Number(session.id))
  const { data: attendanceRows, error: attendanceError } = await admin.from('attendance')
    .select('schedule_id')
    .in('schedule_id', sessionIds)
  if (attendanceError) return { error: attendanceError.message }
  if (attendanceRows?.length) return { error: 'A class in this date range already has attendance recorded. Review that class separately before assigning cover.' }

  const branchIds = [...new Set(affectedSessions.map((session) => Number(session.branch_id)))]
  const { data: branches, error: branchesError } = await admin.from('branch')
    .select('id, operating_hours')
    .in('id', branchIds)
    .eq('is_active', true)
  if (branchesError) return { error: branchesError.message }
  const branchById = new Map((branches ?? []).map((branch) => [Number(branch.id), branch]))
  let availability: { weekday: number; time_start: string; time_end: string }[] = []
  if (substitute.role === 'assistant_coach') {
    const availabilityResult = await admin.from('coach_weekly_availability')
      .select('weekday, time_start, time_end')
      .eq('coach_id', substituteCoachId)
    if (availabilityResult.error) return { error: availabilityResult.error.message }
    availability = availabilityResult.data ?? []
  }

  const { data: closures, error: closuresError } = await admin.from('schedule_closure')
    .select('branch_id, starts_on, ends_on')
    .eq('is_active', true)
    .lte('starts_on', report.ends_on)
    .gte('ends_on', report.starts_on)
  if (closuresError) return { error: closuresError.message }

  for (const session of affectedSessions) {
    const weekday = isoWeekday(session.date)
    const branch = branchById.get(Number(session.branch_id))
    if (!branch) return { error: `The branch for ${session.date} is no longer active. Review that class separately.` }
    const hoursConflict = branchOperatingHoursConflict(parseBranchOperatingHours(branch.operating_hours), weekday, session.time_start, session.time_end)
    if (hoursConflict) return { error: `${session.date}: ${hoursConflict}` }
    const hasAvailability = substitute.role === 'head_coach' || availability.some((slot) =>
      Number(slot.weekday) === weekday
      && slot.time_start.slice(0, 5) <= session.time_start.slice(0, 5)
      && slot.time_end.slice(0, 5) >= session.time_end.slice(0, 5),
    )
    if (!hasAvailability) return { error: `The substitute is not available for the class on ${session.date} (${session.time_start.slice(0, 5)}–${session.time_end.slice(0, 5)}).` }
    const closureConflict = (closures ?? []).some((closure) =>
      closure.starts_on <= session.date
      && closure.ends_on >= session.date
      && (closure.branch_id === null || Number(closure.branch_id) === Number(session.branch_id)),
    )
    if (closureConflict) return { error: `The branch is closed on ${session.date}. Remove or review that class before assigning cover.` }
  }

  const { data: substituteSessions, error: substituteSessionsError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end')
    .eq('coach_id', substituteCoachId)
    .neq('status', 'Cancelled')
    .gte('date', report.starts_on)
    .lte('date', report.ends_on)
  if (substituteSessionsError) return { error: substituteSessionsError.message }
  const affectedIdSet = new Set(sessionIds)
  for (const session of affectedSessions) {
    const conflict = (substituteSessions ?? []).find((other) =>
      !affectedIdSet.has(Number(other.id))
      && other.date === session.date
      && overlaps(session.time_start, session.time_end, other.time_start, other.time_end),
    )
    if (conflict) return { error: `The substitute already has a class that overlaps on ${session.date} (${conflict.time_start.slice(0, 5)}–${conflict.time_end.slice(0, 5)}). Choose another coach.` }
  }
  for (let index = 0; index < affectedSessions.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < affectedSessions.length; nextIndex += 1) {
      const first = affectedSessions[index]
      const second = affectedSessions[nextIndex]
      if (first.date === second.date && overlaps(first.time_start, first.time_end, second.time_start, second.time_end)) {
        return { error: `The affected classes overlap on ${first.date}. Review the weekly schedule before assigning one substitute to all of them.` }
      }
    }
  }

  for (const session of affectedSessions) {
    const { data, error } = await admin.from('class_schedule').update({
      coach_id: substituteCoachId,
      is_manual_override: true,
      is_cross_branch_override: false,
      absence_report_id: reportId,
      auto_cancelled: false,
      closure_id: null,
    }).eq('id', session.id).eq('status', 'Scheduled').select('id')
    if (error) return { error: `Coverage was only partly assigned. ${error.message} Reopen this report to finish it.` }
    if (!data?.length) return { error: 'A scheduled class changed while coverage was being assigned. Refresh and review the report again.' }
  }

  const { error: resolveError } = await admin.from('schedule_absence_report').update({
    status: 'resolved',
    resolution: 'covered',
    substitute_coach_id: substituteCoachId,
    resolved_by: currentUser.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId).eq('status', 'pending')
  if (resolveError) return { error: `Classes were assigned, but the report could not be marked complete: ${resolveError.message}` }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  revalidatePath('/notifications')
  return { success: true, message: `${affectedSessions.length} scheduled class${affectedSessions.length === 1 ? '' : 'es'} assigned to the substitute for these dates.` }
}

export async function cancelAbsenceClasses(reportId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedule coverage.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can cancel classes for a time-away report.' }
  if (!Number.isSafeInteger(reportId) || reportId <= 0) return { error: 'Choose a valid time-away report.' }

  const admin = createAdminClient()
  const { data: report, error: reportError } = await admin.from('schedule_absence_report')
    .select('id, coach_id, starts_on, ends_on, status')
    .eq('id', reportId)
    .maybeSingle()
  if (reportError || !report) return { error: 'Time-away report not found.' }
  if (report.status !== 'pending') return { error: 'This time-away report has already been resolved.' }

  const syncStart = report.starts_on < dateInTimeZone() ? dateInTimeZone() : report.starts_on
  if (syncStart <= report.ends_on) {
    const sync = await syncWeeklySessions(syncStart, report.ends_on)
    if (sync.error) return { error: `Could not prepare the affected schedule: ${sync.error}` }
  }

  const { data: originalSessions, error: originalError } = await admin.from('class_schedule')
    .select('id')
    .eq('coach_id', report.coach_id)
    .eq('status', 'Scheduled')
    .gte('date', report.starts_on)
    .lte('date', report.ends_on)
  if (originalError) return { error: originalError.message }
  const { data: alreadyCovered, error: coveredError } = await admin.from('class_schedule')
    .select('id')
    .eq('absence_report_id', reportId)
    .eq('status', 'Scheduled')
  if (coveredError) return { error: coveredError.message }
  const sessionIds = [...new Set([...(originalSessions ?? []), ...(alreadyCovered ?? [])].map((session) => Number(session.id)))]
  if (sessionIds.length) {
    const { data: attended, error: attendanceError } = await admin.from('attendance')
      .select('schedule_id')
      .in('schedule_id', sessionIds)
    if (attendanceError) return { error: attendanceError.message }
    if (attended?.length) return { error: 'A class in this date range already has attendance recorded. Review that class separately before cancelling.' }
    const { error } = await admin.from('class_schedule').update({
      status: 'Cancelled',
      auto_cancelled: false,
      closure_id: null,
      is_manual_override: true,
      absence_report_id: reportId,
    }).in('id', sessionIds).eq('status', 'Scheduled')
    if (error) return { error: error.message }
  }

  const { error: resolveError } = await admin.from('schedule_absence_report').update({
    status: 'resolved',
    resolution: sessionIds.length ? 'cancelled' : 'no_sessions',
    substitute_coach_id: null,
    resolved_by: currentUser.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId).eq('status', 'pending')
  if (resolveError) return { error: resolveError.message }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  revalidatePath('/notifications')
  return {
    success: true,
    message: sessionIds.length
      ? `${sessionIds.length} affected class${sessionIds.length === 1 ? '' : 'es'} cancelled.`
      : 'No scheduled classes need coverage during these dates. The report was marked reviewed.',
  }
}

async function loadAbsenceCoverageContext(reportId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedule coverage.' } as const
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage schedule coverage.' } as const
  if (!Number.isSafeInteger(reportId) || reportId <= 0) return { error: 'Choose a valid time-away report.' } as const

  const admin = createAdminClient()
  const { data: report, error: reportError } = await admin.from('schedule_absence_report')
    .select('id, coach_id, starts_on, ends_on, status')
    .eq('id', reportId)
    .maybeSingle()
  if (reportError || !report) return { error: 'Time-away report not found.' } as const
  if (report.status !== 'pending') return { error: 'This time-away report has already been resolved.' } as const

  const syncStart = report.starts_on < dateInTimeZone() ? dateInTimeZone() : report.starts_on
  if (syncStart <= report.ends_on) {
    const sync = await syncWeeklySessions(syncStart, report.ends_on)
    if (sync.error) return { error: `Could not prepare the affected schedule: ${sync.error}` } as const
  }

  const { data: originalSessions, error: originalError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, absence_report_id')
    .eq('coach_id', report.coach_id).eq('status', 'Scheduled')
    .gte('date', report.starts_on).lte('date', report.ends_on)
  if (originalError) return { error: originalError.message } as const
  const { data: handledSessions, error: handledError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, absence_report_id')
    .eq('absence_report_id', reportId)
  if (handledError) return { error: handledError.message } as const
  const affectedById = new Map([...(originalSessions ?? []), ...(handledSessions ?? [])].map((session) => [Number(session.id), session]))
  const affectedSessions = [...affectedById.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start))
  const scheduledSessions = affectedSessions.filter((session) => session.status === 'Scheduled')
  const scheduledIds = scheduledSessions.map((session) => Number(session.id))
  if (scheduledIds.length) {
    const { data: attended, error } = await admin.from('attendance').select('schedule_id').in('schedule_id', scheduledIds)
    if (error) return { error: error.message } as const
    if (attended?.length) return { error: 'A class in this date range already has attendance recorded. Review that class separately before resolving this report.' } as const
  }

  const branchIds = [...new Set(scheduledSessions.map((session) => Number(session.branch_id)))]
  const { data: branches, error: branchesError } = branchIds.length
    ? await admin.from('branch').select('id, name, operating_hours').in('id', branchIds).eq('is_active', true)
    : { data: [], error: null }
  if (branchesError) return { error: branchesError.message } as const
  const branchById = new Map((branches ?? []).map((branch) => [Number(branch.id), branch]))

  const { data: coachRows, error: coachesError } = await admin.from('user')
    .select('id, auth_id, first_name, middle_name, last_name, role').in('role', ['assistant_coach', 'head_coach'])
  if (coachesError) return { error: coachesError.message } as const
  const activeCoachIds = new Set<number>()
  await Promise.all((coachRows ?? []).map(async (coach) => {
    const id = Number(coach.id)
    if (await validateCoach(admin, id)) activeCoachIds.add(id)
  }))
  const assistants = (coachRows ?? []).filter((coach) => coach.role === 'assistant_coach' && Number(coach.id) !== Number(report.coach_id) && activeCoachIds.has(Number(coach.id)))
  const headCoachRow = (coachRows ?? []).find((coach) => Number(coach.id) === Number(currentUser.id) && coach.role === 'head_coach' && activeCoachIds.has(Number(coach.id)))
  const assistantIds = assistants.map((coach) => Number(coach.id))
  const { data: availability, error: availabilityError } = assistantIds.length
    ? await admin.from('coach_weekly_availability').select('coach_id, weekday, time_start, time_end').in('coach_id', assistantIds)
    : { data: [], error: null }
  if (availabilityError) return { error: availabilityError.message } as const

  const { data: currentSchedules, error: schedulesError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, coach_id, status').eq('status', 'Scheduled')
    .gte('date', report.starts_on).lte('date', report.ends_on)
  if (schedulesError) return { error: schedulesError.message } as const
  const affectedIds = new Set(affectedSessions.map((session) => Number(session.id)))
  const { data: otherAbsences, error: absencesError } = await admin.from('schedule_absence_report')
    .select('coach_id, starts_on, ends_on').eq('status', 'pending').neq('id', reportId)
    .lte('starts_on', report.ends_on).gte('ends_on', report.starts_on)
  if (absencesError) return { error: absencesError.message } as const
  const { data: closures, error: closuresError } = scheduledSessions.length
    ? await admin.from('schedule_closure').select('branch_id, starts_on, ends_on').eq('is_active', true)
      .lte('starts_on', report.ends_on).gte('ends_on', report.starts_on)
    : { data: [], error: null }
  if (closuresError) return { error: closuresError.message } as const

  const coachName = (coach: { first_name: string | null; middle_name: string | null; last_name: string | null }) =>
    [coach.first_name, coach.middle_name, coach.last_name].filter(Boolean).join(' ') || 'Coach'
  const options: AbsenceCoverageSession[] = scheduledSessions.map((session) => {
    const weekday = isoWeekday(session.date)
    const branch = branchById.get(Number(session.branch_id))
    const branchConflict = !branch || Boolean(branchOperatingHoursConflict(parseBranchOperatingHours(branch.operating_hours), weekday, session.time_start, session.time_end))
    const closed = (closures ?? []).some((closure) => closure.starts_on <= session.date && closure.ends_on >= session.date
      && (closure.branch_id === null || Number(closure.branch_id) === Number(session.branch_id)))
    const freeAt = (coachId: number) => !(currentSchedules ?? []).some((other) =>
      !affectedIds.has(Number(other.id)) && Number(other.coach_id) === coachId && other.date === session.date
      && other.status !== 'Cancelled' && overlaps(session.time_start, session.time_end, other.time_start, other.time_end),
    )
    const assistantOptions = !branchConflict && !closed ? assistants.filter((coach) => {
      const id = Number(coach.id)
      const available = (availability ?? []).some((slot) => Number(slot.coach_id) === id && Number(slot.weekday) === weekday
        && slot.time_start.slice(0, 5) <= session.time_start.slice(0, 5) && slot.time_end.slice(0, 5) >= session.time_end.slice(0, 5))
      const hasTimeAway = (otherAbsences ?? []).some((absence) => Number(absence.coach_id) === id && absence.starts_on <= session.date && absence.ends_on >= session.date)
      return available && !hasTimeAway && freeAt(id)
    }) : []
    const headCoach = !branchConflict && !closed && headCoachRow && freeAt(Number(currentUser.id))
      ? { id: Number(headCoachRow.id), name: `${coachName(headCoachRow)} (Head Coach)` }
      : null
    return {
      id: Number(session.id), date: session.date, time_start: session.time_start, time_end: session.time_end,
      branch_name: branch?.name ?? 'Branch unavailable', status: 'Scheduled',
      assistant_options: assistantOptions.map((coach) => ({ id: Number(coach.id), name: coachName(coach) })),
      head_coach: headCoach,
    }
  })

  return { admin, currentUser, report, affectedSessions, options }
}

export async function getAbsenceCoverageOptions(reportId: number) {
  const context = await loadAbsenceCoverageContext(reportId)
  if ('error' in context) return { error: context.error }
  return {
    sessions: context.options,
    alreadyCancelled: context.affectedSessions.filter((session) => session.status === 'Cancelled').length,
  }
}

export async function resolveAbsenceReport(reportId: number, decisions: AbsenceCoverageDecision[]) {
  const context = await loadAbsenceCoverageContext(reportId)
  if ('error' in context) return { error: context.error }
  const { admin, currentUser, affectedSessions, options } = context
  if (!Array.isArray(decisions)) return { error: 'Review each affected class before resolving this report.' }
  const scheduledSessions = affectedSessions.filter((session) => session.status === 'Scheduled')
  if (decisions.length !== scheduledSessions.length) return { error: 'Review each affected class before resolving this report.' }

  const decisionById = new Map<number, AbsenceCoverageDecision>()
  for (const decision of decisions) {
    if (!decision || !Number.isSafeInteger(decision.session_id) || (decision.coach_id !== null && !Number.isSafeInteger(decision.coach_id)) || decisionById.has(decision.session_id)) {
      return { error: 'One of the coverage choices is invalid. Refresh the report and try again.' }
    }
    decisionById.set(decision.session_id, decision)
  }
  if (scheduledSessions.some((session) => !decisionById.has(Number(session.id)))) return { error: 'Review each affected class before resolving this report.' }
  const optionsById = new Map(options.map((option) => [option.id, option]))
  const sessionsById = new Map(scheduledSessions.map((session) => [Number(session.id), session]))
  const assignments: { session_id: number; coach_id: number }[] = []
  let cancelledCount = affectedSessions.filter((session) => session.status === 'Cancelled').length

  for (const decision of decisions) {
    const session = sessionsById.get(decision.session_id)
    const option = optionsById.get(decision.session_id)
    if (!session || !option) return { error: 'A class changed while coverage was being reviewed. Refresh and try again.' }
    const conflictsWithSelectedSession = (coachId: number) => decisions.some((otherDecision) => {
      if (otherDecision.session_id === decision.session_id || otherDecision.coach_id !== coachId) return false
      const other = sessionsById.get(otherDecision.session_id)
      return Boolean(other && other.date === session.date
        && overlaps(session.time_start, session.time_end, other.time_start, other.time_end))
    })
    const freeAssistants = option.assistant_options.filter((coach) => !conflictsWithSelectedSession(coach.id))
    const headIsFree = option.head_coach && !conflictsWithSelectedSession(option.head_coach.id) ? option.head_coach : null
    if (decision.coach_id === null) {
      if (freeAssistants.length > 0 || headIsFree) return { error: 'A free coach is available for this class. Assign that coach instead of cancelling it.' }
      cancelledCount += 1
    } else {
      const availableAssistant = freeAssistants.some((coach) => coach.id === decision.coach_id)
      const availableHead = freeAssistants.length === 0 && headIsFree?.id === decision.coach_id
      if (!availableAssistant && !availableHead) return { error: `The selected coach is not available for the class on ${session.date}. Refresh to see current options.` }
      assignments.push({ session_id: decision.session_id, coach_id: decision.coach_id })
    }
  }

  for (let index = 0; index < assignments.length; index += 1) {
    const first = sessionsById.get(assignments[index].session_id)!
    for (let next = index + 1; next < assignments.length; next += 1) {
      const second = sessionsById.get(assignments[next].session_id)!
      if (assignments[index].coach_id === assignments[next].coach_id && first.date === second.date && overlaps(first.time_start, first.time_end, second.time_start, second.time_end)) {
        return { error: 'That coach was selected for overlapping classes. Choose another available coach for one of them.' }
      }
    }
  }

  if (!affectedSessions.length) {
    const { error } = await admin.from('schedule_absence_report').update({ status: 'resolved', resolution: 'no_sessions', resolved_by: currentUser.id, resolved_at: new Date().toISOString() }).eq('id', reportId).eq('status', 'pending')
    if (error) return { error: error.message }
    revalidatePath('/scheduling')
    revalidatePath('/notifications')
    return { success: true, message: 'No scheduled classes need coverage during these dates. The report was marked reviewed.' }
  }

  for (const session of scheduledSessions) {
    const decision = decisionById.get(Number(session.id))!
    const update = decision.coach_id === null
      ? { status: 'Cancelled', auto_cancelled: false, closure_id: null, is_manual_override: true, absence_report_id: reportId }
      : { coach_id: decision.coach_id, is_manual_override: true, is_cross_branch_override: false, absence_report_id: reportId, auto_cancelled: false, closure_id: null }
    const { data, error } = await admin.from('class_schedule').update(update).eq('id', session.id).eq('status', 'Scheduled').select('id')
    if (error) return { error: `Coverage was only partly saved. ${error.message} Refresh this report to finish resolving it.` }
    if (!data?.length) return { error: 'A class changed while coverage was being saved. Refresh and review the report again.' }
  }

  const assignedCoachIds = [...new Set(assignments.map((item) => item.coach_id))]
  const coveredCount = assignments.length
  const resolution = coveredCount === 0 && cancelledCount === 0 ? 'no_sessions'
    : cancelledCount > 0 && coveredCount > 0 ? 'partially_cancelled'
      : cancelledCount > 0 ? 'cancelled' : 'covered'
  const substituteCoachId = resolution === 'covered' && assignedCoachIds.length === 1 ? assignedCoachIds[0] : null
  const { error: resolveError } = await admin.from('schedule_absence_report').update({
    status: 'resolved', resolution, substitute_coach_id: substituteCoachId,
    resolved_by: currentUser.id, resolved_at: new Date().toISOString(),
  }).eq('id', reportId).eq('status', 'pending')
  if (resolveError) return { error: `Classes were updated, but the report could not be marked complete: ${resolveError.message}` }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  revalidatePath('/notifications')
  return { success: true, message: `${coveredCount} class${coveredCount === 1 ? '' : 'es'} covered${cancelledCount ? `; ${cancelledCount} class${cancelledCount === 1 ? '' : 'es'} cancelled` : ''}.` }
}
