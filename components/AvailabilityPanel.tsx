'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { removeAvailability, saveAvailability } from '@/app/scheduling/actions'

export type AvailabilityEntry = {
  id: number
  coach_id: number
  date: string
  time_start: string
  time_end: string
  status: 'Available' | 'Unavailable'
  coach: { name: string } | null
}

export default function AvailabilityPanel({
  entries,
  isAssistantCoach,
}: {
  entries: AvailabilityEntry[]
  isAssistantCoach: boolean
}) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [status, setStatus] = useState<'Available' | 'Unavailable'>('Available')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveAvailability({ date, time_start: timeStart, time_end: timeEnd, status })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDate('')
    setTimeStart('')
    setTimeEnd('')
    router.refresh()
  }

  const handleRemove = async (id: number) => {
    const result = await removeAvailability(id)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <section className="mt-8 rounded-xl border border-gray-200 bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Coach availability</h2>
          <p className="mt-1 text-sm text-gray-500">Assistant Coaches submit time windows; the Head Coach can review them here.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{entries.length} submission{entries.length === 1 ? '' : 's'}</span>
      </div>

      {isAssistantCoach && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_auto]">
          <label className="text-xs font-medium text-gray-600">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900" /></label>
          <label className="text-xs font-medium text-gray-600">From<input type="time" value={timeStart} onChange={(event) => setTimeStart(event.target.value)} required className="mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900" /></label>
          <label className="text-xs font-medium text-gray-600">Until<input type="time" value={timeEnd} onChange={(event) => setTimeEnd(event.target.value)} required className="mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900" /></label>
          <label className="text-xs font-medium text-gray-600">Status<select value={status} onChange={(event) => setStatus(event.target.value as 'Available' | 'Unavailable')} className="mt-1 block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"><option>Available</option><option>Unavailable</option></select></label>
          <button disabled={saving} className="self-end rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving…' : 'Submit'}</button>
          {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2 lg:col-span-5">{error}</p>}
        </form>
      )}

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">No availability submitted for this calendar period.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{entry.coach?.name ?? 'Coach'}</p>
                <p className="mt-0.5 text-xs text-gray-500">{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {entry.time_start.slice(0, 5)}–{entry.time_end.slice(0, 5)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.status === 'Available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{entry.status}</span>
                {isAssistantCoach && <button onClick={() => handleRemove(entry.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
