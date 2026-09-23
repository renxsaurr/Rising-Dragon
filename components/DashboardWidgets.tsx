import Link from 'next/link'
import type { ReactNode } from 'react'

export function Card({ title, chip, action, children, className = '', flush = false }: {
  title: string
  chip?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
        {chip && <span className="chip">{chip}</span>}
        {action}
      </div>
      <div className={flush ? '' : 'px-5 pb-5'}>{children}</div>
    </section>
  )
}

const ArrowUp = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-6 6l6-6 6 6" /></svg>
const ArrowDown = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-6-6l6 6 6-6" /></svg>

export function Delta({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null || value === 0) return null
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[13px] font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? <ArrowUp /> : <ArrowDown />}{Math.abs(value)}{suffix}
    </span>
  )
}

export function StatCard({ title, chip, value, delta, compare, footer }: {
  title: string
  chip: string
  value: string | number
  delta?: ReactNode
  compare: string
  footer: { label: string; value: string | number }
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-[15px] font-medium text-gray-700">{title}</h3>
        <span className="chip">{chip}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-[28px] font-bold leading-none tracking-tight text-gray-950 tabular-nums">{value}</p>
        {delta}
      </div>
      <p className="mt-3 text-xs text-gray-400">{compare}</p>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{footer.label}</span>
        <span className="font-medium tabular-nums text-gray-700">{footer.value}</span>
      </div>
    </section>
  )
}

// Two-segment donut (present / absent) with a legend that carries the numbers.
export function AttendanceDonut({ present, absent }: { present: number; absent: number }) {
  const total = present + absent
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const gap = total && present && absent ? 3 : 0
  const presentLength = total ? (present / total) * circumference : 0
  const segments = [
    { label: 'Present', value: present, color: 'stroke-emerald-500', dot: 'bg-emerald-500', length: Math.max(presentLength - gap, 0), offset: 0 },
    { label: 'Absent', value: absent, color: 'stroke-red-500', dot: 'bg-red-500', length: Math.max(circumference - presentLength - gap, 0), offset: presentLength },
  ]

  return (
    <div>
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={total ? `${present} present, ${absent} absent` : 'No attendance recorded'}>
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="11" className="stroke-gray-100" />
          {total > 0 && segments.map((segment) => segment.value > 0 && (
            <circle
              key={segment.label}
              cx="50" cy="50" r={radius} fill="none" strokeWidth="11"
              className={segment.color}
              strokeDasharray={`${segment.length} ${circumference}`}
              strokeDashoffset={-segment.offset}
            >
              <title>{`${segment.label}: ${segment.value}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-bold tabular-nums text-gray-950">{total}</p>
            <p className="text-[11px] text-gray-400">check-ins</p>
          </div>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5 text-gray-700"><span className={`h-3 w-3 rounded-full ${segment.dot}`} />Total {segment.label.toLowerCase()}</span>
            <span className="tabular-nums text-gray-700">{total ? Math.round((segment.value / total) * 100) : 0}% <span className="text-gray-400">· {segment.value}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Avatar({ name, soft = false }: { name: string; soft?: boolean }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${soft ? 'h-8 w-8 bg-red-50 text-[11px] text-red-700' : 'h-7 w-7 bg-gray-900 text-[10px] text-white'}`}>
      {initials}
    </span>
  )
}

export type StatusTone = 'green' | 'red' | 'amber' | 'gray'
const TONE_DOT: Record<StatusTone, string> = { green: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-400', gray: 'bg-gray-300' }

export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-gray-500">
      <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[tone]}`} />{label}
    </span>
  )
}

export type ClassRow = { id: number; date: string; time: string; branch: string; coach: string; status: { tone: StatusTone; label: string } }

export function ClassTable({ rows, showDate = false }: { rows: ClassRow[]; showDate?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="th w-14">No.</th>
            <th className="th">{showDate ? 'Date & time' : 'Time'}</th>
            <th className="th">Branch</th>
            <th className="th">Coach</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <tr key={row.id} className="group">
              <td className="px-5 py-3 text-[13px] tabular-nums text-gray-500">{String(index + 1).padStart(2, '0')}</td>
              <td className="px-5 py-3">
                <span className="inline-block whitespace-nowrap rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium tabular-nums text-gray-700">
                  {showDate && `${new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, `}{row.time}
                </span>
              </td>
              <td className="px-5 py-3">
                <Link href={`/attendance?date=${row.date}&scheduleId=${row.id}`} className="text-sm font-medium text-gray-900 hover:text-red-600">{row.branch}</Link>
              </td>
              <td className="px-5 py-3"><span className="flex items-center gap-2.5 text-sm text-gray-700"><Avatar name={row.coach} />{row.coach}</span></td>
              <td className="px-5 py-3"><StatusDot tone={row.status.tone} label={row.status.label} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">{children}</p>
}
