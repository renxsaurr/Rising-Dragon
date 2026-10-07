'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, Filter } from 'lucide-react'
import type { ReportRange } from '@/utils/branch-reports'

const inputClass = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-black focus:ring-2 focus:ring-black/10'

export default function BranchReportFilters({ range, start, end, branches, selectedIds }: {
  range: ReportRange
  start: string
  end: string
  branches: { id: number; name: string }[]
  selectedIds: number[]
}) {
  const router = useRouter()
  const [selectedRange, setSelectedRange] = useState(range)
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(end)
  const [selectedBranches, setSelectedBranches] = useState(selectedIds)
  const [busy, startTransition] = useTransition()
  const allIds = branches.map((branch) => branch.id)
  const isAllBranches = selectedBranches.length === 0 || selectedBranches.length === allIds.length
  const branchLabel = isAllBranches ? 'All branches' : `${selectedBranches.length} selected`
  const invalidCustomRange = selectedRange === 'custom' && (!from || !to || from > to)

  function toggleBranch(id: number) {
    setSelectedBranches((current) => {
      if (current.length === 0 || current.length === allIds.length) return allIds.filter((branchId) => branchId !== id)
      return current.includes(id) ? current.filter((branchId) => branchId !== id) : [...current, id]
    })
  }

  function applyFilters() {
    const query = new URLSearchParams({ view: 'reports', range: selectedRange })
    if (selectedRange === 'custom') {
      query.set('from', from)
      query.set('to', to)
    }
    if (!isAllBranches && selectedBranches.length) query.set('branches', selectedBranches.join(','))
    startTransition(() => router.push(`/branches?${query.toString().replace(/%2C/g, ',')}`))
  }

  return (
    <section aria-labelledby="branch-report-filters-title" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:hidden">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-800" aria-hidden />
        <h2 id="branch-report-filters-title" className="text-sm font-semibold text-gray-950">Report filters</h2>
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1.3fr)_auto]">
        <label className="block text-xs font-medium text-gray-700">Date range
          <span className="relative mt-1 block">
            <select className={`${inputClass} appearance-none pr-9`} value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as ReportRange)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="custom">Custom dates</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-500" aria-hidden />
          </span>
        </label>

        <div className="relative">
          <p className="text-xs font-medium text-gray-700">Branches</p>
          <details className="group relative mt-1">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 hover:border-gray-300 [&::-webkit-details-marker]:hidden">
              <span>{branchLabel}</span><ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute left-0 right-0 top-11 z-30 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <button type="button" onClick={() => setSelectedBranches([])} className="mb-1 w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100">All branches</button>
              {branches.map((branch) => {
                const checked = isAllBranches || selectedBranches.includes(branch.id)
                return <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-50">
                  <input type="checkbox" checked={checked} onChange={() => toggleBranch(branch.id)} className="h-4 w-4 accent-black" />
                  <span>{branch.name}</span>
                </label>
              })}
            </div>
          </details>
        </div>

        <button type="button" onClick={applyFilters} disabled={busy || invalidCustomRange} className="h-10 rounded-lg bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Applying…' : 'Apply filters'}
        </button>
      </div>
      {selectedRange === 'custom' && <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-medium text-gray-700">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${inputClass} mt-1`} /></label>
        {from && to && from > to && <p role="alert" className="text-xs text-red-700 sm:col-span-2">The start date must be on or before the end date.</p>}
      </div>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden />Attendance and class data are shown through today.</p>
    </section>
  )
}
