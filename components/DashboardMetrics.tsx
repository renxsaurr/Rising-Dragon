import Link from 'next/link'
import { ArrowUpRight, CalendarDays, ClipboardCheck, UsersRound, WalletCards } from 'lucide-react'

export type DashboardMetric = {
  id: 'students' | 'classes' | 'attendance' | 'payments'
  label: string
  value: number
  note: string
}

const metricIcons = {
  students: UsersRound,
  classes: CalendarDays,
  attendance: ClipboardCheck,
  payments: WalletCards,
} as const

export default function DashboardMetrics({ metrics, isHeadCoach }: { metrics: DashboardMetric[]; isHeadCoach: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5 ${isHeadCoach ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {metrics.map((metric) => {
        const Icon = metricIcons[metric.id]
        return (
          <Link
            key={metric.id}
            href={`/dashboard/metrics/${metric.id}`}
            aria-label={`View ${metric.label.toLowerCase()} details`}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm shadow-gray-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-5 text-gray-900">{metric.label}</span>
                <span className="mt-3 block text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">{metric.value}</span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-950 ring-1 ring-inset ring-gray-200/80">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs leading-5 text-gray-700">
              <span>{metric.note}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
