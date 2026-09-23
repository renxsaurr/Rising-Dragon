'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ScheduleModal from './AddScheduleModal'
import { Toast } from './Toast'
import type { Schedule } from './WeeklyScheduleBoard'

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

function shiftMonth(dateISO: string, months: number) {
  const d = new Date(dateISO + 'T00:00:00')
  d.setMonth(d.getMonth() + months, 1)
  return toDateISO(d)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MonthlyScheduleBoard({
  monthDates,
  baseDateISO,
  initialSchedules,
  branches,
  coaches,
}: {
  monthDates: string[]
  baseDateISO: string
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [modalDate, setModalDate] = useState<string>(baseDateISO)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const now = new Date()
  const today = toDateISO(now)
  const activeMonth = new Date(baseDateISO + 'T00:00:00').getMonth()
  const activeYear = new Date(baseDateISO + 'T00:00:00').getFullYear()
  const isCurrentMonth = activeMonth === now.getMonth() && activeYear === now.getFullYear()

  const monthLabel = new Date(baseDateISO + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const goToMonth = (dateISO: string) => router.push(`/scheduling?view=month&date=${dateISO}`)

  const openAddModal = (dateISO: string) => {
    setEditingSchedule(null)
    setModalDate(dateISO)
    setShowModal(true)
  }

  const openEditModal = (s: Schedule) => {
    setEditingSchedule(s)
    setModalDate(s.date)
    setShowModal(true)
  }

  return (
    <div>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pt-1 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-black">{monthLabel}</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">Monthly overview</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToMonth(shiftMonth(baseDateISO, -1))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goToMonth(toDateISO(new Date()))}
              disabled={isCurrentMonth}
              className={`h-9 px-3 border rounded-lg text-[13px] font-medium transition-colors ${
                isCurrentMonth
                  ? 'border-gray-100 text-gray-300 cursor-default'
                  : 'border-gray-200 hover:bg-gray-50 text-black'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => goToMonth(shiftMonth(baseDateISO, 1))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => openAddModal(today)}
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

      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-gray-50 px-2 py-2 text-[11px] font-semibold text-gray-500 text-center">
            {label}
          </div>
        ))}

        {monthDates.map((dateISO) => {
          const d = new Date(dateISO + 'T00:00:00')
          const inMonth = d.getMonth() === activeMonth
          const isToday = dateISO === today
          const daySchedules = schedules
            .filter((s) => s.date === dateISO)
            .sort((a, b) => a.time_start.localeCompare(b.time_start))
          const visible = daySchedules.slice(0, 3)
          const overflow = daySchedules.length - visible.length

          return (
            <div
              key={dateISO}
              className={`relative min-h-[110px] p-1.5 group ${inMonth ? 'bg-white' : 'bg-gray-50/50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[12px] w-5 h-5 flex items-center justify-center rounded ${
                    isToday
                      ? 'bg-red-600 text-white font-semibold'
                      : inMonth
                      ? 'text-gray-700'
                      : 'text-gray-300'
                  }`}
                >
                  {d.getDate()}
                </span>
                <button
                  onClick={() => openAddModal(dateISO)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 text-[13px] leading-none transition-opacity"
                  aria-label="Add schedule"
                >
                  +
                </button>
              </div>

              <div className="space-y-1">
                {visible.map((s) => {
                  const color = branchColor(s.branch_id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => openEditModal(s)}
                      className={`w-full text-left ${color.bg} border ${color.border} rounded px-1.5 py-0.5 text-[10px] hover:shadow-sm transition-shadow truncate flex items-center gap-1`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${color.dot} text-white text-[7px] font-semibold flex items-center justify-center shrink-0`}>
                        {initials(s.User?.name)}
                      </span>
                      <span className="truncate text-black">{s.User?.name ?? 'Unassigned'}</span>
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => setExpandedDate(dateISO)}
                    className="text-[10px] text-gray-400 hover:text-red-600 pl-1"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {expandedDate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setExpandedDate(null)}
        >
          <div
            className="bg-white rounded-xl p-5 w-full max-w-sm max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3 text-[14px]">
              {new Date(expandedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <div className="space-y-2">
              {schedules
                .filter((s) => s.date === expandedDate)
                .sort((a, b) => a.time_start.localeCompare(b.time_start))
                .map((s) => {
                  const color = branchColor(s.branch_id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setExpandedDate(null)
                        openEditModal(s)
                      }}
                      className={`w-full text-left ${color.bg} border ${color.border} rounded p-2 text-[12px] hover:shadow-sm transition-shadow`}
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
                      <p className="text-gray-500">{s.time_start} – {s.time_end}</p>
                    </button>
                  )
                })}
            </div>
            <button onClick={() => setExpandedDate(null)} className="mt-4 w-full border rounded-lg py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <ScheduleModal
          branches={branches}
          coaches={coaches}
          existingSchedules={schedules}
          editingSchedule={editingSchedule}
          initialDate={modalDate}
          onClose={() => {
            setShowModal(false)
            setEditingSchedule(null)
          }}
          onCreated={(newSchedule) => { setSchedules([...schedules, newSchedule]); setToast('Schedule added') }}
          onUpdated={(updated) => { setSchedules(schedules.map((s) => (s.id === updated.id ? updated : s))); setToast('Schedule updated') }}
          onDeleted={(id) => { setSchedules(schedules.filter((s) => s.id !== id)); setToast('Schedule deleted') }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}