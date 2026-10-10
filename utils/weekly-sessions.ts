import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, dateInTimeZone } from '@/utils/dates'
import { branchOperatingHoursConflict, parseBranchOperatingHours } from '@/utils/branch-operating-hours'

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
  branch: { name?: string; operating_hours?: unknown } | null
  coach: { first_name?: string | null; middle_name?: string | null; last_name?: string | null; role?: string; primary_branch_id?: number | null } | null
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
  closure_id: number | null
  is_manual_override: boolean
  is_cross_branch_override: boolean
  absence_report_id: number | null
  branch: { name?: string; operating_hours?: unknown } | null
  coach: {
    role?: string
    primary_branch_id?: number | null
    primary_branch: { operating_hours?: unknown } | null
    first_name?: string | null
    middle_name?: string | null
    last_name?: string | null
  } | null
}

type ScheduleClosure = {
  id: number
  branch_id: number | null
  starts_on: string
  ends_on: string
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
    .select('id, branch_id, coach_id, weekday, time_start, time_end, is_active, branch:branch!weekly_class_template_branch_id_fkey(name, operating_hours), coach:user!weekly_class_template_coach_id_fkey(first_name, middle_name, last_name, role, primary_branch_id)')
    .eq('is_active', true)
  if (templateError) return { ...result, error: templateError.message }

  const templates = (templateData ?? []) as unknown as WeeklyTemplate[]
  const { data: closureData, error: closureError } = await admin.from('schedule_closure')
    .select('id, branch_id, starts_on, ends_on')
    .eq('is_active', true)
    .lte('starts_on', endDate)
    .gte('ends_on', rangeStart)
  if (closureError) return { ...result, error: closureError.message }
  const closures = (closureData ?? []) as ScheduleClosure[]
  const { data: sessionData, error: sessionError } = await admin.from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id, auto_cancelled, closure_id, is_manual_override, is_cross_branch_override, absence_report_id, branch:branch!class_schedule_branch_id_fkey(name, operating_hours), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name, role, primary_branch_id, primary_branch:branch!user_primary_branch_id_fkey(operating_hours))')
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
  const availabilityCoachIds = [...new Set([
    ...templates.filter((template) => template.coach?.role === 'assistant_coach').map((template) => Number(template.coach_id)),
    ...sessions.filter((session) => session.coach?.role === 'assistant_coach').map((session) => Number(session.coach_id)),
  ])]
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

  const closureForSession = (session: { date: string; branch_id: number }) => closures.find((closure) =>
    closure.starts_on <= session.date
    && closure.ends_on >= session.date
    && (closure.branch_id === null || Number(closure.branch_id) === Number(session.branch_id)),
  )

  const cancelForClosure = async (session: DatedSession, closure: ScheduleClosure) => {
    if (session.status !== 'Scheduled' || attendedSessionIds.has(Number(session.id))) return false
    const { data, error } = await admin.from('class_schedule')
      .update({ status: 'Cancelled', auto_cancelled: true, closure_id: Number(closure.id) })
      .eq('id', session.id).eq('status', 'Scheduled').select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) return false
    session.status = 'Cancelled'
    session.auto_cancelled = true
    session.closure_id = Number(closure.id)
    result.cancelled += 1
    return true
  }

  try {
    // Apply one-time closures to both recurring and manually added sessions.
    for (const session of sessions) {
      const closure = closureForSession(session)
      if (closure) await cancelForClosure(session, closure)
    }

    // Stop stale future occurrences when a template was removed or moved to another weekday.
    for (const session of sessions) {
      if (session.status !== 'Scheduled' || session.weekly_template_id === null || session.is_manual_override || session.date <= today) continue
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
        const closure = closureForSession({ date, branch_id: Number(template.branch_id) })
        if (closure) {
          if (existing) await cancelForClosure(existing, closure)
          continue
        }
        if (existing?.is_manual_override) continue
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
        const branchHours = parseBranchOperatingHours(template.branch?.operating_hours)
        // A null value is a legacy branch with no hours recorded. Preserve its
        // existing schedule until the Head Coach sets hours in Branches.
        const branchHoursReason = branchHours === null
          ? null
          : branchOperatingHoursConflict(branchHours, weekday, classStart, classEnd)

        let reason: string | null = null
        if (usedSessions.some((session) => Number(session.id) !== Number(existing?.id)
          && Number(session.coach_id) === coachId
          && session.date === date
          && session.status !== 'Cancelled'
          && overlaps(classStart, classEnd, session.time_start, session.time_end))) {
          reason = 'The coach already has an overlapping session.'
        } else if (outsideWeeklyAvailability) {
          reason = 'The class is outside the coach’s weekly availability.'
        } else if (branchHoursReason) {
          reason = branchHoursReason
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
          closure_id: null,
          is_manual_override: false,
          is_cross_branch_override: false,
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

    // Recheck one-off edits and absence covers when coach availability or branch
    // hours change. Keep the head coach's manual decision, but surface and
    // automatically cancel a future session when it can no longer be covered.
    for (const session of sessions) {
      if (!session.is_manual_override || session.closure_id !== null) continue
      if (session.status !== 'Scheduled' && !(session.status === 'Cancelled' && session.auto_cancelled)) continue

      const weekday = isoWeekday(session.date)
      const coachData = session.coach
      const coachName = [coachData?.first_name, coachData?.middle_name, coachData?.last_name].filter(Boolean).join(' ') || 'Coach'
      const branchName = session.branch?.name ?? 'Branch'
      let reason: string | null = null
      const branchHours = parseBranchOperatingHours(session.branch?.operating_hours)
      if (branchHours !== null) {
        reason = branchOperatingHoursConflict(branchHours, weekday, session.time_start, session.time_end)
      }

      if (!reason && coachData?.role === 'assistant_coach') {
        const weeklySlots = weeklyAvailability.filter((slot) => Number(slot.coach_id) === Number(session.coach_id) && Number(slot.weekday) === weekday)
        if (!reason && !weeklySlots.some((slot) =>
          slot.time_start.slice(0, 5) <= session.time_start.slice(0, 5)
          && slot.time_end.slice(0, 5) >= session.time_end.slice(0, 5),
        )) {
          reason = 'The class is outside the assistant coach’s weekly availability.'
        }
      }

      if (!reason && usedSessions.some((other) =>
        Number(other.id) !== Number(session.id)
        && Number(other.coach_id) === Number(session.coach_id)
        && other.date === session.date
        && other.status === 'Scheduled'
        && overlaps(session.time_start, session.time_end, other.time_start, other.time_end),
      )) {
        reason = 'The coach already has an overlapping session.'
      }

      if (reason) {
        if (session.status === 'Scheduled' && session.date > today) await cancelGeneratedSession(session)
        result.conflicts.push({ date: session.date, branch: branchName, coach: coachName, reason })
        continue
      }

      if (session.status === 'Cancelled' && session.auto_cancelled && session.date > today && !attendedSessionIds.has(Number(session.id))) {
        const { data, error } = await admin.from('class_schedule').update({ status: 'Scheduled', auto_cancelled: false })
          .eq('id', session.id).eq('status', 'Cancelled').eq('auto_cancelled', true).select('id')
        if (error) return { ...result, error: error.message }
        if (data?.length) {
          session.status = 'Scheduled'
          session.auto_cancelled = false
          result.updated += 1
        }
      }
    }
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : 'Could not reconcile weekly class sessions.' }
  }

  return result
}
