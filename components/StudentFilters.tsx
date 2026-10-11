'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'
import { beltTextColorClass } from '@/utils/belts'

type FilterOption = { value: string; label: string }
type StudentStatus = 'active' | 'archived' | 'all'
type StudentBillingPlan = 'all' | 'Monthly' | 'Per session'
type OpenFilter = 'branch' | 'belt' | 'plan' | 'status' | null

function FilterChip({
  title,
  summary,
  open,
  selected,
  summaryClassName,
  onToggle,
  onClear,
  children,
}: {
  title: string
  summary: string
  open: boolean
  selected: boolean
  summaryClassName?: string
  onToggle: () => void
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className={`flex h-10 items-center rounded-lg border bg-white transition-colors ${open ? 'border-gray-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
        <button type="button" aria-label={`${title}: ${summary}`} aria-expanded={open} onClick={onToggle} className="inline-flex h-full min-w-0 items-center gap-2 px-3 text-sm text-gray-950">
          <span className={`max-w-48 truncate font-medium ${summaryClassName ?? 'text-gray-950'}`}>{summary}</span>
          <ChevronDown size={16} className={`shrink-0 text-gray-950 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {selected && (
          <button type="button" aria-label={`Clear ${title} filter`} onClick={onClear} className="mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-950">
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {children}
        </div>
      )}
    </div>
  )
}

function MultiSelectMenu({
  title,
  options,
  selectedValues,
  onToggle,
  onClear,
  optionClassName,
}: {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
  optionClassName?: (value: string) => string
}) {
  return (
    <div>
      <div className="max-h-72 overflow-y-auto p-2" role="group" aria-label={`${title} options`}>
        {options.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No options available.</p>
        ) : options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-950 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            <span className={`min-w-0 flex-1 truncate ${optionClassName?.(option.value) ?? ''}`}>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2.5">
        <button type="button" onClick={onClear} className="text-xs font-medium text-gray-500 hover:text-gray-900">Clear selection</button>
        <span className="text-xs text-gray-400">{selectedValues.length} selected</span>
      </div>
    </div>
  )
}

export default function StudentFilters({
  branches,
  belts,
  canFilterStatus,
  selectedBranchIds,
  selectedBelts,
  selectedBillingPlan,
  selectedStatus,
  searchQuery,
}: {
  branches: FilterOption[]
  belts: FilterOption[]
  canFilterStatus: boolean
  selectedBranchIds: string[]
  selectedBelts: string[]
  selectedBillingPlan: StudentBillingPlan
  selectedStatus: StudentStatus
  searchQuery: string
}) {
  const [branchIds, setBranchIds] = useState(selectedBranchIds)
  const [beltValues, setBeltValues] = useState(selectedBelts)
  const [status, setStatus] = useState<StudentStatus>(selectedStatus)
  const [billingPlan, setBillingPlan] = useState<StudentBillingPlan>(selectedBillingPlan)
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const selectedBranchKey = selectedBranchIds.join(',')
  const selectedBeltKey = selectedBelts.join(',')

  useEffect(() => {
    setBranchIds(selectedBranchKey ? selectedBranchKey.split(',') : [])
    setBeltValues(selectedBeltKey ? selectedBeltKey.split(',') : [])
    setBillingPlan(selectedBillingPlan)
    setStatus(selectedStatus)
  }, [selectedBranchKey, selectedBeltKey, selectedBillingPlan, selectedStatus])

  useEffect(() => {
    if (!openFilter) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenFilter(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFilter(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openFilter])

  const updateFilters = (nextBranchIds: string[], nextBeltValues: string[], nextBillingPlan: StudentBillingPlan, nextStatus: StudentStatus) => {
    setBranchIds(nextBranchIds)
    setBeltValues(nextBeltValues)
    setBillingPlan(nextBillingPlan)
    setStatus(nextStatus)

    const params = new URLSearchParams()
    const currentSearch = (document.getElementById('live-search-q') as HTMLInputElement | null)?.value.trim() ?? searchQuery
    if (currentSearch) params.set('q', currentSearch)
    if (canFilterStatus && nextStatus !== 'active') params.set('status', nextStatus)
    if (nextBillingPlan !== 'all') params.set('plan', nextBillingPlan)
    nextBranchIds.forEach((id) => params.append('branch', id))
    nextBeltValues.forEach((belt) => params.append('belt', belt))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const clearAll = () => {
    updateFilters([], [], 'all', 'active')
    setOpenFilter(null)
  }

  const toggleValue = (values: string[], value: string) => (
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  )

  const branchSummary = branchIds.length === 0
    ? 'All branches'
    : branchIds.length === 1
      ? branches.find((option) => option.value === branchIds[0])?.label ?? '1 selected'
      : `${branchIds.length} selected`
  const beltSummary = beltValues.length === 0
    ? 'All belt levels'
    : beltValues.length === 1
      ? belts.find((option) => option.value === beltValues[0])?.label ?? '1 selected'
      : `${beltValues.length} selected`
  const planLabels: Record<StudentBillingPlan, string> = { all: 'All billing plans', Monthly: 'Monthly', 'Per session': 'Per session' }
  const statusLabels: Record<StudentStatus, string> = { active: 'Active students', archived: 'Archived students', all: 'All students' }
  const hasFilters = branchIds.length > 0 || beltValues.length > 0 || billingPlan !== 'all' || (canFilterStatus && status !== 'active')

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-2.5">
      <FilterChip
        title="Branch"
        summary={branchSummary}
        open={openFilter === 'branch'}
        selected={branchIds.length > 0}
        onToggle={() => setOpenFilter(openFilter === 'branch' ? null : 'branch')}
        onClear={() => updateFilters([], beltValues, billingPlan, status)}
      >
        <MultiSelectMenu
          title="Branch"
          options={branches}
          selectedValues={branchIds}
          onToggle={(value) => updateFilters(toggleValue(branchIds, value), beltValues, billingPlan, status)}
          onClear={() => updateFilters([], beltValues, billingPlan, status)}
        />
      </FilterChip>

      <FilterChip
        title="Belt"
        summary={beltSummary}
        summaryClassName={beltValues.length === 1 ? beltTextColorClass(beltValues[0]) : undefined}
        open={openFilter === 'belt'}
        selected={beltValues.length > 0}
        onToggle={() => setOpenFilter(openFilter === 'belt' ? null : 'belt')}
        onClear={() => updateFilters(branchIds, [], billingPlan, status)}
      >
        <MultiSelectMenu
          title="Belt level"
          options={belts}
          optionClassName={beltTextColorClass}
          selectedValues={beltValues}
          onToggle={(value) => updateFilters(branchIds, toggleValue(beltValues, value), billingPlan, status)}
          onClear={() => updateFilters(branchIds, [], billingPlan, status)}
        />
      </FilterChip>

      <FilterChip
        title="Billing plan"
        summary={planLabels[billingPlan]}
        open={openFilter === 'plan'}
        selected={billingPlan !== 'all'}
        onToggle={() => setOpenFilter(openFilter === 'plan' ? null : 'plan')}
        onClear={() => updateFilters(branchIds, beltValues, 'all', status)}
      >
        <div className="p-2" role="radiogroup" aria-label="Student billing plan">
          {(['all', 'Monthly', 'Per session'] as StudentBillingPlan[]).map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-950 hover:bg-gray-50">
              <input type="radio" name="student-billing-plan" checked={billingPlan === value} onChange={() => updateFilters(branchIds, beltValues, value, status)} className="h-4 w-4 accent-blue-600" />
              {planLabels[value]}
            </label>
          ))}
        </div>
      </FilterChip>

      {canFilterStatus && (
        <FilterChip
          title="Status"
          summary={statusLabels[status]}
          open={openFilter === 'status'}
          selected={status !== 'active'}
          onToggle={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
          onClear={() => updateFilters(branchIds, beltValues, billingPlan, 'active')}
        >
          <div className="p-2" role="radiogroup" aria-label="Student status">
            {(['active', 'archived', 'all'] as StudentStatus[]).map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-950 hover:bg-gray-50">
                <input type="radio" name="student-status" checked={status === value} onChange={() => updateFilters(branchIds, beltValues, billingPlan, value)} className="h-4 w-4 accent-blue-600" />
                {statusLabels[value]}
              </label>
            ))}
          </div>
        </FilterChip>
      )}

      {hasFilters && <button type="button" onClick={clearAll} className="h-10 rounded-lg px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950">Clear all</button>}
    </div>
  )
}
