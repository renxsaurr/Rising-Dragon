'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ScheduleModal from './AddScheduleModal'
import ClassesForDayPanel from './ClassesForDayPanel'
import { Toast } from './Toast'
import type { Schedule } from './WeeklyScheduleBoard'

function toDateISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftMonth(monthISO: string, months: number) {
  const [year, month] = monthISO.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getCalendarWeeks(monthISO: string) {
  const [year, month] = monthISO.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1, 12)
  const offset = (firstDay.getDay() + 6) % 7
  const dayCount = new Date(year, month, 0, 12).getDate()
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7
  const dates = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month - 1, index - offset + 1, 12)
    return toDateISO(date)
  })
  return Array.from({ length: cellCount / 7 }, (_, index) => dates.slice(index * 7, index * 7 + 7))
}

export default function DailyScheduleBoard({
  dateISO,
  initialSchedules,
  branches,
  coaches,
  isHeadCoach,
  sidebarContent,
}: {
  dateISO: string
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string; primary_branch_id: number | null; primary_branch_name: string | null }[]
  isHeadCoach: boolean
  sidebarContent?: ReactNode
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [selectedDate, setSelectedDate] = useState(dateISO)
  const [visibleMonth, setVisibleMonth] = useState(dateISO.slice(0, 7))
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setSchedules(initialSchedules), [initialSchedules])
  useEffect(() => {
    setSelectedDate(dateISO)
    setVisibleMonth(dateISO.slice(0, 7))
  }, [dateISO])

  const daySchedules = useMemo(() => schedules
    .filter((schedule) => schedule.date === selectedDate)
    .sort((a, b) => a.time_start.localeCompare(b.time_start)), [schedules, selectedDate])
  const today = toDateISO(new Date())
  const monthLabel = new Date(`${visibleMonth}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const calendarWeeks = getCalendarWeeks(visibleMonth)

  const navigateToDate = (nextDate: string) => {
    setSelectedDate(nextDate)
    router.push(`/scheduling?date=${nextDate}`)
  }

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setShowModal(true)
  }

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.6fr)]">
    <section className="flex h-[420px] flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))} aria-label="Previous month" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m15 18-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <h1 className="text-base font-semibold tracking-tight text-gray-950">{monthLabel}</h1>
        <button type="button" onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))} aria-label="Next month" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m9 18 6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-700" aria-hidden="true">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((weekday) => <span key={weekday} className="py-2">{weekday}</span>)}
      </div>
      <div className="space-y-1.5">
        {calendarWeeks.map((week) => <div key={week[0]} className="grid grid-cols-7 rounded-xl bg-gray-50 p-0.5">
          {week.map((day) => {
            const inMonth = day.startsWith(visibleMonth)
            const isSelected = day === selectedDate
            const isToday = day === today
            return <button
              key={day}
              type="button"
              onClick={() => navigateToDate(day)}
              aria-pressed={isSelected}
              aria-label={new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-lg text-sm transition-colors ${isSelected ? 'bg-black font-semibold text-white shadow-sm' : isToday ? 'font-semibold text-gray-950 ring-1 ring-inset ring-gray-300' : inMonth ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-300 hover:bg-white hover:text-gray-500'}`}
            >{Number(day.slice(-2))}</button>
          })}
        </div>)}
      </div>
      <p className="mt-auto border-t border-gray-100 pt-3 text-center text-xs font-medium text-gray-600">Click a date to view classes</p>
    </section>

    <div className="space-y-5">
      <ClassesForDayPanel date={selectedDate} schedules={daySchedules} isHeadCoach={isHeadCoach} onEdit={openEditModal} />
      {sidebarContent}
    </div>

    {showModal && isHeadCoach && <ScheduleModal
      branches={branches}
      coaches={coaches}
      editingSchedule={editingSchedule}
      initialDate={selectedDate}
      onClose={() => { setShowModal(false); setEditingSchedule(null) }}
      onCreated={(schedule) => { setSchedules((current) => [...current, schedule]); setToast('Schedule added'); router.refresh() }}
      onUpdated={(updated) => { setSchedules((current) => current.map((schedule) => schedule.id === updated.id ? updated : schedule)); setToast('Schedule updated'); router.refresh() }}
      onDeleted={(deletedId) => { setSchedules((current) => current.filter((schedule) => schedule.id !== deletedId)); setToast('Schedule deleted'); router.refresh() }}
    />}
    {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
  </div>
}
