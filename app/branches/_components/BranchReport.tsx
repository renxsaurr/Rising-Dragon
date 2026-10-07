import { ChevronDown } from 'lucide-react'
import { NeedsAttention, ReportKpis } from '@/app/branches/_components/BranchReportSummary'
import BranchReportTable from '@/app/branches/_components/BranchReportTable'
import BranchProgressChecks from '@/app/branches/_components/BranchProgressChecks'
import type { BranchReport as Report, ReportComparison } from '@/utils/branch-reports'
import { formatRange } from '@/utils/branch-report-format'

export default function BranchReport({ report, comparison, sort, dir, baseQuery, detailQuery, branchesLabel, generatedAt }: {
  report: Report
  comparison: ReportComparison | null
  sort?: string
  dir?: string
  baseQuery: string
  detailQuery: string
  branchesLabel: string
  generatedAt: string
}) {
  const { totals } = report
  const rangeLabel = formatRange(report.range.start, report.range.end)
  return (
    <div className="space-y-5">
      {/* print-only title block; replaces the app header, filters and range line on paper */}
      <header className="hidden print:block">
        <h1 className="text-xl font-semibold text-gray-950">Rising Dragon Taekwondo — Branch Report</h1>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-gray-500">Period</dt>
          <dd className="text-gray-900">{rangeLabel}{report.range.endClampedToToday && ' (until today)'}</dd>
          <dt className="text-gray-500">Compared with</dt>
          <dd className="text-gray-900">{comparison ? formatRange(comparison.start, comparison.end) : 'No comparison'}</dd>
          <dt className="text-gray-500">Branches</dt>
          <dd className="text-gray-900">{branchesLabel}</dd>
          <dt className="text-gray-500">Generated on</dt>
          <dd className="text-gray-900">{generatedAt}</dd>
        </dl>
      </header>

      <ReportKpis totals={totals} comparison={comparison} />
      <NeedsAttention branches={report.branches} comparison={comparison} detailQuery={detailQuery} />
      <BranchReportTable branches={report.branches} totals={totals} sort={sort} dir={dir} baseQuery={baseQuery} detailQuery={detailQuery} />

      <section aria-labelledby="progress-summary-title" className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="progress-summary-title" className="text-base font-semibold text-gray-950">Student progress</h2>
            <p className="mt-1 text-sm text-gray-600">Coach observations in this period. Readiness is a recommendation; coaches decide promotions.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{rangeLabel}</span>
        </div>
        <dl className="mt-4 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-4">
          <div className="px-3 first:pl-0"><dt className="text-xs text-gray-600">Checks</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-950">{totals.progressEntries}</dd></div>
          <div className="px-3"><dt className="text-xs text-gray-600">Students assessed</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-950">{totals.assessedStudents}</dd></div>
          <div className="px-3 last:pr-0"><dt className="text-xs text-gray-600">Recommended for assessment</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-950">{totals.readyForAssessment}</dd></div>
        </dl>
      </section>

      <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          Latest progress notes <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{report.progressChecks.length}</span>
          <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180 print:hidden" aria-hidden />
        </summary>
        <div className="border-t border-gray-100"><BranchProgressChecks checks={report.progressChecks} embedded /></div>
      </details>

    </div>
  )
}
