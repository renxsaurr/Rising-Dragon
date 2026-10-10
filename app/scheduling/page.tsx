import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import ScheduleBoard from '@/components/ScheduleBoard'
import AvailabilityPanel from '@/components/AvailabilityPanel'
import SchedulePlanningPanel, { type WeeklyClassTemplate } from '@/components/SchedulePlanningPanel'
import ScheduleClosuresPanel, { type ScheduleClosureView } from '@/components/ScheduleClosuresPanel'
import ScheduleAbsencePanel, { type ScheduleAbsenceReportView } from '@/components/ScheduleAbsencePanel'
import { getCurrentUser } from '@/utils/getCurrentUser'
import type { Schedule } from '@/components/WeeklyScheduleBoard'
import { dateInTimeZone } from '@/utils/dates'
import { ensureWeeklySessions } from '@/app/scheduling/actions'

function coachDisplayName(coach: { first_name: string | null; middle_name: string | null; last_name: string | null } | null) {
  if (!coach) return 'Coach'
  return [coach.first_name, coach.middle_name, coach.last_name].filter(Boolean).join(' ') || 'Coach'
}

function coachFirstName(coach: { first_name: string | null } | null) {
  return coach?.first_name?.trim() || 'Coach'
}

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value
}

// local-safe date formatter — avoids the UTC-shift bug from toISOString()
function toDateISO(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysISO(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const { date } = await searchParams
  const baseDate = new Date(`${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dateInTimeZone()}T12:00:00`)

  const selectedDate = toDateISO(baseDate)
  const rangeDates = [selectedDate]
  let sessionSyncPromise: Promise<{ created: number; updated: number; cancelled: number; conflicts: { date: string; branch: string; coach: string; reason: string }[]; error?: string }> = Promise.resolve({ created: 0, updated: 0, cancelled: 0, conflicts: [] })
  if (currentUser.role === 'head_coach') {
    sessionSyncPromise = (async () => {
      const horizonEnd = addDaysISO(dateInTimeZone(), 27)
      let sync = await ensureWeeklySessions(dateInTimeZone(), horizonEnd)
      const viewStart = rangeDates[0] < dateInTimeZone() ? dateInTimeZone() : rangeDates[0]
      const viewEnd = rangeDates[rangeDates.length - 1]
      if (viewEnd > horizonEnd) {
        const additionalSync = viewStart > horizonEnd
          ? await ensureWeeklySessions(viewStart, viewEnd)
          : await ensureWeeklySessions(addDaysISO(horizonEnd, 1), viewEnd)
        sync = {
          created: sync.created + additionalSync.created,
          updated: sync.updated + additionalSync.updated,
          cancelled: sync.cancelled + additionalSync.cancelled,
          conflicts: [...sync.conflicts, ...additionalSync.conflicts],
          error: sync.error ?? additionalSync.error,
        }
      }
      return sync
    })()
  }

  const branchesPromise = supabase.from('branch').select('id, name, operating_hours').eq('is_active', true).order('name')
  const coachesPromise = supabase.from('user')
    .select('id, first_name, middle_name, last_name, role, primary_branch_id, primary_branch:branch!user_primary_branch_id_fkey(name)')
    .in('role', ['head_coach', 'assistant_coach'])
    .order('first_name')
  let weeklyAvailabilityQuery = supabase
    .from('coach_weekly_availability')
    .select('id, coach_id, weekday, time_start, time_end, coach:user!coach_weekly_availability_coach_id_fkey(first_name, middle_name, last_name)')
    .order('weekday')
    .order('time_start')
  if (currentUser.role === 'assistant_coach') weeklyAvailabilityQuery = weeklyAvailabilityQuery.eq('coach_id', currentUser.id)

  const templatesPromise = currentUser.role === 'head_coach'
    ? supabase.from('weekly_class_template')
      .select('id, branch_id, coach_id, weekday, time_start, time_end, active_from, active_until, is_active, branch:branch!weekly_class_template_branch_id_fkey(name), coach:user!weekly_class_template_coach_id_fkey(first_name, middle_name, last_name, role, primary_branch_id, primary_branch:branch!user_primary_branch_id_fkey(name))')
      .order('weekday')
      .order('time_start')
    : Promise.resolve({ data: [] })
  const closuresPromise = currentUser.role === 'head_coach'
    ? supabase.from('schedule_closure')
      .select('id, branch_id, starts_on, ends_on, reason, branch:branch!schedule_closure_branch_id_fkey(name)')
      .eq('is_active', true)
      .gte('ends_on', dateInTimeZone())
      .order('starts_on')
    : Promise.resolve({ data: [] })
  let absenceReportsQuery = supabase.from('schedule_absence_report')
    .select('id, coach_id, starts_on, ends_on, reason, status, resolution, created_at, substitute_coach_id, coach:user!schedule_absence_report_coach_id_fkey(first_name, middle_name, last_name, primary_branch:branch!user_primary_branch_id_fkey(name)), substitute_coach:user!schedule_absence_report_substitute_coach_id_fkey(first_name, middle_name, last_name)')
    .order('created_at', { ascending: false })
  if (currentUser.role === 'assistant_coach') absenceReportsQuery = absenceReportsQuery.eq('coach_id', currentUser.id)

  const [sessionSync, branchResult, coachResult, weeklyAvailabilityResult, templateResult, closureResult, absenceReportResult] = await Promise.all([
    sessionSyncPromise,
    branchesPromise,
    coachesPromise,
    weeklyAvailabilityQuery,
    templatesPromise,
    closuresPromise,
    absenceReportsQuery,
  ])
  const branches = branchResult.data
  const coachRows = coachResult.data
  const weeklyAvailability = weeklyAvailabilityResult.data
  const templateRows = templateResult.data
  const closureRows = closureResult.data
  const absenceReportRows = absenceReportResult.data

  const coaches = (coachRows ?? []).map((coach) => {
    const primaryBranch = firstRelation(coach.primary_branch)
    return {
      id: Number(coach.id),
      name: coachDisplayName(coach),
      role: coach.role,
      primary_branch_id: coach.primary_branch_id ? Number(coach.primary_branch_id) : null,
      primary_branch_name: primaryBranch?.name ?? null,
    }
  })

  let scheduleQuery = supabase
    .from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, weekly_template_id, is_cross_branch_override, absence_report_id, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
    .gte('date', rangeDates[0])
    .lte('date', rangeDates[rangeDates.length - 1])
    .order('date')
    .order('time_start')
  if (currentUser.role === 'assistant_coach') {
    scheduleQuery = scheduleQuery.eq('coach_id', currentUser.id).neq('status', 'Draft')
  }
  const { data: schedules, error } = await scheduleQuery

  if (error) {
    return (
      <DashboardShell title="Schedule" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  const initialSchedules = (schedules ?? []).map((schedule) => ({
    ...schedule,
    coach: firstRelation(schedule.coach) ? { name: coachFirstName(firstRelation(schedule.coach)) } : null,
  })) as unknown as Schedule[]
  const weeklyAvailabilityEntries = (weeklyAvailability ?? []).map((entry) => ({
    ...entry,
    coach: firstRelation(entry.coach) ? { name: coachDisplayName(firstRelation(entry.coach)) } : null,
  }))
  const templates = (templateRows ?? []).map((template) => ({
    ...template,
    branch: firstRelation(template.branch),
    coach: (() => {
      const coach = firstRelation(template.coach)
      return coach ? { ...coach, primary_branch: firstRelation(coach.primary_branch) } : null
    })(),
  })) as unknown as WeeklyClassTemplate[]
  const absenceReports = (absenceReportRows ?? []).map((report) => {
    const coach = firstRelation(report.coach)
    const primaryBranch = coach ? firstRelation(coach.primary_branch) : null
    const substitute = firstRelation(report.substitute_coach)
    return {
      id: Number(report.id),
      coach_id: Number(report.coach_id),
      starts_on: report.starts_on,
      ends_on: report.ends_on,
      reason: report.reason,
      status: report.status,
      resolution: report.resolution,
      created_at: report.created_at,
      substitute_coach_id: report.substitute_coach_id === null ? null : Number(report.substitute_coach_id),
      coach: coach ? { name: coachDisplayName(coach), primary_branch_name: primaryBranch?.name ?? null } : null,
      substitute_coach: substitute ? { name: coachDisplayName(substitute) } : null,
    }
  }) as ScheduleAbsenceReportView[]
  return (
    <DashboardShell title="Schedule" currentUser={currentUser}>
      {currentUser.role === 'head_coach' ? (
          <SchedulePlanningPanel
            templates={templates}
            branches={branches ?? []}
            coaches={coaches}
            weeklyAvailability={(weeklyAvailability ?? []).map((window) => ({
              coach_id: Number(window.coach_id),
              weekday: Number(window.weekday),
              time_start: window.time_start,
              time_end: window.time_end,
            }))}
            sessionSync={sessionSync}
            calendarProps={{
              dateISO: selectedDate,
              initialSchedules,
              branches: branches ?? [],
              coaches: coaches ?? [],
              isHeadCoach: true,
            }}
            availabilityPanel={(
              <AvailabilityPanel
                weeklyEntries={weeklyAvailabilityEntries}
                isAssistantCoach={false}
              />
            )}
            absencePanel={<ScheduleAbsencePanel reports={absenceReports} isAssistantCoach={false} today={dateInTimeZone()} />}
            closuresPanel={(
              <ScheduleClosuresPanel
                closures={(closureRows ?? []).map((closure) => ({ ...closure, branch: firstRelation(closure.branch) })) as ScheduleClosureView[]}
                branches={(branches ?? []).map((branch) => ({ id: Number(branch.id), name: branch.name }))}
                today={dateInTimeZone()}
              />
            )}
          />
      ) : (
        <>
          <ScheduleBoard
            dateISO={selectedDate}
            initialSchedules={initialSchedules}
            branches={branches ?? []}
            coaches={coaches ?? []}
            isHeadCoach={false}
          />
          <AvailabilityPanel
            weeklyEntries={weeklyAvailabilityEntries}
            isAssistantCoach
          />
          <ScheduleAbsencePanel
            reports={absenceReports}
            isAssistantCoach
            today={dateInTimeZone()}
          />
        </>
      )}
    </DashboardShell>
  )
}
