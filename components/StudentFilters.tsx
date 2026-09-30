'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'

type FilterOption = { value: string; label: string }
type StudentStatus = 'active' | 'archived' | 'all'
type OpenFilter = 'branch' | 'belt' | 'status' | null

function FilterChip({
  title,
  summary,
  open,
  selected,
  onToggle,
  onClear,
  children,
}: {
  title: string
  summary: string
  open: boolean
  selected: boolean
  onToggle: () => void
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className={`flex h-10 items-center rounded-lg border bg-white transition-colors ${open ? 'border-gray-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
        <button type="button" aria-expanded={open} onClick={onToggle} className="inline-flex h-full items-center gap-2 px-3 text-sm text-gray-700">
          <span>{title}</span>
          <span className={`max-w-40 truncate font-medium ${selected ? 'text-gray-950' : 'text-gray-500'}`}>{summary}</span>
          <ChevronDown size={15} className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {selected && (
          <button type="button" aria-label={`Clear ${title} filter`} onClick={onClear} className="mr-1 grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
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
}: {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  return (
    <div>
      <div className="max-h-72 overflow-y-auto p-2" role="group" aria-label={`${title} options`}>
        {options.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No options available.</p>
        ) : options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
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
  selectedStatus,
}: {
  branches: FilterOption[]
  belts: FilterOption[]
  canFilterStatus: boolean
  selectedBranchIds: string[]
  selectedBelts: string[]
  selectedStatus: StudentStatus
}) {
  const [branchIds, setBranchIds] = useState(selectedBranchIds)
  const [beltValues, setBeltValues] = useState(selectedBelts)
  const [status, setStatus] = useState<StudentStatus>(selectedStatus)
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const selectedBranchKey = selectedBranchIds.join(',')
  const selectedBeltKey = selectedBelts.join(',')

  useEffect(() => {
    setBranchIds(selectedBranchKey ? selectedBranchKey.split(',') : [])
    setBeltValues(selectedBeltKey ? selectedBeltKey.split(',') : [])
    setStatus(selectedStatus)
  }, [selectedBranchKey, selectedBeltKey, selectedStatus])

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

  const updateFilters = (nextBranchIds: string[], nextBeltValues: string[], nextStatus: StudentStatus) => {
    setBranchIds(nextBranchIds)
    setBeltValues(nextBeltValues)
    setStatus(nextStatus)

    const params = new URLSearchParams()
    if (canFilterStatus && nextStatus !== 'active') params.set('status', nextStatus)
    nextBranchIds.forEach((id) => params.append('branch', id))
    nextBeltValues.forEach((belt) => params.append('belt', belt))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const clearAll = () => {
    updateFilters([], [], 'active')
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
  const statusLabels: Record<StudentStatus, string> = { active: 'Active', archived: 'Archived', all: 'All statuses' }
  const hasFilters = branchIds.length > 0 || beltValues.length > 0 || (canFilterStatus && status !== 'active')

  return (
    <div ref={containerRef} className="mb-5 flex flex-wrap items-center gap-2.5">
      <FilterChip
        title="Branch"
        summary={branchSummary}
        open={openFilter === 'branch'}
        selected={branchIds.length > 0}
        onToggle={() => setOpenFilter(openFilter === 'branch' ? null : 'branch')}
        onClear={() => updateFilters([], beltValues, status)}
      >
        <MultiSelectMenu
          title="Branch"
          options={branches}
          selectedValues={branchIds}
          onToggle={(value) => updateFilters(toggleValue(branchIds, value), beltValues, status)}
          onClear={() => updateFilters([], beltValues, status)}
        />
      </FilterChip>

      <FilterChip
        title="Belt"
        summary={beltSummary}
        open={openFilter === 'belt'}
        selected={beltValues.length > 0}
        onToggle={() => setOpenFilter(openFilter === 'belt' ? null : 'belt')}
        onClear={() => updateFilters(branchIds, [], status)}
      >
        <MultiSelectMenu
          title="Belt level"
          options={belts}
          selectedValues={beltValues}
          onToggle={(value) => updateFilters(branchIds, toggleValue(beltValues, value), status)}
          onClear={() => updateFilters(branchIds, [], status)}
        />
      </FilterChip>

      {canFilterStatus && (
        <FilterChip
          title="Status"
          summary={statusLabels[status]}
          open={openFilter === 'status'}
          selected={status !== 'active'}
          onToggle={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
          onClear={() => updateFilters(branchIds, beltValues, 'active')}
        >
          <div className="p-2" role="radiogroup" aria-label="Student status">
            {(['active', 'archived', 'all'] as StudentStatus[]).map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-50">
                <input type="radio" name="student-status" checked={status === value} onChange={() => updateFilters(branchIds, beltValues, value)} className="h-4 w-4 accent-blue-600" />
                {statusLabels[value]}
              </label>
            ))}
          </div>
        </FilterChip>
      )}

      {hasFilters && <button type="button" onClick={clearAll} className="h-10 rounded-lg px-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">Clear all</button>}
    </div>
  )
}
