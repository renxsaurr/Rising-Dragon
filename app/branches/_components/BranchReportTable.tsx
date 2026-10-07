import Link from 'next/link'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import type { BranchCounts, BranchReportRow } from '@/utils/branch-reports'
import { FAIR_RATE, GOOD_RATE, LOW_DATA_MARKS, cardClass, dataTier, isLowData, ratePercent, rateStatus } from '@/utils/branch-report-format'
import PaginatedTableRows from '@/components/PaginatedTableRows'

const cell = 'px-3 py-3 text-left align-top text-sm tabular-nums text-gray-700 last:pr-5 print:px-1.5 print:py-2 print:text-xs'

// byReliability: reliable branches first, then Low data, then no marks — in both directions
const COLUMNS: { key: string; label: string; tip: string; value: (counts: BranchCounts) => number | null; byReliability?: boolean }[] = [
  { key: 'active', label: 'Students', tip: 'Active students today. The sub-label shows new enrollments in the selected period.', value: (counts) => counts.activeStudents },
  { key: 'classes', label: 'Classes', tip: 'Scheduled or completed classes in the selected period. Cancelled classes and incomplete attendance are shown underneath.', value: (counts) => counts.classes },
  { key: 'rate', label: 'Attendance', tip: `Present divided by all marked records. Good is ${GOOD_RATE}%+, Fair ${FAIR_RATE}–${GOOD_RATE - 1}%, Low below ${FAIR_RATE}%. Students without an attendance record are not counted.`, value: (counts) => counts.attendanceRate, byReliability: true },
  { key: 'assessed', label: 'Student progress', tip: 'Coach progress checks recorded in this period. Ready for assessment is only a coach recommendation.', value: (counts) => counts.assessedStudents },
]

const byName = (a: BranchReportRow, b: BranchReportRow) => a.branchName.localeCompare(b.branchName)

function RateCell({ counts }: { counts: BranchCounts }) {
  if (counts.attendanceRate === null) return <span className="text-xs font-normal text-gray-400">No attendance marked</span>
  const value = ratePercent(counts.attendanceRate)
  const lowData = isLowData(counts)
  const status = rateStatus(counts.attendanceRate)
  return (
    <span className="block">
      <span className={`block font-semibold ${lowData ? 'text-gray-500' : 'text-gray-900'}`}>{value}%</span>
      <span className={`mt-0.5 block text-xs font-normal ${lowData ? 'text-gray-500' : status.text}`}>{lowData ? 'Low data' : status.label}</span>
      <span className="mt-0.5 block text-xs font-normal text-gray-500">{counts.present} present · {counts.absent} absent</span>
    </span>
  )
}

function ReportRow({ name, counts, branchId, detailQuery = '' }: { name: string; counts: BranchCounts; branchId?: number; detailQuery?: string }) {
  const total = branchId === undefined
  return (
    <tr className={`print:break-inside-avoid ${total ? 'border-t-2 border-gray-200 bg-gray-50/80 font-semibold' : 'transition-colors duration-200 hover:bg-gray-50'}`}>
      <th scope="row" className={`whitespace-nowrap py-3 pl-5 pr-3 text-left align-top text-sm text-gray-900 print:whitespace-normal print:py-2 print:pl-2 print:pr-1.5 print:text-xs ${total ? 'font-semibold' : 'font-medium'}`}>
        {total ? name : <Link href={`/branches/${branchId}?${detailQuery}`} className="hover:text-red-600 hover:underline">{name}</Link>}
      </th>
      <td className={cell}>
        <span className="block font-semibold text-gray-900">{counts.activeStudents} active</span>
        <span className="mt-0.5 block text-xs font-normal text-gray-500">{counts.newStudents} new in period</span>
      </td>
      <td className={cell}>
        <span className="block font-semibold text-gray-900">{counts.classes}</span>
        <span className="mt-0.5 block text-xs font-normal text-gray-500">classes</span>
        {counts.cancelledClasses > 0 && (
          <span className="block text-[11px] font-normal text-gray-400">{counts.cancelledClasses} cancelled</span>
        )}
        {counts.incompletePastClasses > 0 && (
          <span className="block text-[11px] font-normal text-amber-700">{counts.incompletePastClasses} not fully marked · {counts.unmarkedStudentMarks} attendance marks missing</span>
        )}
      </td>
      <td className={cell}><RateCell counts={counts} /></td>
      <td className={cell}>
        <span className="block font-semibold text-gray-900">{counts.assessedStudents} assessed</span>
        <span className="mt-0.5 block text-xs font-normal text-gray-500">{counts.progressEntries} checks</span>
        <span className="mt-0.5 block text-xs font-normal text-gray-500">{counts.readyForAssessment} recommended for assessment</span>
      </td>
    </tr>
  )
}

