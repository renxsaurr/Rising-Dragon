'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ScheduleModal from './AddScheduleModal'
import { Toast } from './Toast'

export type Schedule = {
  id: number
  date: string
  time_start: string
  time_end: string
  branch_id: number
  coach_id: number
  Branch: { name: string } | null
  User: { name: string } | null
}

function toDateISO(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const BRANCH_COLORS = [
  { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
  { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500' },
  { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-50', border: 'border-purple-100', dot: 'bg-purple-500' },
]
function branchColor(branchId: number) {
  return BRANCH_COLORS[branchId % BRANCH_COLORS.length]
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
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
}: {
  weekDates: string[]
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const today = toDateISO(new Date())
  const isCurrentWeek = weekDates[0] === getWeekStart(new Date())

  const dayLabel = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const goToWeek = (dateStr: string) => router.push(`/scheduling?view=week&date=${dateStr}`)

  return (
    <div>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pt-1 pb-4">
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

            <button
              onClick={() => { setEditingSchedule(null); setShowModal(true) }}
              className="ml-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              + Add Schedule
            </button>
          </div>
        </div>

        {branches.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {branches.map((b) => {
              const color = branchColor(b.id)
              return (
                <div key={b.id} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  <span className="text-[12px] text-gray-500">{b.name}</span>
                </div>
              )
            })}
          </div>
        )}
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
              className={`group rounded-lg p-3 min-h-[180px] border ${
                isToday ? 'bg-red-50/40 border-red-200' : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`font-semibold text-[12px] flex items-center gap-1.5 ${isToday ? 'text-red-600' : 'text-gray-700'}`}>
                  {dayLabel(date)}
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                </p>
                <button
                  onClick={() => { setEditingSchedule(null); setShowModal(true) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 text-[13px] leading-none transition-opacity"
                  aria-label="Add schedule"
                >
                  +
                </button>
              </div>

              <div className="space-y-2">
                {daySchedules.map((s) => {
                  const color = branchColor(s.branch_id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setEditingSchedule(s); setShowModal(true) }}
                      className={`w-full text-left ${color.bg} border ${color.border} rounded p-2 text-[11px] hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${color.dot} shrink-0`} />
                        <p className="font-semibold text-black truncate">{s.Branch?.name ?? 'Unknown branch'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-4 h-4 rounded-full ${color.dot} text-white text-[8px] font-semibold flex items-center justify-center shrink-0`}>
                          {initials(s.User?.name)}
                        </span>
                        <p className="text-gray-500 truncate">{s.User?.name ?? 'Unassigned'}</p>
                      </div>
                      <p className="text-gray-500 mt-0.5">{s.time_start} – {s.time_end}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <ScheduleModal
          weekDates={weekDates}
          branches={branches}
          coaches={coaches}
          existingSchedules={schedules}
          editingSchedule={editingSchedule}
          onClose={() => { setShowModal(false); setEditingSchedule(null) }}
          onCreated={(newSchedule) => { setSchedules([...schedules, newSchedule]); setToast('Schedule added') }}
          onUpdated={(updated) => { setSchedules(schedules.map((s) => (s.id === updated.id ? updated : s))); setToast('Schedule updated') }}
          onDeleted={(id) => { setSchedules(schedules.filter((s) => s.id !== id)); setToast('Schedule deleted') }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}