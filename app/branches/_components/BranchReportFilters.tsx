'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PRESETS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'custom', label: 'Custom' },
]

const chipClass = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`

// only updates the URL — the page reads it and loads the report on the server
export default function BranchReportFilters({ range, start, end, branches, selectedIds }: {
  range: string
  start: string
  end: string
  branches: { id: number; name: string }[]
  selectedIds: number[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(range === 'custom')
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(end)

  const go = (next: { range?: string; from?: string; to?: string; branchIds?: number[] }) => {
    // start from the current URL so the table sort survives filter changes
    const params = new URLSearchParams(searchParams.toString())
    const nextRange = next.range ?? range
    params.set('view', 'reports')
    params.set('range', nextRange)
    if (nextRange === 'custom') {
      params.set('from', next.from ?? start)
      params.set('to', next.to ?? end)
    } else {
      params.delete('from')
      params.delete('to')
    }
    const ids = next.branchIds ?? selectedIds
    if (ids.length) params.set('branches', ids.join(','))
    else params.delete('branches')
    startTransition(() => router.push(`/branches?${params.toString().replace(/%2C/g, ',')}`, { scroll: false }))
  }

  const toggleBranch = (id: number) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id]
    // picking every branch is the same as "All branches"
    go({ branchIds: next.length === branches.length ? [] : next })
  }

  const customInvalid = !from || !to || from > to

  return (
    // full-width strip that sticks to the top of the scrolling <main>; border + shadow so rows clearly slide under it.
    // -mx-8 px-8 cancels <main>'s px-8 (same at every breakpoint in DashboardShell) — keep them in sync.
    <div className="z-20 -mx-8 border-b border-gray-200 bg-white px-8 py-2.5 shadow-[0_6px_12px_-10px_rgba(16,24,40,0.3)] md:sticky md:top-0 print:hidden">
      <section aria-label="Report filters" aria-busy={isPending} className={`flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
        <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="Date range">
          {PRESETS.map((preset) => {
            const active = showCustom ? preset.value === 'custom' : range === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (preset.value === 'custom') return setShowCustom(true)
                  setShowCustom(false)
                  go({ range: preset.value })
                }}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium ${active ? 'bg-black text-white' : 'text-gray-600 hover:bg-white'}`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Branches">
          <button type="button" aria-pressed={selectedIds.length === 0} onClick={() => go({ branchIds: [] })} className={chipClass(selectedIds.length === 0)}>
            All branches
          </button>
          {branches.map((branch) => (
            <button key={branch.id} type="button" aria-pressed={selectedIds.includes(branch.id)} onClick={() => toggleBranch(branch.id)} className={chipClass(selectedIds.includes(branch.id))}>
              {branch.name}
            </button>
          ))}
        </div>

        {showCustom && (
          <form
            className="flex w-full flex-wrap items-center gap-2 text-xs font-medium text-gray-500"
            onSubmit={(event) => {
              event.preventDefault()
              if (!customInvalid) go({ range: 'custom', from, to })
            }}
          >
            <label className="flex items-center gap-1.5">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700" />
            </label>
            <label className="flex items-center gap-1.5">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700" />
            </label>
            <button type="submit" disabled={customInvalid || isPending} className="h-8 rounded-lg bg-black px-3.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40">
              Apply
            </button>
            {from && to && from > to && <p className="w-full text-xs text-red-600">The start date must be on or before the end date.</p>}
          </form>
        )}
      </section>
    </div>
  )
}