export default function BranchReportTable({ branches, totals, sort, dir, baseQuery, detailQuery }: {
  branches: BranchReportRow[]
  totals: BranchCounts
  sort?: string
  dir?: string
  baseQuery: string
  detailQuery: string
}) {
  const column = COLUMNS.find((candidate) => candidate.key === sort)
  const sortKey = column?.key ?? 'name'
  const direction = dir === 'asc' || dir === 'desc' ? dir : column ? 'desc' : 'asc'

  const rows = [...branches].sort((a, b) => {
    if (!column) return direction === 'asc' ? byName(a, b) : byName(b, a)
    if (column.byReliability) {
      const tier = dataTier(a) - dataTier(b)
      if (tier) return tier
    }
    const first = column.value(a)
    const second = column.value(b)
    if (first === second) return byName(a, b)
    // branches with nothing to compare always go last
    if (first === null) return 1
    if (second === null) return -1
    return direction === 'asc' ? first - second : second - first
  })

  const sortLink = (key: string, label: string) => {
    const active = key === sortKey
    const nextDir = active ? (direction === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'
    return (
      <Link href={`/branches?${baseQuery}&sort=${key}&dir=${nextDir}`} scroll={false} className={`inline-flex items-center gap-1 hover:text-gray-700 ${active ? 'text-gray-900' : ''}`}>
        {label}
        {active && <span aria-hidden className="text-[9px]">{direction === 'asc' ? '▲' : '▼'}</span>}
      </Link>
    )
  }
  const ariaSort = (key: string) => key === sortKey ? (direction === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <Card title="Branch comparison" chip={`${branches.length} branch${branches.length === 1 ? '' : 'es'}`} flush className={cardClass}>
      {totals.classes === 0 && (
        <div className="px-5 pb-4"><EmptyNote>No classes in this date range. Try a wider range.</EmptyNote></div>
      )}
      <div className="overflow-x-auto print:overflow-visible">
        <table className="system-data-table w-full min-w-[720px] print:min-w-0">
          <thead>
            <tr className="border-b border-gray-100">
              <th scope="col" aria-sort={ariaSort('name')} className="th pl-5 pr-3 print:pl-2 print:pr-1.5">{sortLink('name', 'Branch')}</th>
              {COLUMNS.map((item) => (
                <th key={item.key} scope="col" aria-sort={ariaSort(item.key)} title={item.tip} className="th px-3 text-left last:pr-5 print:px-1.5">
                  {sortLink(item.key, item.label)}
                  <span className="sr-only">: {item.tip}</span>
                </th>
              ))}
            </tr>
          </thead>
          <PaginatedTableRows itemLabel="branch report rows" colSpan={5} pinnedRows={1}>
            {rows.map((branch) => <ReportRow key={branch.branchId} branchId={branch.branchId} name={branch.branchName} counts={branch} detailQuery={detailQuery} />)}
            {/* totals always stay at the bottom, whatever the sort */}
            <ReportRow name="All branches" counts={totals} />
          </PaginatedTableRows>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-gray-500">Rates with fewer than {LOW_DATA_MARKS} attendance marks are labeled “Low data.”</p>
    </Card>
  )
}
