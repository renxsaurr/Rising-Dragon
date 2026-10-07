import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import ScheduleBoard from '@/components/ScheduleBoard'
import AvailabilityPanel from '@/components/AvailabilityPanel'
import SchedulePlanningPanel, { type WeeklyClassTemplate } from '@/components/SchedulePlanningPanel'
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

// Monday-start week containing baseDate
function getWeekDates(baseDate: Date) {
  const day = baseDate.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + diffToMonday)

  const week: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    week.push(toDateISO(d))
  }
  return week
}

// Full 6-row month grid (Sun–Sat) including leading/trailing days from adjacent months
function getMonthDates(baseDate: Date) {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const startDay = firstOfMonth.getDay()
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - startDay)

  const endDay = lastOfMonth.getDay()
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(lastOfMonth.getDate() + (6 - endDay))

  const dates: string[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    dates.push(toDateISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
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

  const { date, view: viewParam } = await searchParams
  const view: 'week' | 'month' = viewParam === 'month' ? 'month' : 'week'
  const baseDate = new Date(`${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dateInTimeZone()}T12:00:00`)

  const weekDates = getWeekDates(baseDate)
  const monthDates = getMonthDates(baseDate)
  const rangeDates = view === 'month' ? monthDates : weekDates
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

  const branchesPromise = supabase.from('branch').select('id, name').eq('is_active', true).order('name')
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
      .select('id, branch_id, coach_id, weekday, time_start, time_end, active_from, active_until, is_active, branch:branch!weekly_class_template_branch_id_fkey(name), coach:user!weekly_class_template_coach_id_fkey(first_name, middle_name, last_name, primary_branch:branch!user_primary_branch_id_fkey(name))')
      .order('weekday')
      .order('time_start')
    : Promise.resolve({ data: [] })

  const [sessionSync, branchResult, coachResult, weeklyAvailabilityResult, templateResult] = await Promise.all([
    sessionSyncPromise,
    branchesPromise,
    coachesPromise,
    weeklyAvailabilityQuery,
    templatesPromise,
  ])
  const branches = branchResult.data
  const coachRows = coachResult.data
  const weeklyAvailability = weeklyAvailabilityResult.data
  const templateRows = templateResult.data

  const coaches = (coachRows ?? []).map((coach) => {
    const primaryBranch = firstRelation(coach.primary_branch)
    return {
      id: Number(coach.id),
      name: coach.first_name?.trim() || 'Coach',
      role: coach.role,
      primary_branch_id: coach.primary_branch_id ? Number(coach.primary_branch_id) : null,
      primary_branch_name: primaryBranch?.name ?? null,
    }
  })

  let scheduleQuery = supabase
    .from('class_schedule')
    .select('id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)')
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
            view,
            weekDates,
            monthDates,
            baseDateISO: toDateISO(baseDate),
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
        />
      ) : (
        <>
          <ScheduleBoard
            view={view}
            weekDates={weekDates}
            monthDates={monthDates}
            baseDateISO={toDateISO(baseDate)}
            initialSchedules={initialSchedules}
            branches={branches ?? []}
            coaches={coaches ?? []}
            isHeadCoach={false}
          />
          <AvailabilityPanel
            weeklyEntries={weeklyAvailabilityEntries}
            isAssistantCoach
          />
        </>
      )}
    </DashboardShell>
  )
}
