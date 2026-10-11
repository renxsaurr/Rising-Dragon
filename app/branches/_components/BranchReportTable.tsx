import Link from 'next/link'
import type { BranchCounts, BranchReportRow } from '@/utils/branch-reports'
import { ratePercent } from '@/utils/branch-report-format'
import PaginatedTableRows from '@/components/PaginatedTableRows'

const cell = 'px-5 py-7 text-left align-middle text-base font-medium tabular-nums text-gray-950 print:px-1.5 print:py-2 print:text-xs'

const COLUMNS: { key: string; label: string; tip: string; value: (counts: BranchCounts) => number | null }[] = [
  { key: 'active', label: 'Students', tip: 'Active students today, with new enrollments during the selected period.', value: (counts) => counts.activeStudents },
  { key: 'classes', label: 'Class sessions', tip: 'Non-cancelled class sessions in the selected period. Cancelled sessions are listed separately.', value: (counts) => counts.classes },
  { key: 'records', label: 'Attendance records', tip: 'Saved present, late, absent, and excused statuses.', value: (counts) => counts.recordedMarks },
  { key: 'coverage', label: 'Recording coverage', tip: 'Saved attendance statuses divided by expected statuses for sessions that have ended. Expected roster is based on the current active monthly roster plus per-session check-ins.', value: (counts) => counts.recordingCoverage },
  { key: 'rate', label: 'Recorded attendance rate', tip: 'Present and late divided by present, late, and absent records. Excused records are shown separately.', value: (counts) => counts.attendanceRate },
]

const byName = (a: BranchReportRow, b: BranchReportRow) => a.branchName.localeCompare(b.branchName)

function AttendanceCell({ counts }: { counts: BranchCounts }) {
  return (
    <span className="block whitespace-nowrap text-sm font-medium leading-6 text-gray-700">
      {counts.present} present · {counts.late} late<br />
      {counts.absent} absent · {counts.excused} excused
    </span>
  )
}

function CoverageCell({ counts }: { counts: BranchCounts }) {
  if (counts.recordingCoverage === null) return <span className="text-sm font-medium text-gray-600">No ended sessions</span>
  return (
    <span className="block">
      <span className="block text-base font-medium text-gray-950">{ratePercent(counts.recordingCoverage)}%</span>
      <span className="mt-1 block text-sm font-normal text-gray-700">{counts.recordedDueMarks} of {counts.expectedMarks} recorded</span>
      {counts.unmarkedStudentMarks > 0 && <span className="mt-1 block text-sm font-normal text-gray-600">{counts.unmarkedStudentMarks} not recorded</span>}
    </span>
  )
}

function RateCell({ counts }: { counts: BranchCounts }) {
  if (counts.attendanceRate === null) return <span className="text-sm font-medium text-gray-600">No statuses recorded</span>
  return (
    <span className="block">
      <span className="block text-base font-medium text-gray-950">{ratePercent(counts.attendanceRate)}%</span>
      <span className="mt-1 block text-sm font-normal text-gray-700">of non-excused records</span>
    </span>
  )
}

function ReportRow({ name, counts, branchId, rowNumber, detailQuery = '' }: { name: string; counts: BranchCounts; branchId?: number; rowNumber: number | null; detailQuery?: string }) {
  const total = branchId === undefined
  return (
    <tr className={`border-b border-gray-100 print:break-inside-avoid ${total ? 'branch-report-total-row border-t-2 border-gray-200' : ''}`}>
      <td className="w-16 px-5 py-7 text-left align-middle text-base font-medium tabular-nums text-gray-700 print:px-1.5 print:py-2 print:text-xs">{rowNumber ?? '—'}</td>
      <th scope="row" className={`whitespace-nowrap px-5 py-7 text-left align-middle text-base text-gray-950 print:whitespace-normal print:px-1.5 print:py-2 print:text-xs ${total ? 'font-semibold' : 'font-medium'}`}>
        {total ? name : <Link href={`/branches/${branchId}?${detailQuery}`} className="font-semibold text-gray-950 underline-offset-2 hover:underline focus-visible:underline">{name}</Link>}
      </th>
      <td className={cell}>
        <span className="block">{counts.activeStudents} active</span>
        <span className="mt-1 block text-sm font-normal text-gray-700">{counts.newStudents} new in period</span>
      </td>
      <td className={cell}>
        <span className="block">{counts.classes}</span>
        <span className="mt-1 block text-sm font-normal text-gray-700">sessions</span>
        {counts.cancelledClasses > 0 && <span className="mt-1 block text-sm font-normal text-gray-600">{counts.cancelledClasses} cancelled</span>}
      </td>
      <td className={cell}><AttendanceCell counts={counts} /></td>
      <td className={cell}><CoverageCell counts={counts} /></td>
      <td className={cell}><RateCell counts={counts} /></td>
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
    const first = column.value(a)
    const second = column.value(b)
    if (first === second) return byName(a, b)
    if (first === null) return 1
    if (second === null) return -1
    return direction === 'asc' ? first - second : second - first
  })

  const sortLink = (key: string, label: string) => {
    const active = key === sortKey
    const nextDir = active ? (direction === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'
    return (
      <Link href={`/branches?${baseQuery}&sort=${key}&dir=${nextDir}`} scroll={false} className="inline-flex items-center gap-1 text-inherit focus-visible:underline">
        {label}
        {active && <span aria-hidden className="text-[9px]">{direction === 'asc' ? '▲' : '▼'}</span>}
      </Link>
    )
  }
  const ariaSort = (key: string) => key === sortKey ? (direction === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <section aria-labelledby="branch-comparison-title" className="min-w-0 bg-white">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 id="branch-comparison-title" className="text-lg font-semibold tracking-tight text-gray-950">Branch comparison</h3>
        <span className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">{branches.length} branch{branches.length === 1 ? '' : 'es'}</span>
      </div>
      <div className="overflow-x-auto border-y border-gray-200 print:overflow-visible">
        <table className="system-data-table branch-report-table w-full min-w-[1120px] border-collapse print:min-w-0">
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="w-16 px-5 py-5 text-left text-[15px] font-medium text-gray-600 print:px-1.5 print:py-2 print:text-xs">#</th>
              <th scope="col" aria-sort={ariaSort('name')} className="px-5 py-5 text-left text-[15px] font-medium text-gray-600 print:px-1.5 print:py-2 print:text-xs">{sortLink('name', 'Branch')}</th>
              {COLUMNS.map((item) => (
                <th key={item.key} scope="col" aria-sort={ariaSort(item.key)} title={item.tip} className="px-5 py-5 text-left text-[15px] font-medium text-gray-600 print:px-1.5 print:py-2 print:text-xs">
                  {sortLink(item.key, item.label)}
                  <span className="sr-only">: {item.tip}</span>
                </th>
              ))}
            </tr>
          </thead>
          {totals.classes === 0 && totals.cancelledClasses === 0 && <tbody className="print:hidden"><tr><td colSpan={7} className="border-b border-gray-100 px-5 py-6 text-center text-sm text-gray-600">No class sessions in this period. Try a wider date range.</td></tr></tbody>}
          <PaginatedTableRows itemLabel="branch report rows" colSpan={7} pinnedRows={1}>
            {rows.map((branch, index) => <ReportRow key={branch.branchId} branchId={branch.branchId} rowNumber={index + 1} name={branch.branchName} counts={branch} detailQuery={detailQuery} />)}
            <ReportRow name="All branches" rowNumber={null} counts={totals} />
          </PaginatedTableRows>
        </table>
      </div>
    </section>
  )
}
