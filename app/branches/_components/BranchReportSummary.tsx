import Link from 'next/link'
import { ArrowUpRight, CalendarDays, ClipboardCheck, TriangleAlert, UsersRound } from 'lucide-react'
import { Card } from '@/components/DashboardWidgets'
import type { BranchCounts, BranchReport, BranchReportRow, ReportComparison } from '@/utils/branch-reports'
import { DROP_ALERT_POINTS, FAIR_RATE, LOW_DATA_MARKS, cardClass, formatRange, isLowData, marksOf, ratePercent } from '@/utils/branch-report-format'

// shared by the Branch reports tab and the branch detail page

type Change = { value: string; direction?: 'up' | 'down'; className: string }
type Issue = { branchId: number; branchName: string; rank: number; weight: number; message: string }

const MAX_ISSUES = 6
// -mx-2 px-2 gives the hover tint some room without moving the text or the dividers
const rowClass = '-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm'
const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`

function kpiChange(kind: 'classes' | 'rate' | 'avg', current: BranchCounts, comparison: ReportComparison | null): Change {
  const previous = comparison?.report?.totals
  const noData = { value: 'No data to compare', className: 'text-gray-400' }
  if (!previous) return comparison?.failed ? { value: 'Previous period unavailable', className: 'text-gray-400' } : noData

  if (kind === 'classes') {
    if (previous.classes === 0) return noData
    const diff = current.classes - previous.classes
    // more classes is not good or bad, so this change stays neutral gray
    return { value: diff === 0 ? 'No change' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`, className: 'text-gray-600' }
  }

  if (marksOf(previous) === 0) return noData
  if (isLowData(current) || isLowData(previous)) return { value: 'Low data', className: 'text-gray-400' }
  const diff = kind === 'rate'
    ? ratePercent(current.attendanceRate!) - ratePercent(previous.attendanceRate!)
    : Math.round((current.avgPresentPerClass! - previous.avgPresentPerClass!) * 10) / 10
  if (diff === 0) return { value: 'No change', className: 'text-gray-600' }
  return {
    value: kind === 'rate' ? `${Math.abs(diff)} pts` : Math.abs(diff).toFixed(1),
    direction: diff > 0 ? 'up' : 'down',
    // a higher rate or average is good
    className: diff > 0 ? 'text-emerald-600' : 'text-red-600',
  }
}

// rank: 0–1 urgent (red), 2–3 review (amber), 4 note (gray); lower rank = more serious
function findIssues(branches: BranchReportRow[], previous: BranchReport | null): Issue[] {
  const previousById = new Map((previous?.branches ?? []).map((branch) => [branch.branchId, branch]))
  const issues: Issue[] = []
  for (const branch of branches) {
    const add = (rank: number, weight: number, message: string) =>
      issues.push({ branchId: branch.branchId, branchName: branch.branchName, rank, weight, message })
    const marks = marksOf(branch)
    const before = previousById.get(branch.branchId)

    if (branch.attendanceRate !== null && marks >= LOW_DATA_MARKS) {
      const rate = ratePercent(branch.attendanceRate)
      if (rate < FAIR_RATE) add(0, FAIR_RATE - rate, `attendance rate is ${rate}%, below ${FAIR_RATE}%`)
      if (before && before.attendanceRate !== null && marksOf(before) >= LOW_DATA_MARKS) {
        const drop = ratePercent(before.attendanceRate) - rate
        if (drop >= DROP_ALERT_POINTS) add(1, drop, `attendance rate fell ${drop} pts (${ratePercent(before.attendanceRate)}% → ${rate}%)`)
      }
    }
    if (branch.incompletePastClasses) add(2, branch.incompletePastClasses, `${count(branch.incompletePastClasses, 'past class', 'past classes')} not fully marked · ${count(branch.unmarkedStudentMarks, 'attendance mark', 'attendance marks')} missing`)
    if (branch.cancelledClasses) add(3, branch.cancelledClasses, `${count(branch.cancelledClasses, 'class', 'classes')} cancelled`)
    if (branch.classes > 0 && marks < LOW_DATA_MARKS) {
      add(4, LOW_DATA_MARKS - marks, marks ? `only ${count(marks, 'attendance mark', 'attendance marks')}, too few for a reliable rate` : 'no attendance marked yet')
    }
  }
  return issues.sort((a, b) => a.rank - b.rank || b.weight - a.weight || a.branchName.localeCompare(b.branchName))
}

