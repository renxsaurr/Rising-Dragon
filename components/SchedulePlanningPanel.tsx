'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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
}: {
  templates: WeeklyClassTemplate[]
  branches: { id: number; name: string }[]
  coaches: CoachOption[]
  weeklyAvailability: WeeklyAvailabilityWindow[]
  sessionSync: {
    created: number
    conflicts: { date: string; branch: string; coach: string; reason: string }[]
    error?: string
  }
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

  const selectedCoach = coaches.find((coach) => coach.id === Number(coachId))
  const matchingAvailability = weeklyAvailability.filter((window) => window.coach_id === Number(coachId) && window.weekday === weekday)
  const selectedAvailability = matchingAvailability.find((window) => availabilityKey(window) === availabilityKeyValue) ?? matchingAvailability[0]
  const assistantNeedsAvailability = selectedCoach?.role === 'assistant_coach'
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
    setNotice(editingId ? 'Weekly class updated. Upcoming sessions sync automatically.' : 'Weekly class added. Upcoming sessions sync automatically.')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: number) => {
    setBusy(true)
    setError('')
    const result = await deleteWeeklyTemplate(id)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setNotice('Weekly class removed. Already created sessions are preserved.')
    if (editingId === id) resetForm()
    router.refresh()
  }

  const inputClass = 'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-medium text-gray-600'

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Master weekly schedule</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Set each regular class once. The pattern continues until you change or remove it.</p>
        </div>
        {!showForm && <button onClick={() => { setError(''); setShowForm(true) }} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">+ Add weekly class</button>}
      </div>

      <div className="mt-4">
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No classes in the master schedule yet. Add the branch’s regular weekly classes here.</div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {templates.map((item) => {
              const coachBranch = item.coach?.primary_branch?.name
              const assignedElsewhere = coachBranch && coachBranch !== item.branch?.name
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 min-w-[82px] rounded-md bg-gray-100 px-2 py-1 text-center text-xs font-semibold text-gray-800">{weekdays[item.weekday - 1]?.label}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-950">{item.time_start.slice(0, 5)}–{item.time_end.slice(0, 5)} <span className="font-normal text-gray-500">· {item.branch?.name ?? 'Branch'}</span></p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{firstName(item.coach)}{coachBranch ? ` · Primary branch: ${coachBranch}` : ''}{assignedElsewhere ? ' · cross-branch assignment' : ''}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => editTemplate(item)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50">Edit</button>
                    <button onClick={() => handleDelete(item.id)} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-black hover:text-black disabled:opacity-50">Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mt-4 rounded-xl bg-gray-50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit weekly class' : 'Add weekly class'}</h3>
            <button type="button" onClick={resetForm} disabled={busy} aria-label="Close form" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-white hover:text-black">×</button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
            <div className="mt-3 max-w-sm">
              <label className={labelClass}>Available time window<SelectControl value={availabilityKeyValue} onChange={(value) => {
                const window = matchingAvailability.find((item) => availabilityKey(item) === value)
                setAvailabilityKeyValue(value)
                if (window) {
                  setTimeStart(timeValue(window.time_start))
                  setTimeEnd(timeValue(window.time_end))
                }
              }}>{matchingAvailability.map((window) => <option key={availabilityKey(window)} value={availabilityKey(window)}>{timeValue(window.time_start)}–{timeValue(window.time_end)}</option>)}</SelectControl></label>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {assistantNeedsAvailability
              ? matchingAvailability.length === 0
                ? `No weekly availability is set for this coach on ${weekdays[weekday - 1]?.label}. Set their availability first.`
                : 'Times are filled from this coach’s weekly availability. You can shorten the class within the available window.'
              : 'The branch defaults to the coach’s primary branch. You can choose another branch for planned cross-branch coverage.'}
          </p>
          {assistantNeedsAvailability && !selectedTimeIsAvailable && (
            <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {matchingAvailability.length === 0
                ? `This class cannot be added because ${selectedCoach?.name ?? 'the selected coach'} has no weekly availability for ${weekdays[weekday - 1]?.label}.`
                : `This class cannot be added because its time must fit within ${timeValue(selectedAvailability?.time_start ?? '')}–${timeValue(selectedAvailability?.time_end ?? '')} availability and end after it starts.`}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy || !branches.length || !coaches.length || !timeStart || !timeEnd || !selectedTimeIsAvailable} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save class' : 'Add to master schedule'}</button>
            <button type="button" onClick={resetForm} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white">Cancel</button>
          </div>
        </form>
      )}

      <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">Dated class sessions are added to the calendar automatically. Coaches can record attendance for scheduled sessions.</p>

      {notice && <p role="status" className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{notice}</p>}
      {(error || sessionSync.error) && <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error || sessionSync.error}</p>}
      {sessionSync.created > 0 && <p role="status" className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">{sessionSync.created} upcoming class session{sessionSync.created === 1 ? '' : 's'} added to the calendar automatically.</p>}
      {sessionSync.conflicts.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-900">{sessionSync.conflicts.length} class{sessionSync.conflicts.length === 1 ? '' : 'es'} could not be added because of conflicts</p>
          <ul className="mt-2 space-y-1.5 text-xs text-gray-700">
            {sessionSync.conflicts.slice(0, 8).map((item, index) => <li key={`${item.date}-${index}`}><strong>{item.date} · {item.branch}</strong> — {item.coach}: {item.reason}</li>)}
            {sessionSync.conflicts.length > 8 && <li>And {sessionSync.conflicts.length - 8} more.</li>}
          </ul>
        </div>
      )}
    </section>
  )
}
