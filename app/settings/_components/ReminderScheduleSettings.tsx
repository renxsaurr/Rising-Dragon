'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateReminderSchedule } from '@/app/payments/actions'

const INPUT = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none focus:border-gray-500 focus-visible:ring-2 focus-visible:ring-black/10'
const LABEL = 'mb-1.5 block text-[13px] font-medium text-gray-800'

export default function ReminderScheduleSettings({
  beforeDueDays,
  afterDueDays,
}: {
  beforeDueDays: number
  afterDueDays: number
}) {
  const router = useRouter()
  const [before, setBefore] = useState(String(beforeDueDays))
  const [after, setAfter] = useState(String(afterDueDays))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const beforeDueDays = Number(before)
    const afterDueDays = Number(after)
    if (!Number.isInteger(beforeDueDays) || !Number.isInteger(afterDueDays) || beforeDueDays < 1 || beforeDueDays > 30 || afterDueDays < 1 || afterDueDays > 30) {
      setError('Choose a whole number of days from 1 to 30.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateReminderSchedule({ beforeDueDays, afterDueDays })
      if ('error' in result) setError(result.error)
      else {
        setNotice(`Reminder schedule saved: ${beforeDueDays} day${beforeDueDays === 1 ? '' : 's'} before and ${afterDueDays} day${afterDueDays === 1 ? '' : 's'} after the due date.`)
        router.refresh()
      }
    } catch {
      setError('Could not save the reminder schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="reminder-before-days" className={LABEL}>Before due date</label>
          <div className="relative">
            <input id="reminder-before-days" type="number" min={1} max={30} step={1} value={before} onChange={(event) => setBefore(event.target.value)} required disabled={saving} className={`${INPUT} pr-14`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">days</span>
          </div>
        </div>
        <div>
          <label htmlFor="reminder-after-days" className={LABEL}>After due date</label>
          <div className="relative">
            <input id="reminder-after-days" type="number" min={1} max={30} step={1} value={after} onChange={(event) => setAfter(event.target.value)} required disabled={saving} className={`${INPUT} pr-14`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">days</span>
          </div>
        </div>
      </div>
      <p className="text-[13px] text-gray-700">One reminder can be sent before the due date, on the due date, and after it. The Head Coach can still send each reminder manually during its window.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-600">Choose between 1 and 30 days for each interval.</p>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Saving…' : 'Save reminder schedule'}
        </button>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </form>
  )
}
