'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { removeAvailability, removeWeeklyAvailability, saveAvailability, saveWeeklyAvailability } from '@/app/scheduling/actions'

export type AvailabilityEntry = {
  id: number
  coach_id: number
  date: string
  time_start: string
  time_end: string
  status: 'Available' | 'Unavailable'
  coach: { name: string } | null
}

export type WeeklyAvailabilityEntry = {
  id: number
  coach_id: number
  weekday: number
  time_start: string
  time_end: string
  coach: { name: string } | null
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function AvailabilityPanel({
  entries,
  weeklyEntries,
  isAssistantCoach,
}: {
  entries: AvailabilityEntry[]
  weeklyEntries: WeeklyAvailabilityEntry[]
  isAssistantCoach: boolean
}) {
  const router = useRouter()
  const [weekday, setWeekday] = useState('1')
  const [weeklyStart, setWeeklyStart] = useState('')
  const [weeklyEnd, setWeeklyEnd] = useState('')
  const [editingWeeklyId, setEditingWeeklyId] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [status, setStatus] = useState<'Available' | 'Unavailable'>('Unavailable')
  const [showExceptionForm, setShowExceptionForm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleWeeklySubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveWeeklyAvailability(editingWeeklyId, {
      weekday: Number(weekday), time_start: weeklyStart, time_end: weeklyEnd,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditingWeeklyId(null)
    setWeekday('1')
    setWeeklyStart('')
    setWeeklyEnd('')
    router.refresh()
  }

  const handleExceptionSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveAvailability({ date, time_start: timeStart, time_end: timeEnd, status })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setDate('')
    setTimeStart('')
    setTimeEnd('')
    setShowExceptionForm(false)
    router.refresh()
  }

  const removeWeekly = async (id: number) => {
    setError('')
    const result = await removeWeeklyAvailability(id)
    if (result.error) { setError(result.error); return }
    if (editingWeeklyId === id) {
      setEditingWeeklyId(null)
      setWeekday('1')
      setWeeklyStart('')
      setWeeklyEnd('')
    }
    router.refresh()
  }

  const editWeekly = (entry: WeeklyAvailabilityEntry) => {
    setEditingWeeklyId(entry.id)
    setWeekday(String(entry.weekday))
    setWeeklyStart(entry.time_start.slice(0, 5))
    setWeeklyEnd(entry.time_end.slice(0, 5))
    setError('')
  }

  const cancelWeeklyEdit = () => {
    setEditingWeeklyId(null)
    setWeekday('1')
    setWeeklyStart('')
    setWeeklyEnd('')
    setError('')
  }

  const removeException = async (id: number) => {
    setError('')
    const result = await removeAvailability(id)
    if (result.error) { setError(result.error); return }
    router.refresh()
  }

  const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900'
  const selectClass = 'block h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-medium text-gray-600'

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Coach availability</h2>
          <p className="mt-1 text-sm text-gray-500">Assistant Coaches set their usual weekly availability once and add exceptions only when a date differs.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{weeklyEntries.length} weekly blocks</span>
      </div>

      {isAssistantCoach && (
        <form onSubmit={handleWeeklySubmit} className="border-b border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">{editingWeeklyId ? 'Edit weekly availability' : 'Usual weekly availability'}</h3>
          <p className="mt-1 text-xs text-gray-500">Each time block repeats every week until you change or remove it.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label className={labelClass}>Weekday<div className="relative mt-1"><select value={weekday} onChange={(event) => setWeekday(event.target.value)} className={selectClass}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select><svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div></label>
            <label className={labelClass}>From<input type="time" value={weeklyStart} onChange={(event) => setWeeklyStart(event.target.value)} required className={inputClass} /></label>
            <label className={labelClass}>Until<input type="time" value={weeklyEnd} onChange={(event) => setWeeklyEnd(event.target.value)} required className={inputClass} /></label>
            <div className="flex items-end gap-2">
              <button disabled={saving} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving…' : editingWeeklyId ? 'Save changes' : 'Add time'}</button>
              {editingWeeklyId && <button type="button" onClick={cancelWeeklyEdit} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700">Cancel</button>}
            </div>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
        <div>
          <div className="flex h-9 items-center"><h3 className="text-sm font-semibold text-gray-900">Weekly pattern</h3></div>
          {weeklyEntries.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No weekly availability submitted yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {weeklyEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    {!isAssistantCoach && <p className="text-xs font-medium text-gray-500">{entry.coach?.name ?? 'Coach'}</p>}
                    <p className="text-sm font-medium text-gray-900">{weekdays[entry.weekday - 1]} · {entry.time_start.slice(0, 5)}–{entry.time_end.slice(0, 5)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Repeats every week</p>
                  </div>
                  {isAssistantCoach && <div className="flex shrink-0 gap-2">
                    <button onClick={() => editWeekly(entry)} className="text-xs font-medium text-gray-600 hover:text-black">Edit</button>
                    <button onClick={() => removeWeekly(entry.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex h-9 items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Date-specific exceptions</h3>
            {isAssistantCoach && <button onClick={() => setShowExceptionForm((shown) => !shown)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">{showExceptionForm ? 'Close' : 'Add exception'}</button>}
          </div>

          {isAssistantCoach && showExceptionForm && (
            <form onSubmit={handleExceptionSubmit} className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
              <label className={`${labelClass} col-span-2 sm:col-span-1`}>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className={inputClass} /></label>
              <label className={labelClass}>From<input type="time" value={timeStart} onChange={(event) => setTimeStart(event.target.value)} required className={inputClass} /></label>
              <label className={labelClass}>Until<input type="time" value={timeEnd} onChange={(event) => setTimeEnd(event.target.value)} required className={inputClass} /></label>
              <label className={`${labelClass} col-span-2 sm:col-span-1`}>Exception<div className="relative mt-1"><select value={status} onChange={(event) => setStatus(event.target.value as 'Available' | 'Unavailable')} className={selectClass}><option value="Unavailable">Unavailable</option><option value="Available">Extra availability</option></select><svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div></label>
              <button disabled={saving} className="self-end rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save exception'}</button>
              {error && <p role="alert" className="col-span-full text-sm text-red-600">{error}</p>}
            </form>
          )}

          {entries.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No date-specific exceptions in this calendar period.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    {!isAssistantCoach && <p className="text-xs font-medium text-gray-500">{entry.coach?.name ?? 'Coach'}</p>}
                    <p className="text-sm font-medium text-gray-900">{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {entry.time_start.slice(0, 5)}–{entry.time_end.slice(0, 5)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.status === 'Available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{entry.status}</span>
                    {isAssistantCoach && <button onClick={() => removeException(entry.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
