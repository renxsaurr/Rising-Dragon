'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ScheduleModal from './AddScheduleModal'
import { Toast } from './Toast'
import { formatTime, formatTimeRange } from '@/utils/dates'
import ClassesForDayPanel from './ClassesForDayPanel'

export type Schedule = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  weekly_template_id?: number | null
  is_cross_branch_override?: boolean
  absence_report_id?: number | null
  status: 'Scheduled' | 'Cancelled' | 'Completed'
  branch: { name: string } | null
  coach: { name: string } | null
}

function toDateISO(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateISO(d)
}

function getWeekStart(d: Date) {
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return toDateISO(monday)
}

function minutes(value: string) {
  const [hours, mins] = value.slice(0, 5).split(':').map(Number)
  return hours * 60 + mins
}

const START_HOUR = 7
const END_HOUR = 22
const HOUR_HEIGHT = 54

export default function WeeklyScheduleBoard({
  weekDates,
  initialSchedules,
  branches,
  coaches,
  isHeadCoach,
  rightPanel,
}: {
  weekDates: string[]
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string; primary_branch_id: number | null; primary_branch_name: string | null }[]
  isHeadCoach: boolean
  rightPanel?: ReactNode
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [modalDate, setModalDate] = useState<string>(weekDates[0])
  const [selectedDate, setSelectedDate] = useState<string>(weekDates.includes(toDateISO(new Date())) ? toDateISO(new Date()) : weekDates[0])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setSchedules(initialSchedules), [initialSchedules])
  useEffect(() => {
    if (!weekDates.includes(selectedDate)) setSelectedDate(weekDates.includes(toDateISO(new Date())) ? toDateISO(new Date()) : weekDates[0])
  }, [weekDates, selectedDate])

  const today = toDateISO(new Date())
  const isCurrentWeek = weekDates[0] === getWeekStart(new Date())
  const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const goToWeek = (date: string) => router.push(`/scheduling?view=week&date=${date}`)
  const openEdit = (schedule: Schedule) => {
    setSelectedDate(schedule.date)
    setEditingSchedule(schedule)
    setModalDate(schedule.date)
    setShowModal(true)
  }

  const hourLabels = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index)
  const calendarHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
    <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">{isHeadCoach ? 'Weekly schedule' : 'My schedule'}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{dayLabel(weekDates[0])} – {dayLabel(weekDates[6])}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goToWeek(shiftDate(weekDates[0], -7))} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous week">‹</button>
          <button type="button" onClick={() => goToWeek(getWeekStart(new Date()))} disabled={isCurrentWeek} className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:text-gray-300">Today</button>
          <button type="button" onClick={() => goToWeek(shiftDate(weekDates[0], 7))} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next week">›</button>
        </div>
      </div>

      <div className="overflow-auto">
        <div className="min-w-[760px]">
          <div className="sticky top-0 z-20 grid grid-cols-[54px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-white">
            <div className="border-r border-gray-100" />
            {weekDates.map((date) => <button type="button" key={date} onClick={() => setSelectedDate(date)} className={`min-w-0 border-r border-gray-100 px-1 py-3 text-center ${date === selectedDate ? 'bg-blue-50' : ''}`}>
              <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">{new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${date === today ? 'bg-black text-white' : 'text-gray-800'}`}>{new Date(`${date}T00:00:00`).getDate()}</span>
            </button>)}
          </div>

          <div className="grid grid-cols-[54px_repeat(7,minmax(0,1fr))]">
            <div className="relative border-r border-gray-100" style={{ height: calendarHeight }}>
              {hourLabels.map((hour) => <div key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-gray-400" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>{formatTime(`${String(hour).padStart(2, '0')}:00`)}</div>)}
            </div>
            {weekDates.map((date) => {
              const daySchedules = schedules.filter((schedule) => schedule.date === date).sort((a, b) => a.time_start.localeCompare(b.time_start))
              const laneEnds: number[] = []
              const positioned = daySchedules.map((schedule) => {
                const start = minutes(schedule.time_start)
                const end = minutes(schedule.time_end)
                let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
                if (lane < 0) lane = laneEnds.length
                laneEnds[lane] = end
                return { schedule, start, end, lane }
              })
              const lanes = Math.max(1, laneEnds.length)
              return <div key={date} onClick={() => setSelectedDate(date)} className={`relative border-r border-gray-100 ${date === selectedDate ? 'bg-blue-50/30' : ''}`} style={{ height: calendarHeight }}>
                {hourLabels.map((hour) => <div key={hour} className="absolute inset-x-0 border-t border-gray-100" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />)}
                <div className="absolute inset-x-0 border-t border-gray-100" style={{ top: calendarHeight }} />
                {positioned.map(({ schedule, start, end, lane }) => {
                  const top = (start - START_HOUR * 60) / 60 * HOUR_HEIGHT
                  const height = Math.max(30, (end - start) / 60 * HOUR_HEIGHT - 2)
                  const left = `calc(${(lane / lanes) * 100}% + 2px)`
                  const width = `calc(${100 / lanes}% - 4px)`
                  const accent = schedule.status === 'Cancelled' ? 'border-l-red-400 bg-red-50' : schedule.absence_report_id ? 'border-l-blue-500 bg-blue-50' : 'border-l-rose-500 bg-gray-50'
                  return <button key={schedule.id} type="button" onClick={(event) => { event.stopPropagation(); openEdit(schedule) }} disabled={!isHeadCoach} className={`absolute z-10 overflow-hidden rounded-sm border border-gray-200 border-l-[3px] ${accent} px-2 py-1 text-left leading-tight shadow-sm transition hover:z-20 hover:shadow-md disabled:cursor-default ${schedule.status === 'Cancelled' ? 'opacity-60' : ''}`} style={{ top, height, left, width }} title={`${schedule.coach?.name ?? 'Unassigned'} · ${schedule.branch?.name ?? 'Unknown branch'} · ${formatTimeRange(schedule.time_start, schedule.time_end)}`}>
                    <span className={`block truncate text-[11px] font-semibold text-gray-900 ${schedule.status === 'Cancelled' ? 'line-through' : ''}`}>{schedule.coach?.name ?? 'Unassigned'}</span>
                    <span className="block truncate text-[10px] text-gray-600">{schedule.branch?.name ?? 'Unknown branch'}</span>
                    <span className="block truncate text-[10px] text-gray-500">{formatTimeRange(schedule.time_start, schedule.time_end)}</span>
                  </button>
                })}
              </div>
            })}
          </div>
        </div>
      </div>
    </section>

    <div className="flex min-w-0 flex-col gap-4">
      <ClassesForDayPanel date={selectedDate} schedules={schedules.filter((schedule) => schedule.date === selectedDate).sort((a, b) => a.time_start.localeCompare(b.time_start))} isHeadCoach={isHeadCoach} onEdit={openEdit} />
      {rightPanel}
    </div>

    {showModal && isHeadCoach && <ScheduleModal weekDates={weekDates} branches={branches} coaches={coaches} initialDate={modalDate} editingSchedule={editingSchedule} onClose={() => { setShowModal(false); setEditingSchedule(null) }} onCreated={(newSchedule) => { setSchedules((current) => [...current, newSchedule]); setToast('Schedule added'); router.refresh() }} onUpdated={(updated) => { setSchedules((current) => current.map((schedule) => schedule.id === updated.id ? updated : schedule)); setToast('Schedule updated'); router.refresh() }} onDeleted={(deletedId) => { setSchedules((current) => current.filter((schedule) => schedule.id !== deletedId)); setToast('Schedule deleted'); router.refresh() }} />}
    {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
  </div>
}
