'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone } from '@/utils/dates'

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
const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
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

  const payload = { date, time_start, time_end, branch_id, coach_id, status }
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
  revalidatePath('/scheduling')
  return { success: true }
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
  revalidatePath('/scheduling')
  return { success: true }
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
  const { data: branch } = await admin.from('branch').select('id').eq('id', input.branch_id).maybeSingle()
  if (!branch) return { error: 'Select a valid branch.' }
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

  revalidatePath('/scheduling')
  return { success: true }
}

export async function deleteWeeklyTemplate(id: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage recurring classes.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage recurring classes.' }
  if (!Number.isInteger(id)) return { error: 'Invalid recurring class.' }
  const admin = createAdminClient()
  const { error } = await admin.from('weekly_class_template').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling')
  return { success: true }
}

export async function ensureWeeklySessions(startDate: string, endDate: string): Promise<{
  created: number
  conflicts: { date: string; branch: string; coach: string; reason: string }[]
  error?: string
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { created: 0, conflicts: [], error: 'Please sign in to load the schedule.' }
  if (currentUser.role !== 'head_coach') return { created: 0, conflicts: [] }
  const today = dateInTimeZone()
  const rangeStart = startDate < today ? today : startDate
  if (!isDate(rangeStart) || !isDate(endDate) || rangeStart > endDate) return { created: 0, conflicts: [] }

  const admin = createAdminClient()
  const { data: templates, error: templateError } = await admin.from('weekly_class_template')
    .select('id, branch_id, coach_id, weekday, time_start, time_end, is_active, branch:branch!weekly_class_template_branch_id_fkey(name), coach:user!weekly_class_template_coach_id_fkey(first_name, middle_name, last_name)')
    .eq('is_active', true)
  if (templateError) return { created: 0, conflicts: [], error: templateError.message }
  if (!templates?.length) return { created: 0, conflicts: [] }

  const { data: sessions, error: sessionError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id')
    .gte('date', rangeStart)
    .lte('date', endDate)
  if (sessionError) return { created: 0, conflicts: [], error: sessionError.message }

  const coachIds = [...new Set((templates ?? []).map((template) => Number(template.coach_id)))]
  const { data: weeklyAvailabilityEntries, error: weeklyAvailabilityError } = await admin.from('coach_weekly_availability')
    .select('coach_id, weekday, time_start, time_end')
    .in('coach_id', coachIds)
  if (weeklyAvailabilityError) return { created: 0, conflicts: [], error: weeklyAvailabilityError.message }

  const conflicts: { date: string; branch: string; coach: string; reason: string }[] = []
  const usedSessions = [...(sessions ?? [])]
  const weeklyAvailability = weeklyAvailabilityEntries ?? []
  let created = 0

  for (let offset = 0; addDays(rangeStart, offset) <= endDate; offset++) {
    const date = addDays(rangeStart, offset)
    const weekday = isoWeekday(date)
    for (const template of templates ?? []) {
      if (Number(template.weekday) !== weekday) continue
      const templateId = Number(template.id)
      const existing = usedSessions.find((session) => Number(session.weekly_template_id) === templateId && session.date === date)
      if (existing && ['Cancelled', 'Completed'].includes(existing.status)) continue

      const branch = (template.branch as { name?: string } | null)?.name ?? 'Branch'
      const coachData = template.coach as { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null
      const coach = [coachData?.first_name, coachData?.middle_name, coachData?.last_name].filter(Boolean).join(' ') || 'Coach'
      const classStart = template.time_start.slice(0, 5)
      const classEnd = template.time_end.slice(0, 5)
      const coachId = Number(template.coach_id)
      const weeklySlots = weeklyAvailability.filter((slot) => Number(slot.coach_id) === coachId
        && Number(slot.weekday) === weekday)
      const outsideWeeklyAvailability = weeklySlots.length > 0
        && !weeklySlots.some((slot) => slot.time_start.slice(0, 5) <= classStart && slot.time_end.slice(0, 5) >= classEnd)

      let reason: string | null = null
      if (usedSessions.some((session) => Number(session.id) !== Number(existing?.id)
        && Number(session.coach_id) === coachId
        && session.date === date && session.status !== 'Cancelled'
        && overlaps(classStart, classEnd, session.time_start, session.time_end))) {
        reason = 'The coach already has an overlapping session.'
      } else if (outsideWeeklyAvailability) {
        reason = 'The class is outside the coach’s weekly availability.'
      }

      if (reason) {
        conflicts.push({ date, branch, coach, reason })
        continue
      }

      const payload = {
        weekly_template_id: templateId,
        date,
        time_start: classStart,
        time_end: classEnd,
        branch_id: Number(template.branch_id),
        coach_id: Number(template.coach_id),
        status: 'Scheduled' as const,
      }
      if (existing) {
        const { error } = await admin.from('class_schedule').update(payload).eq('id', existing.id)
        if (error) return { created, conflicts, error: error.message }
        Object.assign(existing, payload)
      } else {
        const { data, error } = await admin.from('class_schedule').insert(payload).select('id').single()
        if (error) return { created, conflicts, error: error.message }
        usedSessions.push({ ...payload, id: data.id })
        created += 1
      }
    }
  }

  return { created, conflicts }
}
