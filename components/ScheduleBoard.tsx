'use client'

import { useRouter } from 'next/navigation'
import WeeklyScheduleBoard, { type Schedule } from './WeeklyScheduleBoard'
import MonthlyScheduleBoard from './MonthlyScheduleBoard'

export default function ScheduleBoard({
  view,
  weekDates,
  monthDates,
  baseDateISO,
  initialSchedules,
  branches,
  coaches,
}: {
  view: 'week' | 'month'
  weekDates: string[]
  monthDates: string[]
  baseDateISO: string
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
}) {
  const router = useRouter()

  const switchView = (nextView: 'week' | 'month') => {
    router.push(`/scheduling?view=${nextView}&date=${baseDateISO}`)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="relative inline-flex bg-gray-100 rounded-lg p-1 gap-1">
          {/* sliding active pill */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-black rounded-md transition-transform duration-200 ease-out"
            style={{ transform: view === 'week' ? 'translateX(0)' : 'translateX(calc(100% + 4px))' }}
          />

          <button
            onClick={() => switchView('week')}
            className={`relative z-10 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-150 ${
              view === 'week' ? 'text-white' : 'text-gray-500 hover:text-black hover:bg-white/60'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => switchView('month')}
            className={`relative z-10 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-150 ${
              view === 'month' ? 'text-white' : 'text-gray-500 hover:text-black hover:bg-white/60'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <WeeklyScheduleBoard
          weekDates={weekDates}
          initialSchedules={initialSchedules}
          branches={branches}
          coaches={coaches}
        />
      ) : (
        <MonthlyScheduleBoard
          monthDates={monthDates}
          baseDateISO={baseDateISO}
          initialSchedules={initialSchedules}
          branches={branches}
          coaches={coaches}
        />
      )}
    </div>
  )
}