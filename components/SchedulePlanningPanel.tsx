'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { formatTimeRange } from '@/utils/dates'
import ScheduleBoard, { type ScheduleBoardProps } from '@/components/ScheduleBoard'
import SchedulingPageTabs from '@/components/SchedulingPageTabs'
import { deleteWeeklyTemplate, saveWeeklyTemplate } from '@/app/scheduling/actions'
import { BRANCH_WEEKDAYS, branchOperatingHoursConflict, branchOperatingWindowsForDay, formatBranchOperatingHours, parseBranchOperatingHours } from '@/utils/branch-operating-hours'

export type WeeklyClassTemplate = {
  id: number
  branch_id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
  is_active?: boolean
  branch: { name: string } | null
  coach: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    role: string
    primary_branch_id: number | null
    primary_branch: { name: string } | null
  } | null
}

type CoachOption = { id: number; name: string; role: string; primary_branch_id: number | null; primary_branch_name: string | null }
type WeeklyAvailabilityWindow = { coach_id: number; weekday: number; time_start: string; time_end: string }
type TimeWindow = { time_start: string; time_end: string }

const time = (value: string) => value.slice(0, 5)
const toMinutes = (value: string) => {
  const [hours, minutes] = time(value).split(':').map(Number)
  return hours * 60 + minutes
}
const fromMinutes = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

function uncoveredWindows(open: TimeWindow[], assigned: WeeklyClassTemplate[]) {
  const gaps: TimeWindow[] = []
  for (const window of open) {
    const start = toMinutes(window.time_start)
    const end = toMinutes(window.time_end)
    const intervals = assigned
      .filter((item) => toMinutes(item.time_start) < end && toMinutes(item.time_end) > start)
      .map((item) => ({ start: Math.max(start, toMinutes(item.time_start)), end: Math.min(end, toMinutes(item.time_end)) }))
      .sort((a, b) => a.start - b.start)
    let cursor = start
    for (const interval of intervals) {
      if (interval.start > cursor) gaps.push({ time_start: fromMinutes(cursor), time_end: fromMinutes(interval.start) })
      cursor = Math.max(cursor, interval.end)
    }
    if (cursor < end) gaps.push({ time_start: fromMinutes(cursor), time_end: fromMinutes(end) })
  }
  return gaps
}

function coachName(template: WeeklyClassTemplate) {
  return [template.coach?.first_name, template.coach?.middle_name, template.coach?.last_name].filter(Boolean).join(' ') || 'Assistant Coach'
}

