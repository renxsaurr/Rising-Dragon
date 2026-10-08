import { ClipboardCheck, FileText } from 'lucide-react'
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

      <div className="grid items-stretch gap-5 lg:grid-cols-2 print:grid-cols-2">
        <section aria-labelledby="progress-summary-title" className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-[18px] w-[18px] text-gray-950" aria-hidden />
            <h2 id="progress-summary-title" className="text-base font-semibold tracking-tight text-gray-950">Student progress</h2>
          </div>
          <p className="mt-2 text-sm leading-5 text-gray-700">Coach observations in this period. Readiness is a recommendation; coaches decide promotions.</p>
          <dl className="mt-auto grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-100 pt-4">
            <div className="pr-2"><dt className="text-xs font-medium text-gray-700">Checks</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{totals.progressEntries}</dd></div>
            <div className="px-3"><dt className="text-xs font-medium text-gray-700">Students assessed</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{totals.assessedStudents}</dd></div>
            <div className="pl-3"><dt className="text-xs font-medium text-gray-700">Recommended for assessment</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{totals.readyForAssessment}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="latest-progress-title" className="h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <FileText className="h-[18px] w-[18px] text-gray-950" aria-hidden />
              <h2 id="latest-progress-title" className="text-base font-semibold tracking-tight text-gray-950">Latest progress notes</h2>
            </div>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">{report.progressChecks.length}</span>
          </div>
          <div className="border-t border-gray-100"><BranchProgressChecks checks={report.progressChecks} embedded /></div>
        </section>
      </div>

    </div>
  )
}
