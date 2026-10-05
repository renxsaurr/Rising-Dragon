import Link from 'next/link'
import { Activity, ChevronDown } from 'lucide-react'
import { Card } from '@/components/DashboardWidgets'
import { NeedsAttention, ReportKpis, ReportRangeLine } from '@/app/branches/_components/BranchReportSummary'
import BranchReportTable from '@/app/branches/_components/BranchReportTable'
import PrintReportButton from '@/app/branches/_components/PrintReportButton'
import type { BranchReport as Report, ReportComparison } from '@/utils/branch-reports'
import {
  DROP_ALERT_POINTS, FAIR_RATE, GOOD_RATE, LOW_DATA_MARKS,
  cardClass, dataTier, formatRange, isLowData, marksOf, ratePercent, rateStatus,
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
  const rated = report.branches
    .filter((branch) => branch.attendanceRate !== null)
    // reliable first, then Low data; within each, highest rate first
    .sort((a, b) => dataTier(a) - dataTier(b) || b.attendanceRate! - a.attendanceRate! || a.branchName.localeCompare(b.branchName))
  const unrated = report.branches.filter((branch) => branch.attendanceRate === null)

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

      {rated.length >= 2 && (
        <Card title={<><Activity className="h-4 w-4 text-gray-950" aria-hidden />Attendance rate by branch</>} chip={rangeLabel} className={`${cardClass} print:break-inside-avoid`}>
          <ul className="space-y-3">
            {rated.map((branch) => {
              const value = ratePercent(branch.attendanceRate!)
              const lowData = isLowData(branch)
              const status = rateStatus(branch.attendanceRate!)
              return (
                <li key={branch.branchId}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <Link href={`/branches/${branch.branchId}?${detailQuery}`} className="truncate font-medium text-gray-700 hover:text-red-600">{branch.branchName}</Link>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      <span className={lowData ? 'text-gray-400' : 'font-medium text-gray-700'}>{value}%</span>{' '}
                      <span className={lowData ? 'text-gray-400' : status.text}>· {lowData ? 'Low data' : status.label}</span>
                      <span className="ml-1 text-gray-400">({branch.present} of {marksOf(branch)})</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                    <div className={`h-full rounded-full transition-all duration-500 ${lowData ? 'bg-gray-300' : status.bar}`} style={{ width: `${value}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {unrated.length > 0 && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
              No attendance marked: {unrated.map((branch) => branch.branchName).join(', ')}
            </p>
          )}
        </Card>
      )}

      <BranchReportTable branches={report.branches} totals={totals} sort={sort} dir={dir} baseQuery={baseQuery} detailQuery={detailQuery} />

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
          <li>Today’s classes are included. A class only shows as <em>past not marked</em> from the day after it happened.</li>
          <li><strong className="font-medium text-gray-900">Avg. present per class</strong> only uses classes where attendance was marked.</li>
          <li><strong className="font-medium text-gray-900">Status:</strong> Good is {GOOD_RATE}% or higher, Fair is {FAIR_RATE}–{GOOD_RATE - 1}%, Low is below {FAIR_RATE}%. With fewer than {LOW_DATA_MARKS} marks the rate shows <em>Low data</em> and no status.</li>
          <li><strong className="font-medium text-gray-900">Previous period</strong> is the same number of days right before the start date{previousLabel && <> (here: {previousLabel})</>}. If the range ends after today, its length is counted up to today.</li>
          <li><strong className="font-medium text-gray-900">Needs attention</strong> lists rates below {FAIR_RATE}%, drops of {DROP_ALERT_POINTS}+ pts (both periods with {LOW_DATA_MARKS}+ marks), past classes not marked, cancelled classes, and low data, most serious first.</li>
          <li>The report never counts days after today.</li>
        </ul>
      </details>
    </div>
  )
}
