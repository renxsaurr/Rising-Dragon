'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'
import { BELT_LABELS, beltTextColorClass } from '@/utils/belts'

export default function PromotionFilters({
  initialQuery,
  initialBranch,
  initialBelt,
  activeView,
  branches,
}: {
  initialQuery: string
  initialBranch: string
  initialBelt: string
  activeView: 'promotions' | 'history'
  branches: { id: number; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(initialQuery)
  const [branch, setBranch] = useState(initialBranch)
  const [belt, setBelt] = useState(initialBelt)

  useEffect(() => {
    setQuery(initialQuery)
    setBranch(initialBranch)
    setBelt(initialBelt)
  }, [initialQuery, initialBranch, initialBelt])

  const replaceFilters = (next: { branch?: string; belt?: string; q?: string }) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', activeView)
    const nextQuery = (next.q ?? query).trim()
    const nextBranch = next.branch ?? branch
    const nextBelt = next.belt ?? belt
    if (next.branch !== undefined) setBranch(next.branch)
    if (next.belt !== undefined) setBelt(next.belt)
    if (nextQuery) params.set('q', nextQuery)
    else params.delete('q')
    if (nextBranch !== 'all') params.set('branch', nextBranch)
    else params.delete('branch')
    if (nextBelt !== 'all') params.set('belt', nextBelt)
    else params.delete('belt')
    const search = params.toString()
    router.replace(`${pathname}${search ? `?${search}` : ''}`, { scroll: false })
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = query.trim()
      const params = new URLSearchParams(window.location.search)
      const current = params.get('q') ?? ''
      if (current === next) return
      params.set('view', activeView)
      if (next) params.set('q', next)
      else params.delete('q')
      const search = params.toString()
      router.replace(`${pathname}${search ? `?${search}` : ''}`, { scroll: false })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [activeView, pathname, query, router])

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <label htmlFor="promotion-search" className="sr-only">Search promotions</label>
      <div className="relative min-w-[220px] flex-1">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          id="promotion-search"
          type="search"
          maxLength={80}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search student, branch, or belt"
          className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-950 outline-none placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        />
        {query && <button type="button" aria-label="Clear promotion search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-500 hover:bg-gray-100"><X size={15} /></button>}
      </div>
      <label htmlFor="promotion-branch-filter" className="sr-only">Branch</label>
      <div className="relative">
        <select id="promotion-branch-filter" value={branch} onChange={(event) => replaceFilters({ branch: event.target.value })} className="h-11 min-w-[170px] cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-12 text-sm font-medium text-gray-950 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100">
          <option value="all">All branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
      </div>
      <label htmlFor="promotion-belt-filter" className="sr-only">Belt level</label>
      <div className="relative">
        <select id="promotion-belt-filter" value={belt} onChange={(event) => replaceFilters({ belt: event.target.value })} className={`h-11 min-w-[170px] cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-12 text-sm font-medium outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${belt === 'all' ? 'text-gray-950' : beltTextColorClass(belt)}`}>
          <option value="all">All belt levels</option>
          {Object.entries(BELT_LABELS).map(([value, label]) => <option key={value} value={value} className={beltTextColorClass(value)}>{label}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
      </div>
      {(query || branch !== 'all' || belt !== 'all') && (
        <button type="button" onClick={() => { setQuery(''); replaceFilters({ q: '', branch: 'all', belt: 'all' }) }} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">Clear filters</button>
      )}
    </div>
  )
}
