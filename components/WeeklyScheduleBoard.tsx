'use client'

import { useState } from 'react'
import AddScheduleModal from './AddScheduleModal'

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
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showModal, setShowModal] = useState(false)

  const dayLabel = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-black">This Week's Schedule</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {weekDates[0]} to {weekDates[6]}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
        >
          + Add Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((date) => (
          <div key={date} className="bg-white border border-gray-100 rounded-lg p-3 min-h-[180px]">
            <p className="font-semibold text-[12px] text-gray-700 mb-2">{dayLabel(date)}</p>
            <div className="space-y-2">
              {schedules
                .filter((s) => s.date === date)
                .map((s) => (
                  <div key={s.id} className="bg-red-50 border border-red-100 rounded p-2 text-[11px]">
                    <p className="font-semibold text-black">{s.Branch?.name ?? 'Unknown branch'}</p>
                    <p className="text-gray-500">{s.User?.name ?? 'Unassigned'}</p>
                    <p className="text-gray-500">{s.time_start} – {s.time_end}</p>
                  </div>
                ))}
              {schedules.filter((s) => s.date === date).length === 0 && (
                <p className="text-[11px] text-gray-300">No classes</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <AddScheduleModal
          weekDates={weekDates}
          branches={branches}
          coaches={coaches}
          existingSchedules={schedules}
          onClose={() => setShowModal(false)}
          onCreated={(newSchedule: Schedule) => setSchedules([...schedules, newSchedule])}
        />
      )}
    </div>
  )
}