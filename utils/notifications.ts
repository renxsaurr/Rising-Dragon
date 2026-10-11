import 'server-only'

import { addDays, dateInTimeZone } from '@/utils/dates'
import { createAdminClient } from '@/utils/supabase/admin'

export type SystemNotification = {
  id: string
  title: string
  detail: string
  category: 'Payment' | 'Attendance' | 'Schedule'
  status: 'Action needed' | 'Upcoming' | 'Update'
  date: string
  href: string
}

type Relation<T> = T | T[] | null
const one = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value
const fullName = (person: { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null) =>
  [person?.first_name, person?.middle_name, person?.last_name].filter(Boolean).join(' ') || 'Student'
const displayDate = (value: string) => new Intl.DateTimeFormat('en-PH', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila',
}).format(new Date(`${value}T00:00:00+08:00`))
const displayDateRange = (startsOn: string, endsOn: string) =>
  startsOn === endsOn ? displayDate(startsOn) : `${displayDate(startsOn)} – ${displayDate(endsOn)}`

export async function loadNotifications(user: { id: number; role: 'head_coach' | 'assistant_coach' }) {
  const admin = createAdminClient()
  const today = dateInTimeZone()
  const notifications: SystemNotification[] = []

  if (user.role === 'head_coach') {
    const [failedResult, overdueResult, sessionsResult, absenceResult] = await Promise.all([
      admin.from('payment_reminder').select('id, created_at, reminder_type')
        .eq('status', 'Failed').order('created_at', { ascending: false }).limit(12),
      admin.from('payment').select('id, student_id, due_date, student:student(first_name, middle_name, last_name)')
        .eq('status', 'Unpaid').or('payment_type.eq.Monthly,payment_type.is.null').lt('due_date', today).order('due_date').limit(12),
      admin.from('class_schedule')
        .select('id, date, time_start, branch_id, branch:branch!class_schedule_branch_id_fkey(name)')
        .lt('date', today).neq('status', 'Cancelled').neq('status', 'Draft')
        .order('date', { ascending: false }).order('time_start', { ascending: false }).limit(30),
      admin.from('schedule_absence_report')
        .select('id, starts_on, ends_on, created_at, coach:user!schedule_absence_report_coach_id_fkey(first_name, middle_name, last_name, primary_branch:branch!user_primary_branch_id_fkey(name))')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
    ])
    const failedError = failedResult.error?.message
    const overdueError = overdueResult.error?.message
    const sessionsError = sessionsResult.error?.message
    const absenceError = absenceResult.error?.message
    if (failedError || overdueError || sessionsError || absenceError) {
      return { notifications: [], error: failedError ?? overdueError ?? sessionsError ?? absenceError }
    }

    for (const reminder of failedResult.data ?? []) {
      notifications.push({
        id: `failed-reminder-${reminder.id}`,
        title: 'Payment reminder failed',
        detail: `${reminder.reminder_type} reminder`,
        category: 'Payment', status: 'Action needed', date: reminder.created_at,
        href: `/payments?view=history&historyPage=reminders&hstatus=Failed&hid=${reminder.id}#reminder-${reminder.id}`,
      })
    }

    for (const payment of overdueResult.data ?? []) {
      const student = one(payment.student as Relation<{ first_name: string | null; middle_name: string | null; last_name: string | null }>)
      notifications.push({
        id: `overdue-payment-${payment.id}`,
        title: 'Monthly payment is overdue',
        detail: `${fullName(student)} · Due ${displayDate(payment.due_date)}`,
        category: 'Payment', status: 'Action needed', date: `${payment.due_date}T00:00:00+08:00`,
        href: `/payments?month=${payment.due_date.slice(0, 7)}&filter=overdue&studentId=${payment.student_id}`,
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
          detail: `${branch?.name ?? 'Branch'} · ${displayDate(session.date)}`,
          category: 'Attendance', status: 'Action needed', date: `${session.date}T${session.time_start}+08:00`,
          href: `/attendance?date=${session.date}&branchId=${session.branch_id}&scheduleId=${session.id}`,
        })
      }
    }

    for (const report of absenceResult.data ?? []) {
      const coach = one(report.coach as Relation<{
        first_name: string | null
        middle_name: string | null
        last_name: string | null
        primary_branch: Relation<{ name: string | null }>
      }>)
      const branch = one(coach?.primary_branch ?? null)
      notifications.push({
        id: `absence-report-${report.id}`,
        title: 'Coach time away needs coverage',
        detail: `${fullName(coach)}${branch?.name ? ` · ${branch.name}` : ''} · ${displayDateRange(report.starts_on, report.ends_on)}`,
        category: 'Schedule', status: 'Action needed', date: report.created_at,
        href: `/scheduling?view=week&date=${report.starts_on}#absence-report-${report.id}`,
      })
    }
  } else {
    const [upcomingResult, pastResult, absenceResult] = await Promise.all([
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
      admin.from('schedule_absence_report')
        .select('id, starts_on, ends_on, created_at')
        .eq('coach_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(10),
    ])
    if (upcomingResult.error || pastResult.error || absenceResult.error) return { notifications: [], error: upcomingResult.error?.message ?? pastResult.error?.message ?? absenceResult.error?.message }

    for (const session of upcomingResult.data ?? []) {
      const branch = one(session.branch as Relation<{ name: string | null }>)
      notifications.push({
        id: `assigned-class-${session.id}`,
        title: session.date === today ? 'Assigned class today' : 'Upcoming assigned class',
        detail: `${branch?.name ?? 'Branch'} · ${displayDate(session.date)} · ${session.time_start.slice(0, 5)}–${session.time_end.slice(0, 5)}`,
        category: 'Schedule', status: 'Upcoming', date: `${session.date}T${session.time_start}+08:00`,
        href: `/scheduling?view=week&date=${session.date}#class-session-${session.id}`,
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
          detail: `${branch?.name ?? 'Branch'} · ${displayDate(session.date)}`,
          category: 'Attendance', status: 'Action needed', date: `${session.date}T${session.time_start}+08:00`,
          href: `/attendance?date=${session.date}&scheduleId=${session.id}`,
        })
      }
    }

    for (const report of absenceResult.data ?? []) {
      notifications.push({
        id: `absence-report-status-${report.id}`,
        title: 'Time-away report sent to the Head Coach',
        detail: displayDateRange(report.starts_on, report.ends_on),
        category: 'Schedule', status: 'Update', date: report.created_at,
        href: `/scheduling?view=week&date=${report.starts_on}#absence-report-${report.id}`,
      })
    }
  }

  const priority = { 'Action needed': 0, Update: 1, Upcoming: 2 }
  notifications.sort((a, b) => {
    if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status]
    return a.status === 'Upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  })
  return { notifications: notifications.slice(0, 25), error: null }
}
