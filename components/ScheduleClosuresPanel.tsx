'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createScheduleClosure, removeScheduleClosure } from '@/app/scheduling/actions'

export type ScheduleClosureView = {
  id: number
  branch_id: number | null
  starts_on: string
  ends_on: string
  reason: string | null
  branch: { name: string } | null
}

export default function ScheduleClosuresPanel({
  closures: initialClosures,
  branches,
  today,
}: {
  closures: ScheduleClosureView[]
  branches: { id: number; name: string }[]
  today: string
}) {
  const router = useRouter()
  const [closures, setClosures] = useState(initialClosures)
  const [branchId, setBranchId] = useState('')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setClosures(initialClosures), [initialClosures])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const result = await createScheduleClosure({
      branch_id: branchId ? Number(branchId) : null,
      starts_on: startsOn,
      ends_on: endsOn,
      reason,
    })
    setBusy(false)
    if ('error' in result) { setError(result.error); return }
    setNotice(result.message)
    setReason('')
    router.refresh()
  }

  const handleRemove = async (id: number) => {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await removeScheduleClosure(id)
    setBusy(false)
    if ('error' in result) { setError(result.error); return }
    setNotice(result.message)
    setClosures((current) => current.filter((closure) => closure.id !== id))
    router.refresh()
  }

  const inputClass = 'mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200'
  const selectClass = 'h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-12 text-base font-medium text-gray-950 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200'
  const labelClass = 'block text-sm font-medium text-gray-700'

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-950">No-class dates</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">Mark a branch or the whole club closed for a holiday or special date. Scheduled classes in that range will be cancelled.</p>
      </div>
      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form onSubmit={handleCreate} className="space-y-5">
          <label className={labelClass}>Applies to
            <span className="relative mt-1.5 block">
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className={selectClass}>
                <option value="">All branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>From<input type="date" required min={today} value={startsOn} onChange={(event) => {
              setStartsOn(event.target.value)
              if (event.target.value > endsOn) setEndsOn(event.target.value)
            }} className={inputClass} /></label>
            <label className={labelClass}>Through<input type="date" required min={startsOn || today} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={inputClass} /></label>
          </div>
          <label className={labelClass}>Note <span className="font-normal text-gray-500">(optional)</span>
            <input type="text" maxLength={120} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Holiday, maintenance…" className={inputClass} />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={busy || !branches.length || !startsOn || !endsOn || startsOn > endsOn} className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50">{busy ? 'Saving…' : 'Mark no classes'}</button>
        </form>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Upcoming closures</h3>
          {closures.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No closures scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {closures.map((closure) => (
                <li key={closure.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{closure.starts_on === closure.ends_on ? closure.starts_on : `${closure.starts_on} – ${closure.ends_on}`}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{closure.branch?.name ?? 'All branches'}{closure.reason ? ` · ${closure.reason}` : ''}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => handleRemove(closure.id)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Remove closure</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {notice && <p role="status" className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-sm text-gray-800">{notice}</p>}
    </section>
  )
}
