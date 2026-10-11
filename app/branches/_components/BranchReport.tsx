import { ReportKpis } from '@/app/branches/_components/BranchReportSummary'
import BranchReportTableSwitcher from '@/app/branches/_components/BranchReportTableSwitcher'
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

      <div className="flex flex-wrap items-end justify-between gap-2 print:hidden">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-950">Branch overview</h2>
          <p className="mt-1 text-sm text-gray-600">Compare class activity and recorded attendance across {branchesLabel.toLowerCase()}.</p>
        </div>
        <p className="text-sm font-medium text-gray-700">{rangeLabel}{report.range.endClampedToToday && ' · through today'}</p>
      </div>
      <ReportKpis totals={totals} />
      <BranchReportTableSwitcher branches={report.branches} totals={totals} sessions={report.sessions} sort={sort} dir={dir} baseQuery={baseQuery} detailQuery={detailQuery} />
    </div>
  )
}
