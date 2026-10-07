'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FOCUS_RING } from './ModalShell'
import { paymentsHref, type HistoryQuery, type PaymentFilterKey } from './payments-url'

const CONTROL =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-black/10'

/** Search + Status/Type/Branch filters. Every change updates the URL and goes back to page 1. */
export default function HistoryToolbar({
  base,
  current,
  statuses,
  types,
  branches,
}: {
  base: { month: string; branch: string; filter: PaymentFilterKey }
  current: { hq: string; hstatus: string; htype: string; hbranch: string }
  statuses: readonly string[]
  types: readonly string[]
  branches: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(current.hq)
  const searchId = useId()
  const statusId = useId()
  const typeId = useId()
  const branchId = useId()

  const go = (next: Partial<HistoryQuery>) => {
    const history: HistoryQuery = { ...current, ...next, hpage: 1 }
    startTransition(() => router.push(paymentsHref({ ...base, view: 'history', history }), { scroll: false }))
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    go({ hq: search.trim() })
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <form role="search" onSubmit={submitSearch} className="relative min-w-[200px] flex-1">
        <label htmlFor={searchId} className="sr-only">Search by student name</label>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          id={searchId}
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search student name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`${CONTROL} w-full pl-9 pr-9`}
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearch('')
              if (current.hq) go({ hq: '' })
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-black ${FOCUS_RING}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      <label htmlFor={statusId} className="sr-only">Status</label>
      <select id={statusId} defaultValue={current.hstatus} onChange={(event) => go({ hstatus: event.target.value })} className={CONTROL}>
        <option value="all">All status</option>
        {statuses.map((status) => (
          <option key={status} value={status}>{status === 'Scheduled' ? 'Sending' : status}</option>
        ))}
      </select>

      <label htmlFor={typeId} className="sr-only">Reminder type</label>
      <select id={typeId} defaultValue={current.htype} onChange={(event) => go({ htype: event.target.value })} className={CONTROL}>
        <option value="all">All types</option>
        {types.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>

      <label htmlFor={branchId} className="sr-only">Branch</label>
      <select id={branchId} defaultValue={current.hbranch} onChange={(event) => go({ hbranch: event.target.value })} className={CONTROL}>
        <option value="all">All branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
        ))}
      </select>
    </div>
  )
}
