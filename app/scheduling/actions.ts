'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'

export type ScheduleInput = {
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  status: 'Scheduled' | 'Cancelled' | 'Completed'
}

export async function saveSchedule(scheduleId: number | null, input: ScheduleInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage schedules.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can change schedules.' }

  const { date, branch_id, coach_id, status } = input
  // Postgres returns time columns as HH:MM:SS; compare everything as HH:MM
  const time_start = String(input.time_start ?? '').slice(0, 5)
  const time_end = String(input.time_end ?? '').slice(0, 5)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time_start) || !/^\d{2}:\d{2}$/.test(time_end)) {
    return { error: 'Enter a valid date and time range.' }
  }
  if (time_start >= time_end) return { error: 'End time must be after start time.' }
  if (!Number.isInteger(branch_id) || !Number.isInteger(coach_id)) return { error: 'Select a branch and coach.' }
  if (!['Scheduled', 'Cancelled', 'Completed'].includes(status)) return { error: 'Select a valid schedule status.' }

  const admin = createAdminClient()
  const { data: coach, error: coachError } = await admin.from('user').select('id, auth_id, role').eq('id', coach_id).maybeSingle()
  if (coachError || !coach || !['head_coach', 'assistant_coach'].includes(coach.role)) return { error: 'Select an active coach account.' }
  const { data: coachAuth, error: coachAuthError } = await admin.auth.admin.getUserById(coach.auth_id)
  if (coachAuthError || !coachAuth.user || (coachAuth.user.banned_until && Date.parse(coachAuth.user.banned_until) > Date.now())) {
    return { error: 'The selected coach login is inactive.' }
  }

  if (status !== 'Cancelled') {
    const { data: sameDay, error } = await admin.from('class_schedule')
      .select('id, time_start, time_end')
      .eq('date', date)
      .eq('coach_id', coach_id)
      .neq('status', 'Cancelled')
    if (error) return { error: error.message }
    const conflict = (sameDay ?? []).some((slot) => {
      if (scheduleId !== null && Number(slot.id) === scheduleId) return false
      return time_start < slot.time_end.slice(0, 5) && time_end > slot.time_start.slice(0, 5)
    })
    if (conflict) return { error: 'This coach already has an overlapping class at another branch or this branch.' }
  }

  if (status === 'Scheduled') {
    const { data: unavailable, error } = await admin.from('coach_availability')
      .select('time_start, time_end')
      .eq('coach_id', coach_id)
      .eq('date', date)
      .eq('status', 'Unavailable')
    if (error) return { error: error.message }
    if ((unavailable ?? []).some((slot) => time_start < slot.time_end.slice(0, 5) && time_end > slot.time_start.slice(0, 5))) {
      return { error: 'This coach marked part of that time as unavailable.' }
    }
  }

  const payload = { date, time_start, time_end, branch_id, coach_id, status }
  const selection = 'id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(name)'
  const result = scheduleId === null
    ? await admin.from('class_schedule').insert(payload).select(selection).single()
    : await admin.from('class_schedule').update(payload).eq('id', scheduleId).select(selection).single()
  const { data, error } = result
  if (error) return { error: error.message }

  revalidatePath('/scheduling')
  revalidatePath('/attendance')
  return { data }
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

export async function saveAvailability(input: {
  date: string
  time_start: string
  time_end: string
  status: 'Available' | 'Unavailable'
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to submit availability.' }
  if (currentUser.role !== 'assistant_coach') return { error: 'Availability submissions are for Assistant Coaches.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time_start) || !/^\d{2}:\d{2}$/.test(input.time_end)) {
    return { error: 'Enter a valid date and time range.' }
  }
  if (input.time_start >= input.time_end || !['Available', 'Unavailable'].includes(input.status)) {
    return { error: 'Choose a valid time range and availability status.' }
  }

  const admin = createAdminClient()
  const { data: sameDay, error: queryError } = await admin.from('coach_availability')
    .select('time_start, time_end')
    .eq('coach_id', currentUser.id)
    .eq('date', input.date)
  if (queryError) return { error: queryError.message }
  if ((sameDay ?? []).some((slot) => input.time_start < slot.time_end && input.time_end > slot.time_start)) {
    return { error: 'Availability entries for the same day cannot overlap.' }
  }

  const { error } = await admin.from('coach_availability').insert({
    coach_id: currentUser.id,
    date: input.date,
    time_start: input.time_start,
    time_end: input.time_end,
    status: input.status,
  })
  if (error) return { error: error.message }
  revalidatePath('/scheduling')
  return { success: true }
}

export async function removeAvailability(availabilityId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage availability.' }
  if (currentUser.role !== 'assistant_coach') return { error: 'Only the Assistant Coach who submitted availability can remove it.' }
  const admin = createAdminClient()
  const { error } = await admin.from('coach_availability').delete().eq('id', availabilityId).eq('coach_id', currentUser.id)
  if (error) return { error: error.message }
  revalidatePath('/scheduling')
  return { success: true }
}
