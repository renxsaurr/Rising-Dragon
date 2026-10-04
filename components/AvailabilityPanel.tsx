'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function AvailabilityPanel({
  weeklyEntries,
  isAssistantCoach,
}: {
  weeklyEntries: WeeklyAvailabilityEntry[]
  isAssistantCoach: boolean
}) {
  const router = useRouter()
  const [weekday, setWeekday] = useState('1')
  const [weeklyStart, setWeeklyStart] = useState('')
  const [weeklyEnd, setWeeklyEnd] = useState('')
  const [editingWeeklyId, setEditingWeeklyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const clearForm = () => {
    setEditingWeeklyId(null)
    setWeekday('1')
    setWeeklyStart('')
    setWeeklyEnd('')
    setError('')
  }

  const handleWeeklySubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveWeeklyAvailability(editingWeeklyId, {
      weekday: Number(weekday), time_start: weeklyStart, time_end: weeklyEnd,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    clearForm()
    router.refresh()
  }

  const removeWeekly = async (id: number) => {
    setError('')
    const result = await removeWeeklyAvailability(id)
    if (result.error) { setError(result.error); return }
    if (editingWeeklyId === id) clearForm()
    router.refresh()
  }

  const editWeekly = (entry: WeeklyAvailabilityEntry) => {
    setEditingWeeklyId(entry.id)
    setWeekday(String(entry.weekday))
    setWeeklyStart(entry.time_start.slice(0, 5))
    setWeeklyEnd(entry.time_end.slice(0, 5))
    setError('')
  }

  const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900'
  const selectClass = 'block h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-medium text-gray-600'

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Coach availability</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{weeklyEntries.length} weekly blocks</span>
      </div>

      {isAssistantCoach && (
        <form onSubmit={handleWeeklySubmit} className="border-b border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">{editingWeeklyId ? 'Edit weekly availability' : 'Set your weekly availability'}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label className={labelClass}>Weekday<div className="relative mt-1"><select value={weekday} onChange={(event) => setWeekday(event.target.value)} className={selectClass}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select><svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div></label>
            <label className={labelClass}>From<input type="time" value={weeklyStart} onChange={(event) => setWeeklyStart(event.target.value)} required className={inputClass} /></label>
            <label className={labelClass}>Until<input type="time" value={weeklyEnd} onChange={(event) => setWeeklyEnd(event.target.value)} required className={inputClass} /></label>
            <div className="flex items-end gap-2">
              <button disabled={saving} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving…' : editingWeeklyId ? 'Save changes' : 'Add time'}</button>
              {editingWeeklyId && <button type="button" onClick={clearForm} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700">Cancel</button>}
            </div>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900">Weekly availability</h3>
        {weeklyEntries.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No weekly availability submitted yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {weeklyEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  {!isAssistantCoach && <p className="text-xs font-medium text-gray-500">{entry.coach?.name ?? 'Coach'}</p>}
                  <p className="text-sm font-medium text-gray-900">{weekdays[entry.weekday - 1]} · {formatTimeRange(entry.time_start, entry.time_end)}</p>
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
        {error && !isAssistantCoach && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  )
}