function issueTone(rank: number) {
  if (rank <= 1) return { dot: 'bg-red-500', tag: 'Urgent', tagClass: 'bg-red-50 text-red-700' }
  if (rank <= 3) return { dot: 'bg-amber-400', tag: 'Review', tagClass: 'bg-amber-50 text-amber-700' }
  return { dot: 'bg-gray-300', tag: 'Note', tagClass: 'bg-gray-100 text-gray-600' }
}

export function ReportKpis({ totals, comparison }: { totals: BranchCounts; comparison: ReportComparison | null }) {
  const previousLabel = comparison && formatRange(comparison.start, comparison.end, false)
  const kpis = [
    { label: 'Active students', value: String(totals.activeStudents), change: null, Icon: UsersRound },
    { label: 'Classes', value: String(totals.classes), change: kpiChange('classes', totals, comparison), Icon: CalendarDays },
    { label: 'Attendance rate', value: totals.attendanceRate === null ? null : `${ratePercent(totals.attendanceRate)}%`, change: kpiChange('rate', totals, comparison), Icon: ClipboardCheck },
    { label: 'Avg. present per class', value: totals.avgPresentPerClass === null ? null : totals.avgPresentPerClass.toFixed(1), change: kpiChange('avg', totals, comparison), Icon: UsersRound },
  ]

  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 print:grid-cols-4">
      {kpis.map((kpi) => (
        <article key={kpi.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-gray-950">{kpi.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{kpi.value ?? '—'}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-950 ring-1 ring-inset ring-gray-200/80">
              <kpi.Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3 text-xs leading-5">
            {kpi.change ? <>
              <p className={`font-medium ${kpi.change.className}`}>
                {kpi.change.direction && <>
                  <span aria-hidden>{kpi.change.direction === 'up' ? '▲' : '▼'} </span>
                  <span className="sr-only">{kpi.change.direction === 'up' ? 'Up' : 'Down'} </span>
                </>}
                {kpi.change.value}
              </p>
              {previousLabel && <p className="mt-0.5 text-gray-700">vs {previousLabel}</p>}
            </> : <p className="text-gray-700">{kpi.value === null ? 'No attendance marked' : 'As of today'}</p>}
          </div>
        </article>
      ))}
    </section>
  )
}

export function NeedsAttention({ branches, comparison, detailQuery = '', single = false }: {
  branches: BranchReportRow[]
  comparison: ReportComparison | null
  detailQuery?: string
  // one branch's own page: no branch name and no link back to itself
  single?: boolean
}) {
  const issues = findIssues(branches, comparison?.report ?? null)
  if (issues.length === 0) return null
  return (
    <Card title={<><TriangleAlert className="h-4 w-4 text-gray-950" aria-hidden />Needs attention</>} titleClassName="text-base font-semibold tracking-tight text-gray-950" chip={issues.length ? String(issues.length) : undefined} className={`${cardClass} print:break-inside-avoid`}>
      <>
        <ul className="-mt-1 divide-y divide-gray-100">
          {issues.slice(0, MAX_ISSUES).map((issue) => {
            const tone = issueTone(issue.rank)
            const content = <>
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
              <span className="min-w-0 flex-1 text-gray-600">
                {single
                  ? issue.message.charAt(0).toUpperCase() + issue.message.slice(1)
                  : <><span className="font-medium text-gray-900">{issue.branchName}</span>: {issue.message}</>}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone.tagClass}`}>{tone.tag}</span>
            </>
            return (
              <li key={`${issue.branchId}-${issue.rank}`}>
                {single
                  ? <div className={rowClass}>{content}</div>
                  : <Link href={`/branches/${issue.branchId}${detailQuery && `?${detailQuery}`}`} className={rowClass}>
                    {content}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-700 print:hidden" aria-hidden />
                  </Link>}
              </li>
            )
          })}
        </ul>
        {issues.length > MAX_ISSUES && (
          <p className="mt-2 text-xs text-gray-400">+ {issues.length - MAX_ISSUES} more. Pick fewer branches to see them.</p>
        )}
      </>
    </Card>
  )
}
