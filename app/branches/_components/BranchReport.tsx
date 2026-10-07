import { ChevronDown } from 'lucide-react'
import { NeedsAttention, ReportKpis, ReportRangeLine } from '@/app/branches/_components/BranchReportSummary'
import BranchReportTable from '@/app/branches/_components/BranchReportTable'
import BranchProgressChecks from '@/app/branches/_components/BranchProgressChecks'
import PrintReportButton from '@/app/branches/_components/PrintReportButton'
import type { BranchReport as Report, ReportComparison } from '@/utils/branch-reports'
import {
  DROP_ALERT_POINTS, FAIR_RATE, GOOD_RATE, LOW_DATA_MARKS,
  formatRange,
} from '@/utils/branch-report-format'

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
  const previousLabel = comparison ? formatRange(comparison.start, comparison.end, false) : null
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

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ReportRangeLine range={report.range} comparison={comparison} />
        <PrintReportButton />
      </div>
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

      <details className="card group print:break-inside-avoid">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          How these numbers work
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 print:hidden" aria-hidden />
        </summary>
        <ul className="list-disc space-y-1.5 px-5 pb-5 pl-10 text-sm text-gray-600">
          <li><strong className="font-medium text-gray-900">Active students</strong> is today’s count. It does not change with the date range.</li>
          <li><strong className="font-medium text-gray-900">Classes</strong> counts scheduled or completed classes in the range. Cancelled classes are shown under the Classes number when there are any, and drafts are never counted.</li>
          <li><strong className="font-medium text-gray-900">Attendance rate</strong> is present ÷ (present + absent). Students without an attendance record are unmarked and are not counted as present or absent.</li>
          <li>Attendance counts at the branch where the class happened, even if the student moved to another branch later.</li>
          <li>Past attendance of students who are now inactive still counts.</li>
          <li>Today’s classes are included. A past class is flagged if any expected student is still unmarked; the missing count uses active students enrolled by that class date plus students with an existing mark who are now inactive or moved.</li>
          <li><strong className="font-medium text-gray-900">Avg. present per class</strong> uses classes with at least one attendance mark, including partially marked classes.</li>
          <li><strong className="font-medium text-gray-900">Student progress</strong> comes from dated coach observations. The report counts each student&apos;s latest assessment readiness in the selected period; it is a recommendation for formal assessment, not a promotion decision.</li>
          <li><strong className="font-medium text-gray-900">Status:</strong> Good is {GOOD_RATE}% or higher, Fair is {FAIR_RATE}–{GOOD_RATE - 1}%, Low is below {FAIR_RATE}%. With fewer than {LOW_DATA_MARKS} marks the rate shows <em>Low data</em> and no status.</li>
          <li><strong className="font-medium text-gray-900">Previous period</strong> is the same number of days right before the start date{previousLabel && <> (here: {previousLabel})</>}. If the range ends after today, its length is counted up to today.</li>
          <li><strong className="font-medium text-gray-900">Needs attention</strong> lists rates below {FAIR_RATE}%, drops of {DROP_ALERT_POINTS}+ pts (both periods with {LOW_DATA_MARKS}+ marks), past classes with unmarked students, cancelled classes, and low data, most serious first.</li>
          <li>The report never counts days after today.</li>
        </ul>
      </details>
    </div>
  )
}
