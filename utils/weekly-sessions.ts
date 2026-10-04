import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, dateInTimeZone } from '@/utils/dates'

const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
  startA.slice(0, 5) < endB.slice(0, 5) && endA.slice(0, 5) > startB.slice(0, 5)

const isoWeekday = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

type WeeklyTemplate = {
  id: number
  branch_id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
  branch: { name?: string } | null
  coach: { first_name?: string | null; middle_name?: string | null; last_name?: string | null; role?: string } | null
}

type DatedSession = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  status: string
  weekly_template_id: number | null
  auto_cancelled: boolean
}

export type WeeklySessionSyncResult = {
  created: number
  updated: number
  cancelled: number
  conflicts: { date: string; branch: string; coach: string; reason: string }[]
  error?: string
}

const emptyResult = (): WeeklySessionSyncResult => ({ created: 0, updated: 0, cancelled: 0, conflicts: [] })

/** Materialize and reconcile the active weekly plan for a date range. */
export async function syncWeeklySessions(startDate: string, endDate: string): Promise<WeeklySessionSyncResult> {
  const result = emptyResult()
  const today = dateInTimeZone()
  const rangeStart = startDate < today ? today : startDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rangeStart) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || rangeStart > endDate) return result

  const admin = createAdminClient()
  const { data: templateData, error: templateError } = await admin.from('weekly_class_template')
    .select('id, branch_id, coach_id, weekday, time_start, time_end, is_active, branch:branch!weekly_class_template_branch_id_fkey(name), coach:user!weekly_class_template_coach_id_fkey(first_name, middle_name, last_name, role)')
    .eq('is_active', true)
  if (templateError) return { ...result, error: templateError.message }

  const templates = (templateData ?? []) as unknown as WeeklyTemplate[]
  const { data: sessionData, error: sessionError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id, auto_cancelled')
    .gte('date', rangeStart)
    .lte('date', endDate)
  if (sessionError) return { ...result, error: sessionError.message }

  const sessions = (sessionData ?? []) as DatedSession[]
  const attendedSessionIds = new Set<number>()
  if (sessions.length) {
    const { data: attendanceRows, error: attendanceError } = await admin.from('attendance')
      .select('schedule_id')
      .in('schedule_id', sessions.map((session) => session.id))
    if (attendanceError) return { ...result, error: attendanceError.message }
    for (const row of attendanceRows ?? []) attendedSessionIds.add(Number(row.schedule_id))
  }

  const templatesById = new Map(templates.map((template) => [Number(template.id), template]))
  const availabilityCoachIds = [...new Set(templates
    .filter((template) => template.coach?.role === 'assistant_coach')
    .map((template) => Number(template.coach_id))) ]
  let weeklyAvailability: { coach_id: number; weekday: number; time_start: string; time_end: string }[] = []
  if (availabilityCoachIds.length) {
    const { data, error } = await admin.from('coach_weekly_availability')
      .select('coach_id, weekday, time_start, time_end')
      .in('coach_id', availabilityCoachIds)
    if (error) return { ...result, error: error.message }
    weeklyAvailability = (data ?? []) as typeof weeklyAvailability
  }

  const sessionsByTemplateDate = new Map<string, DatedSession>()
  for (const session of sessions) {
    if (session.weekly_template_id !== null) {
      sessionsByTemplateDate.set(`${session.weekly_template_id}:${session.date}`, session)
    }
  }
  const usedSessions = [...sessions]

  const cancelGeneratedSession = async (session: DatedSession) => {
    if (session.status !== 'Scheduled' || attendedSessionIds.has(Number(session.id))) return false
    const { data, error } = await admin.from('class_schedule').update({ status: 'Cancelled', auto_cancelled: true })
      .eq('id', session.id).eq('status', 'Scheduled').select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) return false
    session.status = 'Cancelled'
    result.cancelled += 1
    return true
  }

  try {
    // Stop stale future occurrences when a template was removed or moved to another weekday.
    for (const session of sessions) {
      if (session.status !== 'Scheduled' || session.weekly_template_id === null || session.date <= today) continue
      const template = templatesById.get(Number(session.weekly_template_id))
      if (!template || isoWeekday(session.date) !== Number(template.weekday)) {
        await cancelGeneratedSession(session)
      }
    }

    for (let offset = 0; addDays(rangeStart, offset) <= endDate; offset += 1) {
      const date = addDays(rangeStart, offset)
      const weekday = isoWeekday(date)
      for (const template of templates) {
        if (Number(template.weekday) !== weekday) continue
        const templateId = Number(template.id)
        const existing = sessionsByTemplateDate.get(`${templateId}:${date}`)
        if (existing && existing.status === 'Completed') continue
        if (existing?.status === 'Cancelled' && !existing.auto_cancelled) continue

        const branch = template.branch?.name ?? 'Branch'
        const coachData = template.coach
        const coach = [coachData?.first_name, coachData?.middle_name, coachData?.last_name].filter(Boolean).join(' ') || 'Coach'
        const classStart = template.time_start.slice(0, 5)
        const classEnd = template.time_end.slice(0, 5)
        const coachId = Number(template.coach_id)
        const weeklySlots = weeklyAvailability.filter((slot) => Number(slot.coach_id) === coachId && Number(slot.weekday) === weekday)
        const outsideWeeklyAvailability = coachData?.role === 'assistant_coach'
          && !weeklySlots.some((slot) => slot.time_start.slice(0, 5) <= classStart && slot.time_end.slice(0, 5) >= classEnd)

        let reason: string | null = null
        if (usedSessions.some((session) => Number(session.id) !== Number(existing?.id)
          && Number(session.coach_id) === coachId
          && session.date === date
          && session.status !== 'Cancelled'
          && overlaps(classStart, classEnd, session.time_start, session.time_end))) {
          reason = 'The coach already has an overlapping session.'
        } else if (outsideWeeklyAvailability) {
          reason = 'The class is outside the coach’s weekly availability.'
        }

        if (reason) {
          if (existing && date > today) await cancelGeneratedSession(existing)
          result.conflicts.push({ date, branch, coach, reason })
          continue
        }

        const payload = {
          weekly_template_id: templateId,
          date,
          time_start: classStart,
          time_end: classEnd,
          branch_id: Number(template.branch_id),
          coach_id: coachId,
          status: 'Scheduled' as const,
          auto_cancelled: false,
        }
        if (existing) {
          const hasChanges = existing.time_start.slice(0, 5) !== classStart
            || existing.time_end.slice(0, 5) !== classEnd
            || Number(existing.branch_id) !== Number(template.branch_id)
            || Number(existing.coach_id) !== coachId
          if ((hasChanges || existing.auto_cancelled) && attendedSessionIds.has(Number(existing.id))) continue
          if (existing.auto_cancelled) {
            const { data, error } = await admin.from('class_schedule').update(payload)
              .eq('id', existing.id).eq('status', 'Cancelled').eq('auto_cancelled', true).select('id')
            if (error) return { ...result, error: error.message }
            if (data?.length) {
              Object.assign(existing, payload)
              result.updated += 1
            }
          } else if (hasChanges) {
            const { error } = await admin.from('class_schedule').update(payload).eq('id', existing.id).eq('status', 'Scheduled')
            if (error) return { ...result, error: error.message }
            Object.assign(existing, payload)
            result.updated += 1
          }
        } else {
          const { data, error } = await admin.from('class_schedule').insert(payload).select('id').single()
          if (error) {
            // A page render and the daily job can meet on the same occurrence.
            // A unique constraint makes the competing insert safe and idempotent.
            if (error.code === '23505') continue
            return { ...result, error: error.message }
          }
          const inserted = { ...payload, id: Number(data.id) }
          sessionsByTemplateDate.set(`${templateId}:${date}`, inserted)
          usedSessions.push(inserted)
          result.created += 1
        }
      }
    }
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : 'Could not reconcile weekly class sessions.' }
  }

  return result
}
