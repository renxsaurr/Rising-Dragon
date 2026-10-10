'use client'

import type { Schedule } from './WeeklyScheduleBoard'
import { formatTimeRange } from '@/utils/dates'

export default function ClassesForDayPanel({
  date,
  schedules,
  isHeadCoach,
  onEdit,
}: {
  date: string
  schedules: Schedule[]
  isHeadCoach: boolean
  onEdit: (schedule: Schedule) => void
}) {
  const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return <section className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="shrink-0 border-b border-gray-100 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-gray-950">Classes</h2>
      <p className="mt-1 text-sm font-medium text-gray-900">{dayLabel}</p>
    </div>
    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4">
      {schedules.length === 0 ? <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm font-medium text-gray-900">No classes scheduled for this day.</p> : schedules.map((schedule, index) => {
        const accent = schedule.status === 'Cancelled' ? 'border-l-red-400' : schedule.absence_report_id ? 'border-l-blue-500' : index % 2 === 0 ? 'border-l-rose-500' : 'border-l-sky-500'
        const content = <>
          <p className={`break-words text-sm font-semibold text-gray-950 ${schedule.status === 'Cancelled' ? 'line-through' : ''}`}>{schedule.coach?.name ?? 'Unassigned coach'}</p>
          <p className="mt-0.5 break-words text-sm font-medium text-gray-800">{schedule.branch?.name ?? 'Unknown branch'}</p>
          <p className="mt-1 text-sm font-medium text-gray-800">{formatTimeRange(schedule.time_start, schedule.time_end)}{schedule.status !== 'Scheduled' ? ` · ${schedule.status}` : ''}{schedule.absence_report_id ? ' · Cover' : ''}</p>
        </>
        return isHeadCoach
          ? <button key={schedule.id} type="button" onClick={() => onEdit(schedule)} className={`block w-full rounded-xl border border-gray-200 border-l-4 ${accent} bg-gray-50/70 px-3.5 py-3 text-left transition-colors hover:bg-white`}>{content}</button>
          : <article key={schedule.id} className={`rounded-xl border border-gray-200 border-l-4 ${accent} bg-gray-50/70 px-3.5 py-3`}>{content}</article>
      })}
    </div>
  </section>
}