export default function SchedulePlanningPanel({
  templates,
  branches,
  coaches,
  weeklyAvailability,
  sessionSync,
  calendarProps,
  availabilityPanel,
  absencePanel,
  closuresPanel,
}: {
  templates: WeeklyClassTemplate[]
  branches: { id: number; name: string; operating_hours?: unknown }[]
  coaches: CoachOption[]
  weeklyAvailability: WeeklyAvailabilityWindow[]
  sessionSync: { created: number; updated: number; cancelled: number; conflicts: { date: string; branch: string; coach: string; reason: string }[]; error?: string }
  calendarProps: ScheduleBoardProps
  availabilityPanel: ReactNode
  absencePanel: ReactNode
  closuresPanel: ReactNode
}) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(String(branches[0]?.id ?? ''))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formDay, setFormDay] = useState<number | null>(null)
  const [coachId, setCoachId] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [weeklyScheduleOpen, setWeeklyScheduleOpen] = useState(false)
  const branch = branches.find((item) => item.id === Number(branchId))
  const operatingHours = parseBranchOperatingHours(branch?.operating_hours)
  const assistantCoaches = coaches.filter((coach) => coach.role === 'assistant_coach')

  const selectedDayAvailability = weeklyAvailability.filter((window) => window.weekday === formDay)
  const eligibleCoaches = assistantCoaches.filter((coach) => selectedDayAvailability.some((window) =>
    window.coach_id === coach.id
    && (!timeStart || !timeEnd || (time(window.time_start) <= timeStart && time(window.time_end) >= timeEnd)),
  ))

  const days = useMemo(() => BRANCH_WEEKDAYS.map((day) => {
    const open = branchOperatingWindowsForDay(operatingHours, day.value)
    const assigned = templates.filter((item) => item.is_active !== false && item.branch_id === Number(branchId) && item.weekday === day.value)
    const isValid = (item: WeeklyClassTemplate) => !branchOperatingHoursConflict(operatingHours, day.value, item.time_start, item.time_end)
      && (item.coach?.role !== 'assistant_coach' || weeklyAvailability.some((window) =>
        window.coach_id === item.coach_id && window.weekday === day.value
        && time(window.time_start) <= time(item.time_start) && time(window.time_end) >= time(item.time_end),
      ))
    const invalid = assigned.filter((item) => !isValid(item))
    const valid = assigned.filter(isValid)
    return { ...day, open, assigned, valid, invalid, gaps: uncoveredWindows(open, valid) }
  }), [operatingHours, templates, branchId, weeklyAvailability])

  const resetForm = () => {
    setEditingId(null)
    setFormDay(null)
    setCoachId('')
    setTimeStart('')
    setTimeEnd('')
    setError('')
  }

  const openForm = (weekday: number, gap?: TimeWindow, template?: WeeklyClassTemplate) => {
    setError('')
    setNotice('')
    setFormDay(weekday)
    setEditingId(template?.id ?? null)
    setTimeStart(template ? time(template.time_start) : gap?.time_start ?? '')
    setTimeEnd(template ? time(template.time_end) : gap?.time_end ?? '')
    setCoachId(template ? String(template.coach_id) : '')
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (formDay === null) return
    setBusy(true)
    setError('')
    setNotice('')
    const result = await saveWeeklyTemplate(editingId, {
      weekday: formDay,
      branch_id: Number(branchId),
      coach_id: Number(coachId),
      time_start: timeStart,
      time_end: timeEnd,
    })
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setNotice(result.message ?? 'Recurring class saved.')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: number) => {
    setBusy(true)
    setError('')
    const result = await deleteWeeklyTemplate(id)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setNotice(result.message ?? 'Recurring class removed.')
    resetForm()
    router.refresh()
  }

  const inputClass = 'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const weeklyBranchSchedulePanel = (
    <div className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-1 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">Branch coverage</h3>
          <p className="mt-0.5 text-sm text-gray-500">Assign recurring classes across the approved operating hours.</p>
        </div>
        <label className="w-full text-xs font-medium text-gray-600 sm:w-64">Branch
          <select className={inputClass} value={branchId} onChange={(event) => { setBranchId(event.target.value); resetForm() }}>
            {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {formDay !== null && <form onSubmit={handleSave} className="border-b border-gray-100 bg-gray-50/70 p-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-gray-950">{editingId ? 'Edit recurring class' : `Cover ${BRANCH_WEEKDAYS[formDay - 1]?.label}`}</h3><p className="mt-1 text-xs text-gray-500">This class repeats every week at this branch.</p></div>
          <button type="button" onClick={resetForm} className="text-sm font-medium text-gray-500 hover:text-black">Close</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">Available assistant coach
            <select required className={inputClass} value={coachId} onChange={(event) => setCoachId(event.target.value)}><option value="">Choose coach</option>{eligibleCoaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</select>
          </label>
          <label className="text-xs font-medium text-gray-600">From<input required type="time" value={timeStart} onChange={(event) => setTimeStart(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-medium text-gray-600">Until<input required type="time" value={timeEnd} onChange={(event) => setTimeEnd(event.target.value)} className={inputClass} /></label>
          <p className="self-center text-xs text-gray-500">Coach must be available for this whole block.</p>
        </div>
        {timeStart && timeEnd && eligibleCoaches.length === 0 && <p className="mt-2 text-xs text-amber-900">No assistant coach is available for this full time block. The gap will remain visible.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={resetForm} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button><button disabled={busy || !eligibleCoaches.some((coach) => coach.id === Number(coachId))} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save class' : 'Assign'}</button></div>
      </form>}

      {operatingHours === null ? (
        <p className="m-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Operating hours are not set. Add and approve this branch’s hours in Branches before scheduling classes.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {days.map((day) => (
            <article key={day.value} className="grid gap-3 px-5 py-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-start sm:px-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{day.label}</h3>
                <p className="mt-1 text-xs text-gray-500">{formatBranchOperatingHours(operatingHours, day.value)}</p>
              </div>
              <div className="min-w-0 space-y-2">
                {day.assigned.map((item) => {
                  const unavailable = day.invalid.some((invalid) => invalid.id === item.id)
                  const outsideHours = Boolean(branchOperatingHoursConflict(operatingHours, day.value, item.time_start, item.time_end))
                  return <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${unavailable ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                  <p className="text-sm text-gray-900"><span className="font-semibold">{formatTimeRange(item.time_start, item.time_end)}</span><span className="mx-2 text-gray-300">·</span>{coachName(item)}{unavailable && <span className="ml-2 text-xs font-semibold text-red-700">{outsideHours ? 'Branch hours changed' : 'Coach availability changed'} · uncovered</span>}</p>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => openForm(day.value, undefined, item)} className="font-medium text-gray-600 hover:text-black">Edit</button>
                    <button type="button" disabled={busy} onClick={() => handleDelete(item.id)} className="font-medium text-gray-500 hover:text-red-700 disabled:opacity-50">Remove</button>
                  </div>
                </div>})}
                {day.gaps.map((gap, index) => <button type="button" key={`${gap.time_start}-${index}`} onClick={() => openForm(day.value, gap)} className="block w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950 hover:bg-amber-100">
                  <span className="font-semibold">{formatTimeRange(gap.time_start, gap.time_end)}</span><span className="ml-2 text-xs">Uncovered · Assign a coach</span>
                </button>)}
                {day.open.length > 0 && day.gaps.length === 0 && <p className="text-xs font-medium text-emerald-700">All open hours covered</p>}
                {day.open.length === 0 && day.assigned.length === 0 && <p className="text-xs text-gray-400">No classes needed; branch is closed.</p>}
              </div>
              <button type="button" onClick={() => openForm(day.value, day.gaps[0])} disabled={day.open.length === 0} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">+ Add class</button>
            </article>
          ))}
        </div>
      )}

      {notice && <p role="status" className="mx-5 mb-4 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 sm:mx-6">{notice}</p>}
      {error && !formDay && <p role="alert" className="mx-5 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">{error}</p>}

    </div>
  )

  const scheduleAction = <button type="button" onClick={() => setWeeklyScheduleOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-200">
    <span aria-hidden="true" className="text-lg leading-none">+</span> Add schedule
  </button>

  const scheduleContent = (
  <div className="space-y-5">
    <ScheduleBoard {...calendarProps} />

    {weeklyScheduleOpen && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) { setWeeklyScheduleOpen(false); resetForm() } }}>
      <div role="dialog" aria-modal="true" aria-labelledby="weekly-schedule-modal-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div><h2 id="weekly-schedule-modal-title" className="text-lg font-semibold text-gray-950">Weekly branch schedule</h2><p className="mt-1 text-sm text-gray-500">Assign available assistant coaches to cover each branch’s operating hours.</p></div>
          <button type="button" aria-label="Close weekly schedule" onClick={() => { setWeeklyScheduleOpen(false); resetForm() }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-950">×</button>
        </div>
        <div className="p-3 sm:p-5">{weeklyBranchSchedulePanel}</div>
      </div>
    </div>}

    {(sessionSync.error || sessionSync.created > 0 || sessionSync.updated > 0 || sessionSync.cancelled > 0 || sessionSync.conflicts.length > 0) && <section className="rounded-xl border border-gray-200 bg-white p-4">
      {sessionSync.error && <p role="alert" className="text-sm text-red-700">{sessionSync.error}</p>}
      {sessionSync.created > 0 && <p className="text-sm text-gray-700">{sessionSync.created} upcoming class session{sessionSync.created === 1 ? '' : 's'} added to the calendar.</p>}
      {sessionSync.updated > 0 && <p className="text-sm text-gray-700">{sessionSync.updated} upcoming session{sessionSync.updated === 1 ? '' : 's'} updated.</p>}
      {sessionSync.cancelled > 0 && <p className="text-sm text-amber-900">{sessionSync.cancelled} future session{sessionSync.cancelled === 1 ? ' was' : 's were'} cancelled because its coach is no longer available. Review the uncovered blocks above.</p>}
      {sessionSync.conflicts.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-900">{sessionSync.conflicts.slice(0, 6).map((item, index) => <li key={`${item.date}-${index}`}>{item.date} · {item.branch} · {item.coach}: {item.reason}</li>)}</ul>}
    </section>}

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div>{absencePanel}</div>
      <div>{availabilityPanel}</div>
    </div>
  </div>
  )

  return <SchedulingPageTabs scheduleContent={scheduleContent} closuresContent={closuresPanel} scheduleAction={scheduleAction} />
}
