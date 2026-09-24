'use client'

import { useEffect, useRef, useState } from 'react'
import type { Schedule } from './WeeklyScheduleBoard'
import { deleteSchedule, saveSchedule } from '@/app/scheduling/actions'

function toDateISO(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AddScheduleModal({
  weekDates,
  branches,
  coaches,
  editingSchedule,
  initialDate,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  weekDates?: string[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
  editingSchedule?: Schedule | null
  initialDate?: string
  onClose: () => void
  onCreated: (schedule: Schedule) => void
  onUpdated?: (schedule: Schedule) => void
  onDeleted?: (scheduleId: number) => void
}) {
  const isEditing = !!editingSchedule

  const defaultDate =
    editingSchedule?.date ?? initialDate ?? weekDates?.[0] ?? toDateISO(new Date())

  const [date, setDate] = useState(defaultDate)
  const [branchId, setBranchId] = useState(editingSchedule?.branch_id ?? branches[0]?.id)
  const [coachId, setCoachId] = useState(editingSchedule?.coach_id ?? coaches[0]?.id)
  const [timeStart, setTimeStart] = useState(editingSchedule?.time_start.slice(0, 5) ?? '')
  const [timeEnd, setTimeEnd] = useState(editingSchedule?.time_end.slice(0, 5) ?? '')
  const [status, setStatus] = useState<Schedule['status']>(editingSchedule?.status ?? 'Scheduled')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleDelete = async () => {
    if (!editingSchedule) return
    setError('')
    setDeleting(true)
    const result = await deleteSchedule(editingSchedule.id)
    setDeleting(false)
    if (result.error) {
      setError(result.error)
      setConfirmingDelete(false)
      return
    }
    onDeleted?.(editingSchedule.id)
    onClose()
  }

  const handleSubmit = async () => {
    if (saving || deleting || confirmingDelete) return
    setError('')

    if (!timeStart || !timeEnd) {
      setError('Please set both start and end time.')
      return
    }
    if (timeStart >= timeEnd) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    const result = await saveSchedule(editingSchedule?.id ?? null, {
      date,
      branch_id: Number(branchId),
      coach_id: Number(coachId),
      time_start: timeStart,
      time_end: timeEnd,
      status,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    const saved = result.data as unknown as Schedule
    if (editingSchedule) onUpdated?.(saved)
    else onCreated(saved)
    onClose()
  }

  // Esc closes, Enter submits — via a ref so the listener always calls the latest handleSubmit
  const handleSubmitRef = useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault()
        handleSubmitRef.current()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-colors'
  const labelClass = 'block text-[12px] font-medium text-gray-500 mb-1.5'

  return (
    <div
      className={`fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl transition-all duration-150 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-semibold text-black">
            {isEditing ? 'Edit Schedule' : 'Add Schedule'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-black transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className={inputClass}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Coach</label>
              <select value={coachId} onChange={(e) => setCoachId(Number(e.target.value))} className={inputClass}>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Time</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className={inputClass}
              />
              <span className="text-gray-300 text-sm shrink-0">–</span>
              <input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value as Schedule['status'])} className={inputClass}>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            {confirmingDelete ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-gray-600">Delete this schedule?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Keep
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[12px] font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="text-[12px] font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Delete schedule
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}
