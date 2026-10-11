import { CalendarDays, ClipboardCheck, UsersRound } from 'lucide-react'
import type { BranchCounts } from '@/utils/branch-reports'
import { ratePercent } from '@/utils/branch-report-format'

// Summary metrics for the Branch reports tab.

export function ReportKpis({ totals }: { totals: BranchCounts }) {
  const kpis = [
    {
      label: 'Class sessions',
      value: String(totals.classes),
      Icon: CalendarDays,
    },
    {
      label: 'Attendance records',
      value: String(totals.recordedMarks),
      Icon: ClipboardCheck,
    },
    {
      label: 'Recording coverage',
      value: totals.recordingCoverage === null ? null : `${ratePercent(totals.recordingCoverage)}%`,
      Icon: UsersRound,
    },
    {
      label: 'Recorded attendance rate',
      value: totals.attendanceRate === null ? null : `${ratePercent(totals.attendanceRate)}%`,
      Icon: UsersRound,
    },
  ]

  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 print:grid-cols-4">
      {kpis.map((kpi) => (
        <article key={kpi.label} className="min-h-[9rem] rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/[0.03] print:break-inside-avoid">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-gray-950">{kpi.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{kpi.value ?? '—'}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-950 ring-1 ring-inset ring-gray-200/80">
              <kpi.Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          </div>
        </article>
      ))}
    </section>
  )
}
