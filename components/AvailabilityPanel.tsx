'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, X } from 'lucide-react'
import { removeWeeklyAvailability, saveWeeklyAvailability } from '@/app/scheduling/actions'
import { formatTimeRange } from '@/utils/dates'

export type WeeklyAvailabilityEntry = {
  id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
  coach: { name: string } | null
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900'
const selectClass = 'block h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
const labelClass = 'text-xs font-medium text-gray-600'

type AssistantCoach = { id: number; name: string }

function CoachAvailabilityModal({
  coach,
  entries,
  onClose,
}: {
  coach: AssistantCoach
  entries: WeeklyAvailabilityEntry[]
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-availability-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <h3 id="coach-availability-title" className="text-lg font-semibold text-gray-950">
              {coach.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600">Weekly availability</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close coach availability"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(85vh-88px)] overflow-y-auto p-5">
          {entries.length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">
                    {weekdays[entry.weekday - 1] ?? 'Weekday'}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatTimeRange(entry.time_start, entry.time_end)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-600">
              No weekly availability has been submitted yet.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function WeeklyAvailabilityModal({
  entry,
  onClose,
}: {
  entry: Pick<WeeklyAvailabilityEntry, 'id' | 'weekday' | 'time_start' | 'time_end'> | null
  onClose: (message?: string) => void
}) {
  const router = useRouter()
  const [weekday, setWeekday] = useState(String(entry?.weekday ?? 1))
  const [weeklyStart, setWeeklyStart] = useState(entry?.time_start.slice(0, 5) ?? '')
  const [weeklyEnd, setWeeklyEnd] = useState(entry?.time_end.slice(0, 5) ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editing = entry !== null

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveWeeklyAvailability(entry?.id ?? null, {
      weekday: Number(weekday),
      time_start: weeklyStart,
      time_end: weeklyEnd,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
    onClose(result.message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="availability-modal-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="availability-modal-title" className="text-lg font-semibold text-gray-950">{editing ? 'Edit availability' : 'Add availability'}</h3>
            <p className="mt-1 text-sm text-gray-600">Set the times you are available on this day each week.</p>
          </div>
          <button type="button" onClick={() => onClose()} disabled={saving} aria-label="Close availability form" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>Weekday<div className="relative mt-1"><select value={weekday} onChange={(event) => setWeekday(event.target.value)} className={selectClass}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select><svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div></label>
            <label className={labelClass}>From<input type="time" value={weeklyStart} onChange={(event) => setWeeklyStart(event.target.value)} required className={inputClass} /></label>
            <label className={labelClass}>Until<input type="time" value={weeklyEnd} onChange={(event) => setWeeklyEnd(event.target.value)} required className={inputClass} /></label>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => onClose()} disabled={saving} className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button disabled={saving} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add availability'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function AddAvailabilityButton() {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const close = (message?: string) => {
    setOpen(false)
    setNotice(message ?? '')
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={() => { setNotice(''); setOpen(true) }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
        <span aria-hidden="true" className="text-lg leading-none">+</span>
        Add availability
      </button>
      {notice && <p role="status" className="max-w-md text-right text-xs text-gray-600">{notice}</p>}
      {open && <WeeklyAvailabilityModal key="new-availability" entry={null} onClose={close} />}
    </div>
  )
}

export default function AvailabilityPanel({
  weeklyEntries,
  isAssistantCoach,
  assistantCoaches = [],
}: {
  weeklyEntries: WeeklyAvailabilityEntry[]
  isAssistantCoach: boolean
  assistantCoaches?: AssistantCoach[]
}) {
  const router = useRouter()
  const [editingEntry, setEditingEntry] = useState<WeeklyAvailabilityEntry | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewingCoach, setViewingCoach] = useState<AssistantCoach | null>(null)

  const removeWeekly = async (id: number) => {
    setError('')
    setNotice('')
    const result = await removeWeeklyAvailability(id)
    if (result.error) { setError(result.error); return }
    if (result.message) setNotice(result.message)
    router.refresh()
  }

  return (
    <section className="flex h-[420px] min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.87a4 4 0 0 1 0 7.75" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h2 className="text-base font-semibold text-gray-950">Coach availability</h2>
        </div>
        {!isAssistantCoach && <span className="min-w-9 rounded-lg bg-gray-100 px-2.5 py-1 text-center text-xs font-semibold text-gray-700">{assistantCoaches.length}</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {isAssistantCoach ? weeklyEntries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm font-medium text-gray-900">No daily availability submitted yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {weeklyEntries.map((entry) => (
              <div key={entry.id} className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{weekdays[entry.weekday - 1]} · {formatTimeRange(entry.time_start, entry.time_end)}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setEditingEntry(entry)} className="text-xs font-medium text-gray-600 hover:text-black">Edit</button>
                  <button type="button" onClick={() => removeWeekly(entry.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : assistantCoaches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm font-medium text-gray-700">No assistant coaches found.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {assistantCoaches.map((coach) => (
              <button
                key={coach.id}
                type="button"
                onClick={() => setViewingCoach(coach)}
                className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-950">{coach.name}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">View weekly availability</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-gray-500" />
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">{notice}</p>}
      </div>

      {editingEntry && isAssistantCoach && (
        <WeeklyAvailabilityModal key={editingEntry.id} entry={editingEntry} onClose={(message) => { setEditingEntry(null); setNotice(message ?? '') }} />
      )}
      {viewingCoach && !isAssistantCoach && (
        <CoachAvailabilityModal
          coach={viewingCoach}
          entries={weeklyEntries
            .filter((entry) => entry.coach_id === viewingCoach.id)
            .sort((a, b) => a.weekday - b.weekday || a.time_start.localeCompare(b.time_start))}
          onClose={() => setViewingCoach(null)}
        />
      )}
    </section>
  )
}
