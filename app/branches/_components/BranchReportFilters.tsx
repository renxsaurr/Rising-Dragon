'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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
  const [selectedBranchId, setSelectedBranchId] = useState(selectedIds.length === 1 ? String(selectedIds[0]) : '')
  const [busy, startTransition] = useTransition()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (selectedRange === 'custom' && (!from || !to || from > to)) return

    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ view: 'reports', range: selectedRange })
      if (selectedRange === 'custom') {
        query.set('from', from)
        query.set('to', to)
      }
      if (selectedBranchId) query.set('branches', selectedBranchId)
      startTransition(() => router.replace(`/branches?${query.toString().replace(/%2C/g, ',')}`, { scroll: false }))
    }, 200)

    return () => window.clearTimeout(timer)
  }, [from, router, selectedBranchId, selectedRange, to])

  return (
    <div className="grid items-end gap-3 sm:grid-cols-2 print:hidden" aria-busy={busy}>
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

      <label className="block text-xs font-medium text-gray-700">Branch
        <span className="relative mt-1 block">
          <select className={`${inputClass} appearance-none pr-9`} value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-500" aria-hidden />
        </span>
      </label>

      {selectedRange === 'custom' && <>
        <label className="block text-xs font-medium text-gray-700">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="block text-xs font-medium text-gray-700">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${inputClass} mt-1`} /></label>
      </>}
    </div>
  )
}
