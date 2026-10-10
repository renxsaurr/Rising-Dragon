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
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [availabilityPage, setAvailabilityPage] = useState(1)
  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(weeklyEntries.length / pageSize))
  const safePage = Math.min(availabilityPage, pageCount)
  const visibleEntries = isAssistantCoach
    ? weeklyEntries
    : weeklyEntries.slice((safePage - 1) * pageSize, safePage * pageSize)

  const clearForm = () => {
    setEditingWeeklyId(null)
    setWeekday('1')
    setWeeklyStart('')
    setWeeklyEnd('')
    setError('')
    setNotice('')
  }

  const handleWeeklySubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const result = await saveWeeklyAvailability(editingWeeklyId, {
      weekday: Number(weekday), time_start: weeklyStart, time_end: weeklyEnd,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    clearForm()
    if (result.message) setNotice(result.message)
    router.refresh()
  }

  const removeWeekly = async (id: number) => {
    setError('')
    setNotice('')
    const result = await removeWeeklyAvailability(id)
    if (result.error) { setError(result.error); return }
    if (editingWeeklyId === id) clearForm()
    if (result.message) setNotice(result.message)
    router.refresh()
  }

  const editWeekly = (entry: WeeklyAvailabilityEntry) => {
    setEditingWeeklyId(entry.id)
    setWeekday(String(entry.weekday))
    setWeeklyStart(entry.time_start.slice(0, 5))
    setWeeklyEnd(entry.time_end.slice(0, 5))
    setError('')
    setNotice('')
  }

  const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900'
  const selectClass = 'block h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-medium text-gray-600'

  return (
    <section className={`${isAssistantCoach ? 'mt-6' : ''} rounded-2xl border border-gray-200 bg-white shadow-sm`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.87a4 4 0 0 1 0 7.75" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h2 className="text-base font-semibold text-gray-950">Coach availability</h2>
        </div>
        <span className="min-w-9 rounded-lg bg-gray-100 px-2.5 py-1 text-center text-xs font-semibold text-gray-700">{weeklyEntries.length}</span>
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
          {notice && <p role="status" className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">{notice}</p>}
        </form>
      )}

      <div className={isAssistantCoach ? 'p-4 sm:p-5' : ''}>
        {isAssistantCoach && <h3 className="text-sm font-semibold text-gray-900">Weekly availability</h3>}
        {weeklyEntries.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm font-medium text-gray-900">No weekly availability submitted yet.</p>
        ) : (
          <div className={`divide-y divide-gray-100 ${isAssistantCoach ? 'mt-3 rounded-xl border border-gray-200' : ''}`}>
            {visibleEntries.map((entry) => (
              <div key={entry.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${isAssistantCoach ? 'px-4' : 'min-h-[64px] px-5'}`}>
                {isAssistantCoach
                  ? <p className="text-sm font-medium text-gray-900">{weekdays[entry.weekday - 1]} · {formatTimeRange(entry.time_start, entry.time_end)}</p>
                  : <p className="text-sm font-semibold text-gray-900">{entry.coach?.name ?? 'Coach'}</p>}
                {!isAssistantCoach && <span className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900">{weekdays[entry.weekday - 1]} · {formatTimeRange(entry.time_start, entry.time_end)}</span>}
                {isAssistantCoach && <div className="flex shrink-0 gap-2">
                  <button onClick={() => editWeekly(entry)} className="text-xs font-medium text-gray-600 hover:text-black">Edit</button>
                  <button onClick={() => removeWeekly(entry.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>
                </div>}
              </div>
            ))}
          </div>
        )}
        {!isAssistantCoach && weeklyEntries.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <span className="text-xs font-medium text-gray-800">Page {safePage} of {pageCount}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAvailabilityPage(Math.max(1, safePage - 1))} disabled={safePage === 1} aria-label="Previous coach availability page" className="grid h-9 w-9 place-items-center rounded-lg bg-black text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">‹</button>
              <button type="button" onClick={() => setAvailabilityPage(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount} aria-label="Next coach availability page" className="grid h-9 w-9 place-items-center rounded-lg bg-black text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">›</button>
            </div>
          </div>
        )}
        {error && !isAssistantCoach && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  )
}
