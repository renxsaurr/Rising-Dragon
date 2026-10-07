'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { addDays, dateInTimeZone } from '@/utils/dates'
import { syncWeeklySessions, type WeeklySessionSyncResult } from '@/utils/weekly-sessions'

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

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isTime = (value: string) => /^\d{2}:\d{2}$/.test(value)
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

async function coachWeeklyAvailabilityConflict(admin: ReturnType<typeof createAdminClient>, coachId: number, date: string, start: string, end: string) {
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
  // No recurring entries means this coach has not configured a weekly pattern yet.
  // Keep manual scheduling possible, but enforce a submitted pattern when one exists.
  return (data ?? []).length > 0 && !(data ?? []).some((slot) =>
    slot.time_start.slice(0, 5) <= classStart && slot.time_end.slice(0, 5) >= classEnd,
  )
}

const scheduleSelection = 'id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)'

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

  const admin = createAdminClient()
  const { data: branch, error: branchError } = await admin.from('branch')
    .select('id')
    .eq('id', branch_id)
    .eq('is_active', true)
    .maybeSingle()
  if (branchError || !branch) return { error: 'Select an active branch.' }
  if (!(await validateCoach(admin, coach_id))) return { error: 'Select an active coach account.' }

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

  if (status === 'Scheduled') {
    try {
      if (await coachWeeklyAvailabilityConflict(admin, coach_id, date, time_start, time_end)) return { error: 'This class falls outside the coach’s submitted weekly availability.' }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not validate coach availability.' }
    }
  }

  const payload = { date, time_start, time_end, branch_id, coach_id, status, auto_cancelled: false }
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
  if (sync.cancelled > 0) return `Availability saved. ${sync.cancelled} upcoming class${sync.cancelled === 1 ? ' was' : 'es were'} cancelled because the coach is no longer available for the full class time. The Head Coach should review the master schedule.`
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
  const { data: branch, error: branchError } = await admin.from('branch').select('id').eq('id', input.branch_id).eq('is_active', true).maybeSingle()
  if (branchError || !branch) return { error: 'Select an active branch.' }
  const { data: coach, error: coachError } = await admin.from('user')
    .select('id, auth_id, role')
    .eq('id', input.coach_id)
    .maybeSingle()
  if (coachError || !coach || !['head_coach', 'assistant_coach'].includes(coach.role)) return { error: 'Select an active coach account.' }
  if (!(await validateCoach(admin, input.coach_id))) return { error: 'The selected coach login is inactive.' }

  if (coach.role === 'assistant_coach') {
    const { data: availability, error: availabilityError } = await admin.from('coach_weekly_availability')
      .select('time_start, time_end')
      .eq('coach_id', input.coach_id)
      .eq('weekday', input.weekday)
    if (availabilityError) return { error: availabilityError.message }
    const isWithinAvailability = (availability ?? []).some((slot) =>
      slot.time_start.slice(0, 5) <= input.time_start && slot.time_end.slice(0, 5) >= input.time_end,
    )
    if (!isWithinAvailability) return { error: 'This assistant coach has not marked the full class time as available for that weekday.' }
  }

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
