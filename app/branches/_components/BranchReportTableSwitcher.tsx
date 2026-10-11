'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import BranchReportTable from '@/app/branches/_components/BranchReportTable'
import BranchReportSessions from '@/app/branches/_components/BranchReportSessions'
import type { BranchCounts, BranchReportRow, BranchReportSession } from '@/utils/branch-reports'

export default function BranchReportTableSwitcher({ branches, totals, sessions, sort, dir, baseQuery, detailQuery }: {
  branches: BranchReportRow[]
  totals: BranchCounts
  sessions: BranchReportSession[]
  sort?: string
  dir?: string
  baseQuery: string
  detailQuery: string
}) {
  const [activeView, setActiveView] = useState<'comparison' | 'sessions'>('comparison')

  return (
    <div className="space-y-4">
      <label className="block max-w-sm text-sm font-medium text-gray-700 print:hidden">
        Report table
        <span className="relative mt-1.5 block">
          <select
            value={activeView}
            onChange={(event) => setActiveView(event.target.value as 'comparison' | 'sessions')}
            className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm font-medium text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="comparison">Branch comparison</option>
            <option value="sessions">Class session records</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-gray-600" aria-hidden="true" />
        </span>
      </label>

      <div className="print:hidden">
        {activeView === 'comparison'
          ? <BranchReportTable branches={branches} totals={totals} sort={sort} dir={dir} baseQuery={baseQuery} detailQuery={detailQuery} />
          : <BranchReportSessions sessions={sessions} />}
      </div>
      <div className="hidden space-y-5 print:block">
        <BranchReportTable branches={branches} totals={totals} sort={sort} dir={dir} baseQuery={baseQuery} detailQuery={detailQuery} />
        <BranchReportSessions sessions={sessions} />
      </div>
    </div>
  )
}
