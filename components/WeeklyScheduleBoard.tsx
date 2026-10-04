'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ScheduleModal from './AddScheduleModal'
import { Toast } from './Toast'
import { formatTimeRange } from '@/utils/dates'

export type Schedule = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
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

const BRANCH_COLOR = { bg: 'bg-white', border: 'border-gray-200', dot: 'bg-black' }
function branchColor(_branchId: number) {
  return BRANCH_COLOR
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateISO(d)
}

function getWeekStart(d: Date) {
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  return toDateISO(monday)
}

export default function WeeklyScheduleBoard({
  weekDates,
  initialSchedules,
  branches,
  coaches,
  isHeadCoach,
}: {
  weekDates: string[]
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
  isHeadCoach: boolean
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [modalDate, setModalDate] = useState<string>(weekDates[0])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setSchedules(initialSchedules), [initialSchedules])

  const today = toDateISO(new Date())
  const isCurrentWeek = weekDates[0] === getWeekStart(new Date())

  const dayLabel = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const goToWeek = (dateStr: string) => router.push(`/scheduling?view=week&date=${dateStr}`)

  return (
    <div>
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-black">
              {isCurrentWeek ? "This Week's Schedule" : 'Weekly Schedule'}
            </h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {dayLabel(weekDates[0])} – {dayLabel(weekDates[6])}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToWeek(shiftDate(weekDates[0], -7))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Previous week"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goToWeek(getWeekStart(new Date()))}
              disabled={isCurrentWeek}
              className={`h-9 px-3 border rounded-lg text-[13px] font-medium transition-colors ${
                isCurrentWeek
                  ? 'border-gray-100 text-gray-300 cursor-default'
                  : 'border-gray-200 hover:bg-gray-50 text-black'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => goToWeek(shiftDate(weekDates[0], 7))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Next week"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((date) => {
          const isToday = date === today
          const daySchedules = schedules
            .filter((s) => s.date === date)
            .sort((a, b) => a.time_start.localeCompare(b.time_start))

          return (
            <div
              key={date}
              className={`group rounded-xl p-3 min-h-[180px] border bg-white shadow-sm transition-colors ${
                isToday ? 'border-black ring-1 ring-black' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`font-semibold text-[12px] flex items-center gap-1.5 ${isToday ? 'text-black' : 'text-gray-700'}`}>
                  {dayLabel(date)}
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </p>
              </div>

              <div className="space-y-2">
                {daySchedules.map((s) => {
                  const color = branchColor(s.branch_id)
                  return (
                    <button
                      key={s.id}
                      onClick={isHeadCoach ? () => { setEditingSchedule(s); setModalDate(s.date); setShowModal(true) } : undefined}
                      disabled={!isHeadCoach}
                      className={`w-full text-left ${color.bg} border ${color.border} rounded-lg p-2 text-[11px] transition-shadow ${isHeadCoach ? 'hover:border-black hover:shadow-sm' : 'cursor-default'} ${s.status === 'Cancelled' ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${color.dot} shrink-0`} />
                        <p className={`font-semibold text-black truncate ${s.status === 'Cancelled' ? 'line-through' : ''}`}>{s.branch?.name ?? 'Unknown branch'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-gray-500 truncate">{s.coach?.name ?? 'Unassigned'}</p>
                      </div>
                      <p className="mt-0.5 text-gray-500">{formatTimeRange(s.time_start, s.time_end)}{s.status !== 'Scheduled' ? ` · ${s.status}` : ''}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && isHeadCoach && (
        <ScheduleModal
          weekDates={weekDates}
          branches={branches}
          coaches={coaches}
          initialDate={modalDate}
          editingSchedule={editingSchedule}
          onClose={() => { setShowModal(false); setEditingSchedule(null) }}
          onCreated={(newSchedule) => { setSchedules((current) => [...current, newSchedule]); setToast('Schedule added'); router.refresh() }}
          onUpdated={(updated) => { setSchedules((current) => current.map((s) => (s.id === updated.id ? updated : s))); setToast('Schedule updated'); router.refresh() }}
          onDeleted={(deletedId) => { setSchedules((current) => current.filter((s) => s.id !== deletedId)); setToast('Schedule deleted'); router.refresh() }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
