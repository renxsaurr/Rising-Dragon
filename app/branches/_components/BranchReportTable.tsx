import Link from 'next/link'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import type { BranchCounts, BranchReportRow } from '@/utils/branch-reports'
import { FAIR_RATE, GOOD_RATE, LOW_DATA_MARKS, cardClass, dataTier, isLowData, ratePercent, rateStatus } from '@/utils/branch-report-format'

const cell = 'px-3 py-3 text-right align-top text-sm tabular-nums text-gray-700 last:pr-5 print:px-1.5 print:py-2 print:text-xs'

// byReliability: reliable branches first, then Low data, then no marks — in both directions
const COLUMNS: { key: string; label: string; tip: string; value: (counts: BranchCounts) => number | null; byReliability?: boolean }[] = [
  { key: 'active', label: 'Active students', tip: 'Students who are active today; this does not change with the date range.', value: (counts) => counts.activeStudents },
  { key: 'new', label: 'New students', tip: 'Students whose enrollment date falls inside the date range.', value: (counts) => counts.newStudents },
  { key: 'classes', label: 'Classes', tip: 'Scheduled or completed classes in the date range, not counting cancelled or draft classes. Cancelled classes are shown underneath.', value: (counts) => counts.classes },
  { key: 'present', label: 'Present / Absent', tip: 'Attendance records marked Present and Absent in the counted classes. Sorts by present.', value: (counts) => counts.present },
  { key: 'rate', label: 'Attendance rate', tip: `Present divided by all marked records. Good is ${GOOD_RATE}%+, Fair ${FAIR_RATE}–${GOOD_RATE - 1}%, Low below ${FAIR_RATE}%.`, value: (counts) => counts.attendanceRate, byReliability: true },
  { key: 'avg', label: 'Avg. present per class', tip: 'Present records divided by the classes that have attendance marked.', value: (counts) => counts.avgPresentPerClass, byReliability: true },
]

const byName = (a: BranchReportRow, b: BranchReportRow) => a.branchName.localeCompare(b.branchName)

function RateCell({ counts }: { counts: BranchCounts }) {
  if (counts.attendanceRate === null) return <span className="text-xs font-normal text-gray-400">No attendance marked</span>
  const value = ratePercent(counts.attendanceRate)
  const lowData = isLowData(counts)
  const status = rateStatus(counts.attendanceRate)
  return (
    <span className="flex items-center justify-end gap-1.5">
      {/* the mini bar only fits from xl up */}
      <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-gray-100 xl:block" aria-hidden>
        <span className={`block h-full rounded-full ${lowData ? 'bg-gray-300' : status.bar}`} style={{ width: `${value}%` }} />
      </span>
      <span className={`w-9 text-right ${lowData ? 'text-gray-400' : ''}`}>{value}%</span>
      {lowData
        ? <span className="w-[3.25rem] whitespace-nowrap text-left text-[11px] font-normal text-gray-400">Low data</span>
        : <span className={`inline-flex w-[3.25rem] items-center gap-1 text-[11px] font-medium ${status.text}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden />{status.label}
        </span>}
    </span>
  )
}

function ReportRow({ name, counts, branchId, detailQuery = '' }: { name: string; counts: BranchCounts; branchId?: number; detailQuery?: string }) {
  const total = branchId === undefined
  return (
    <tr className={`print:break-inside-avoid ${total ? 'border-t-2 border-gray-200 bg-gray-50/80 font-semibold' : 'transition-colors duration-200 hover:bg-red-600/5'}`}>
      <th scope="row" className={`whitespace-nowrap py-3 pl-5 pr-3 text-left align-top text-sm text-gray-900 print:whitespace-normal print:py-2 print:pl-2 print:pr-1.5 print:text-xs ${total ? 'font-semibold' : 'font-medium'}`}>
        {total ? name : <Link href={`/branches/${branchId}?${detailQuery}`} className="hover:text-red-600 hover:underline">{name}</Link>}
      </th>
      <td className={cell}>{counts.activeStudents}</td>
      <td className={cell}>{counts.newStudents}</td>
      <td className={cell}>
        {counts.classes}
        {counts.cancelledClasses > 0 && (
          <span className="block text-[11px] font-normal text-gray-400">{counts.cancelledClasses} cancelled</span>
        )}
        {counts.unmarkedPastClasses > 0 && (
          <span className="block text-[11px] font-normal text-amber-600">{counts.unmarkedPastClasses} past not marked</span>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        {counts.present} <span className="text-gray-300">/</span> {counts.absent}
      </td>
      <td className={cell}><RateCell counts={counts} /></td>
      <td className={cell}>
        {counts.avgPresentPerClass === null ? <span className="font-normal text-gray-400">—</span> : counts.avgPresentPerClass.toFixed(1)}
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
        <table className="w-full min-w-[760px] lg:min-w-0 print:min-w-0">
          <thead>
            <tr className="border-b border-gray-100">
              <th scope="col" aria-sort={ariaSort('name')} className="th pl-5 pr-3 print:pl-2 print:pr-1.5">{sortLink('name', 'Branch')}</th>
              {COLUMNS.map((item) => (
                <th key={item.key} scope="col" aria-sort={ariaSort(item.key)} className="th px-3 text-right last:pr-5 print:px-1.5">
                  {sortLink(item.key, item.label)}
                  <span title={item.tip} aria-hidden className="ml-1 cursor-help text-gray-300 hover:text-gray-500 print:hidden">ⓘ</span>
                  <span className="sr-only">: {item.tip}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((branch) => <ReportRow key={branch.branchId} branchId={branch.branchId} name={branch.branchName} counts={branch} detailQuery={detailQuery} />)}
            {/* totals always stay at the bottom, whatever the sort */}
            <ReportRow name="All branches" counts={totals} />
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-gray-400">Rates under {LOW_DATA_MARKS} marks show “Low data” instead of a status.</p>
    </Card>
  )
}
