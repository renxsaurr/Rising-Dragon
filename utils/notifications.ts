import 'server-only'

import { addDays, dateInTimeZone } from '@/utils/dates'
import { createAdminClient } from '@/utils/supabase/admin'

export type SystemNotification = {
  id: string
  title: string
  detail: string
  category: 'Payment' | 'Attendance' | 'Student progress' | 'Schedule'
  status: 'Action needed' | 'Upcoming' | 'Update'
  date: string
  href: string
}

type Relation<T> = T | T[] | null
const one = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value
const fullName = (person: { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null) =>
  [person?.first_name, person?.middle_name, person?.last_name].filter(Boolean).join(' ') || 'Student'

export async function loadNotifications(user: { id: number; role: 'head_coach' | 'assistant_coach' }) {
  const admin = createAdminClient()
  const today = dateInTimeZone()
  const notifications: SystemNotification[] = []

  if (user.role === 'head_coach') {
    const [failedResult, overdueResult, sessionsResult, progressResult] = await Promise.all([
      admin.from('payment_reminder').select('id, created_at, reminder_type')
        .eq('status', 'Failed').order('created_at', { ascending: false }).limit(12),
      admin.from('payment').select('id, due_date, student:student(first_name, middle_name, last_name)')
        .eq('status', 'Unpaid').lt('due_date', today).order('due_date').limit(12),
      admin.from('class_schedule')
        .select('id, date, time_start, branch:branch!class_schedule_branch_id_fkey(name)')
        .lt('date', today).neq('status', 'Cancelled').neq('status', 'Draft')
        .order('date', { ascending: false }).order('time_start', { ascending: false }).limit(30),
      admin.from('student_progress')
        .select('id, assessed_on, focus_area, coach_id, student:student(first_name, middle_name, last_name), coach:user!student_progress_coach_id_fkey(first_name, middle_name, last_name)')
        .gte('assessed_on', addDays(today, -14)).neq('coach_id', user.id)
        .order('assessed_on', { ascending: false }).limit(12),
    ])
    const failedError = failedResult.error?.message
    const overdueError = overdueResult.error?.message
    const sessionsError = sessionsResult.error?.message
    const progressError = progressResult.error?.message
    if (failedError || overdueError || sessionsError || progressError) {
      return { notifications: [], error: failedError ?? overdueError ?? sessionsError ?? progressError }
    }

    for (const reminder of failedResult.data ?? []) {
      notifications.push({
        id: `failed-reminder-${reminder.id}`,
        title: 'Payment reminder failed',
        detail: `The ${reminder.reminder_type.toLowerCase()} reminder could not be sent. Review it and retry if appropriate.`,
        category: 'Payment', status: 'Action needed', date: reminder.created_at,
        href: '/payments?view=history&hstatus=Failed',
      })
    }

    for (const payment of overdueResult.data ?? []) {
      const student = one(payment.student as Relation<{ first_name: string | null; middle_name: string | null; last_name: string | null }>)
      notifications.push({
        id: `overdue-payment-${payment.id}`,
        title: 'Monthly payment is overdue',
        detail: `${fullName(student)} · due ${payment.due_date}. Check payment status or contact the guardian.`,
        category: 'Payment', status: 'Action needed', date: `${payment.due_date}T00:00:00+08:00`,
        href: '/payments?filter=overdue',
      })
    }

    const pastSessions = sessionsResult.data ?? []
    if (pastSessions.length) {
      const sessionIds = pastSessions.map((session) => Number(session.id))
      const attendanceResult = await admin.from('attendance').select('schedule_id').in('schedule_id', sessionIds)
      if (attendanceResult.error) return { notifications: [], error: attendanceResult.error.message }
      const marked = new Set((attendanceResult.data ?? []).map((row) => Number(row.schedule_id)))
      for (const session of pastSessions) {
        if (marked.has(Number(session.id))) continue
        const branch = one(session.branch as Relation<{ name: string | null }>)
        notifications.push({
          id: `missing-attendance-${session.id}`,
          title: 'Attendance has not been recorded',
          detail: `${branch?.name ?? 'Branch'} · class on ${session.date}.`,
          category: 'Attendance', status: 'Action needed', date: `${session.date}T${session.time_start}+08:00`,
          href: `/attendance?date=${session.date}`,
        })
      }
    }

    for (const progress of progressResult.data ?? []) {
      const student = one(progress.student as Relation<{ first_name: string | null; middle_name: string | null; last_name: string | null }>)
      const coach = one(progress.coach as Relation<{ first_name: string | null; middle_name: string | null; last_name: string | null }>)
      notifications.push({
        id: `progress-${progress.id}`,
        title: 'Student progress check recorded',
        detail: `${fullName(student)} · ${progress.focus_area} · recorded by ${fullName(coach)}.`,
        category: 'Student progress', status: 'Update', date: `${progress.assessed_on}T12:00:00+08:00`,
        href: '/branches',
      })
    }
  } else {
    const [upcomingResult, pastResult] = await Promise.all([
      admin.from('class_schedule')
        .select('id, date, time_start, time_end, branch:branch!class_schedule_branch_id_fkey(name)')
        .eq('coach_id', user.id).gte('date', today).lte('date', addDays(today, 7))
        .neq('status', 'Cancelled').neq('status', 'Draft')
        .order('date').order('time_start').limit(12),
      admin.from('class_schedule')
        .select('id, date, time_start, branch:branch!class_schedule_branch_id_fkey(name)')
        .eq('coach_id', user.id).lt('date', today)
        .neq('status', 'Cancelled').neq('status', 'Draft')
        .order('date', { ascending: false }).order('time_start', { ascending: false }).limit(20),
    ])
    if (upcomingResult.error || pastResult.error) return { notifications: [], error: upcomingResult.error?.message ?? pastResult.error?.message }

    for (const session of upcomingResult.data ?? []) {
      const branch = one(session.branch as Relation<{ name: string | null }>)
      notifications.push({
        id: `assigned-class-${session.id}`,
        title: session.date === today ? 'Assigned class today' : 'Upcoming assigned class',
        detail: `${branch?.name ?? 'Branch'} · ${session.time_start.slice(0, 5)}–${session.time_end.slice(0, 5)}.`,
        category: 'Schedule', status: 'Upcoming', date: `${session.date}T${session.time_start}+08:00`,
        href: '/scheduling',
      })
    }

    const pastSessions = pastResult.data ?? []
    if (pastSessions.length) {
      const attendanceResult = await admin.from('attendance').select('schedule_id')
        .in('schedule_id', pastSessions.map((session) => Number(session.id)))
      if (attendanceResult.error) return { notifications: [], error: attendanceResult.error.message }
      const marked = new Set((attendanceResult.data ?? []).map((row) => Number(row.schedule_id)))
      for (const session of pastSessions) {
        if (marked.has(Number(session.id))) continue
        const branch = one(session.branch as Relation<{ name: string | null }>)
        notifications.push({
          id: `coach-missing-attendance-${session.id}`,
          title: 'Attendance still needs recording',
          detail: `${branch?.name ?? 'Branch'} · assigned class on ${session.date}.`,
          category: 'Attendance', status: 'Action needed', date: `${session.date}T${session.time_start}+08:00`,
          href: `/attendance?date=${session.date}`,
        })
      }
    }
  }

  const priority = { 'Action needed': 0, Update: 1, Upcoming: 2 }
  notifications.sort((a, b) => {
    if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status]
    return a.status === 'Upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  })
  return { notifications: notifications.slice(0, 25), error: null }
}
