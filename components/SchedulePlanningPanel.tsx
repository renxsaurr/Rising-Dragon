'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { formatTimeRange } from '@/utils/dates'
import ScheduleBoard, { type ScheduleBoardProps } from '@/components/ScheduleBoard'
import {
  deleteWeeklyTemplate,
  saveWeeklyTemplate,
} from '@/app/scheduling/actions'

export type WeeklyClassTemplate = {
  id: number
  branch_id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
  branch: { name: string } | null
  coach: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    primary_branch: { name: string } | null
  } | null
}

type CoachOption = {
  id: number
  name: string
  role: string
  primary_branch_id: number | null
  primary_branch_name: string | null
}

type WeeklyAvailabilityWindow = {
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
}

const weekdays = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' }, { value: 7, label: 'Sunday' },
]

function firstName(person: WeeklyClassTemplate['coach']) {
  return person?.first_name?.trim() || 'Coach'
}

function timeValue(time: string) {
  return time.slice(0, 5)
}

function availabilityKey(window: WeeklyAvailabilityWindow) {
  return `${timeValue(window.time_start)}-${timeValue(window.time_end)}`
}

function SelectControl({ value, onChange, children }: { value: string | number; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <div className="relative mt-1">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10">
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function SchedulePlanningPanel({
  templates,
  branches,
  coaches,
  weeklyAvailability,
  sessionSync,
  calendarProps,
  availabilityPanel,
}: {
  templates: WeeklyClassTemplate[]
  branches: { id: number; name: string }[]
  coaches: CoachOption[]
  weeklyAvailability: WeeklyAvailabilityWindow[]
  sessionSync: {
    created: number
    updated: number
    cancelled: number
    conflicts: { date: string; branch: string; coach: string; reason: string }[]
    error?: string
  }
  calendarProps: ScheduleBoardProps
  availabilityPanel: ReactNode
}) {
  const router = useRouter()
  const initialCoach = coaches.find((coach) => coach.primary_branch_id) ?? coaches[0]
  const initialAvailability = weeklyAvailability.filter((window) => window.coach_id === initialCoach?.id && window.weekday === 1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [weekday, setWeekday] = useState(1)
  const [branchId, setBranchId] = useState(initialCoach?.primary_branch_id ?? branches[0]?.id ?? 0)
  const [coachId, setCoachId] = useState(initialCoach?.id ?? 0)
  const [timeStart, setTimeStart] = useState(initialAvailability[0] ? timeValue(initialAvailability[0].time_start) : '')
  const [timeEnd, setTimeEnd] = useState(initialAvailability[0] ? timeValue(initialAvailability[0].time_end) : '')
  const [availabilityKeyValue, setAvailabilityKeyValue] = useState(initialAvailability[0] ? availabilityKey(initialAvailability[0]) : '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [templatePage, setTemplatePage] = useState(1)

  const selectedCoach = coaches.find((coach) => coach.id === Number(coachId))
  const matchingAvailability = weeklyAvailability.filter((window) => window.coach_id === Number(coachId) && window.weekday === weekday)
  const selectedAvailability = matchingAvailability.find((window) => availabilityKey(window) === availabilityKeyValue) ?? matchingAvailability[0]
  const assistantNeedsAvailability = selectedCoach?.role === 'assistant_coach'
  const templatePageSize = 5
  const templatePageCount = Math.max(1, Math.ceil(templates.length / templatePageSize))
  const safeTemplatePage = Math.min(templatePage, templatePageCount)
  const visibleTemplates = templates.slice((safeTemplatePage - 1) * templatePageSize, safeTemplatePage * templatePageSize)
  const selectedTimeIsAvailable = !assistantNeedsAvailability || Boolean(
    selectedAvailability &&
    timeStart >= timeValue(selectedAvailability.time_start) &&
    timeEnd <= timeValue(selectedAvailability.time_end) &&
    timeStart < timeEnd,
  )

  const applyCoachAvailability = (nextCoachId: number, nextWeekday: number) => {
    const coach = coaches.find((item) => item.id === nextCoachId)
    const windows = weeklyAvailability.filter((window) => window.coach_id === nextCoachId && window.weekday === nextWeekday)
    const nextWindow = windows[0]
    setAvailabilityKeyValue(nextWindow ? availabilityKey(nextWindow) : '')
    if (coach?.role === 'assistant_coach') {
      setTimeStart(nextWindow ? timeValue(nextWindow.time_start) : '')
      setTimeEnd(nextWindow ? timeValue(nextWindow.time_end) : '')
    }
  }

  const resetForm = () => {
    const defaultCoach = coaches.find((coach) => coach.primary_branch_id) ?? coaches[0]
    setEditingId(null)
    setShowForm(false)
    setWeekday(1)
    setBranchId(defaultCoach?.primary_branch_id ?? branches[0]?.id ?? 0)
    setCoachId(defaultCoach?.id ?? 0)
    setTimeStart('')
    setTimeEnd('')
    const windows = weeklyAvailability.filter((window) => window.coach_id === (defaultCoach?.id ?? 0) && window.weekday === 1)
    setAvailabilityKeyValue(windows[0] ? availabilityKey(windows[0]) : '')
    if (defaultCoach?.role === 'assistant_coach') {
      setTimeStart(windows[0] ? timeValue(windows[0].time_start) : '')
      setTimeEnd(windows[0] ? timeValue(windows[0].time_end) : '')
    }
  }

  useEffect(() => {
    if (!showForm) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setShowForm(false)
        setEditingId(null)
        setError('')
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showForm, busy])

  const editTemplate = (item: WeeklyClassTemplate) => {
    setEditingId(item.id)
    setShowForm(true)
    setWeekday(item.weekday)
    setBranchId(item.branch_id)
    setCoachId(item.coach_id)
    setTimeStart(item.time_start.slice(0, 5))
    setTimeEnd(item.time_end.slice(0, 5))
    const itemWindow = weeklyAvailability
      .filter((window) => window.coach_id === item.coach_id && window.weekday === item.weekday)
      .find((window) => timeValue(window.time_start) <= item.time_start.slice(0, 5) && timeValue(window.time_end) >= item.time_end.slice(0, 5))
    setAvailabilityKeyValue(itemWindow ? availabilityKey(itemWindow) : '')
    setError('')
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const result = await saveWeeklyTemplate(editingId, {
      weekday,
      branch_id: Number(branchId),
      coach_id: Number(coachId),
      time_start: timeStart,
      time_end: timeEnd,
    })
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setNotice(result.message ?? (editingId ? 'Weekly class updated. Upcoming sessions sync automatically.' : 'Weekly class added. Upcoming sessions sync automatically.'))
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: number) => {
    setBusy(true)
    setError('')
    const result = await deleteWeeklyTemplate(id)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setNotice(result.message ?? 'Weekly class removed. Upcoming sessions were reconciled.')
    if (editingId === id) resetForm()
    router.refresh()
  }

  const inputClass = 'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-medium text-gray-600'

  return (
    <>
      <ScheduleBoard
        {...calendarProps}
      />

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0">{availabilityPanel}</div>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-gray-950">Master weekly schedule</h2>
              <p className="mt-0.5 text-sm text-gray-500">Regular classes across your branches.</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">{templates.length} {templates.length === 1 ? 'class' : 'classes'}</span>
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center">
                <p className="text-sm font-medium text-gray-800">No weekly classes yet</p>
                <p className="mt-1 text-sm text-gray-500">Use “Add Weekly Class” to set the regular schedule.</p>
              </div>
            ) : visibleTemplates.map((item) => {
              const coachBranch = item.coach?.primary_branch?.name
              const assignedElsewhere = coachBranch && coachBranch !== item.branch?.name
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 min-w-12 place-items-center rounded-lg bg-gray-100 px-2 text-[11px] font-semibold text-gray-700">{weekdays[item.weekday - 1]?.label.slice(0, 3)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-950">{formatTimeRange(item.time_start, item.time_end)}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{item.branch?.name ?? 'Branch'} <span aria-hidden="true">·</span> {firstName(item.coach)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {assignedElsewhere && <span className="hidden self-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 sm:inline">Cross-branch</span>}
                    <button onClick={() => editTemplate(item)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50">Edit</button>
                    <button onClick={() => handleDelete(item.id)} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3.5 sm:px-5">
            <div className="flex min-h-9 items-center gap-3 text-xs text-gray-500">
              {templates.length > templatePageSize && <>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setTemplatePage(Math.max(1, safeTemplatePage - 1))} disabled={safeTemplatePage === 1} aria-label="Previous master schedule page" className="grid h-9 w-9 place-items-center rounded-lg bg-black text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">‹</button>
                  <span className="min-w-20 px-2 text-center text-xs font-semibold text-gray-700">Page {safeTemplatePage} of {templatePageCount}</span>
                  <button type="button" onClick={() => setTemplatePage(Math.min(templatePageCount, safeTemplatePage + 1))} disabled={safeTemplatePage === templatePageCount} aria-label="Next master schedule page" className="grid h-9 w-9 place-items-center rounded-lg bg-black text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">›</button>
                </div>
              </>}
            </div>
            <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800">+ Add Weekly Class</button>
          </div>
        </section>
      </div>

      {(notice || error || sessionSync.error || sessionSync.created > 0 || sessionSync.updated > 0 || sessionSync.cancelled > 0 || sessionSync.conflicts.length > 0) && (
        <div className="mt-4 space-y-2">
          {notice && <p role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{notice}</p>}
          {(error || sessionSync.error) && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error || sessionSync.error}</p>}
          {sessionSync.created > 0 && <p role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{sessionSync.created} upcoming class session{sessionSync.created === 1 ? '' : 's'} added to the calendar automatically.</p>}
          {sessionSync.updated > 0 && <p role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{sessionSync.updated} upcoming class session{sessionSync.updated === 1 ? '' : 's'} updated to match the master schedule.</p>}
          {sessionSync.cancelled > 0 && <p role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{sessionSync.cancelled} upcoming class session{sessionSync.cancelled === 1 ? ' was' : 's were'} cancelled because the class plan or coach availability changed. Review the conflicts below.</p>}
          {sessionSync.conflicts.length > 0 && (
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{sessionSync.conflicts.length} class{sessionSync.conflicts.length === 1 ? '' : 'es'} could not be added because of conflicts</p>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-700">
                {sessionSync.conflicts.slice(0, 8).map((item, index) => <li key={`${item.date}-${index}`}><strong>{item.date} · {item.branch}</strong> — {item.coach}: {item.reason}</li>)}
                {sessionSync.conflicts.length > 8 && <li>And {sessionSync.conflicts.length - 8} more.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) resetForm() }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="weekly-class-modal-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSave} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="weekly-class-modal-title" className="text-lg font-semibold text-gray-950">{editingId ? 'Edit weekly class' : 'Add weekly class'}</h2>
                  <p className="mt-1 text-sm text-gray-500">Choose its day, branch, coach, and class time.</p>
                </div>
                <button type="button" onClick={resetForm} disabled={busy} aria-label="Close modal" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-gray-500 hover:bg-gray-100 hover:text-black disabled:opacity-50">×</button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={labelClass}>Day<SelectControl value={weekday} onChange={(value) => {
                  const nextWeekday = Number(value)
                  setWeekday(nextWeekday)
                  applyCoachAvailability(Number(coachId), nextWeekday)
                }}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</SelectControl></label>
                <label className={labelClass}>Branch<SelectControl value={branchId} onChange={(value) => setBranchId(Number(value))}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectControl></label>
                <label className={labelClass}>Coach<SelectControl value={coachId} onChange={(value) => {
                  const coach = coaches.find((item) => item.id === Number(value))
                  const nextCoachId = Number(value)
                  setCoachId(nextCoachId)
                  if (coach?.primary_branch_id) setBranchId(coach.primary_branch_id)
                  applyCoachAvailability(nextCoachId, weekday)
                }}>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</SelectControl></label>
                <label className={labelClass}>Starts<input type="time" required value={timeStart} min={assistantNeedsAvailability ? timeValue(selectedAvailability?.time_start ?? '') : undefined} max={assistantNeedsAvailability ? timeValue(selectedAvailability?.time_end ?? '') : undefined} onChange={(event) => setTimeStart(event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Ends<input type="time" required value={timeEnd} min={assistantNeedsAvailability ? timeValue(selectedAvailability?.time_start ?? '') : undefined} max={assistantNeedsAvailability ? timeValue(selectedAvailability?.time_end ?? '') : undefined} onChange={(event) => setTimeEnd(event.target.value)} className={inputClass} /></label>
              </div>
              {assistantNeedsAvailability && matchingAvailability.length > 1 && (
                <div className="mt-4 max-w-sm">
                  <label className={labelClass}>Available time window<SelectControl value={availabilityKeyValue} onChange={(value) => {
                    const window = matchingAvailability.find((item) => availabilityKey(item) === value)
                    setAvailabilityKeyValue(value)
                    if (window) {
                      setTimeStart(timeValue(window.time_start))
                      setTimeEnd(timeValue(window.time_end))
                    }
                  }}>{matchingAvailability.map((window) => <option key={availabilityKey(window)} value={availabilityKey(window)}>{formatTimeRange(window.time_start, window.time_end)}</option>)}</SelectControl></label>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-500">
                {assistantNeedsAvailability
                  ? matchingAvailability.length === 0
                    ? `No weekly availability is set for this coach on ${weekdays[weekday - 1]?.label}. Set their availability first.`
                    : 'Times follow this coach’s weekly availability. You can shorten the class within that window.'
                  : 'The branch defaults to the coach’s primary branch. You can choose another branch for cross-branch coverage.'}
              </p>
              {assistantNeedsAvailability && !selectedTimeIsAvailable && (
                <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {matchingAvailability.length === 0
                    ? `This class cannot be added because ${selectedCoach?.name ?? 'the selected coach'} has no weekly availability for ${weekdays[weekday - 1]?.label}.`
                    : selectedAvailability
                      ? `The class must fit within ${formatTimeRange(selectedAvailability.time_start, selectedAvailability.time_end)} and end after it starts.`
                      : 'Choose an available time window for this coach.'}
                </p>
              )}
              {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={resetForm} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button disabled={busy || !branches.length || !coaches.length || !timeStart || !timeEnd || !selectedTimeIsAvailable} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save class' : 'Add class'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
