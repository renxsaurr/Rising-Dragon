'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Schedule } from './WeeklyScheduleBoard'

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
  existingSchedules,
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
  existingSchedules: Schedule[]
  editingSchedule?: Schedule | null
  initialDate?: string
  onClose: () => void
  onCreated: (schedule: Schedule) => void
  onUpdated?: (schedule: Schedule) => void
  onDeleted?: (id: number) => void
}) {
  const supabase = createClient()
  const isEditing = !!editingSchedule

  const defaultDate =
    editingSchedule?.date ?? initialDate ?? weekDates?.[0] ?? toDateISO(new Date())

  const [date, setDate] = useState(defaultDate)
  const [branchId, setBranchId] = useState(editingSchedule?.branch_id ?? branches[0]?.id)
  const [coachId, setCoachId] = useState(editingSchedule?.coach_id ?? coaches[0]?.id)
  const [timeStart, setTimeStart] = useState(editingSchedule?.time_start ?? '')
  const [timeEnd, setTimeEnd] = useState(editingSchedule?.time_end ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const hasConflict = () => {
    return existingSchedules.some((s) => {
      if (isEditing && s.id === editingSchedule!.id) return false
      if (s.date !== date || s.coach_id !== coachId) return false
      return timeStart < s.time_end && timeEnd > s.time_start
    })
  }

  const handleSubmit = async () => {
    setError('')

    if (!timeStart || !timeEnd) {
      setError('Please set both start and end time.')
      return
    }
    if (timeStart >= timeEnd) {
      setError('End time must be after start time.')
      return
    }
    if (hasConflict()) {
      setError('This coach is already scheduled at an overlapping time that day.')
      return
    }

    setSaving(true)

    if (isEditing) {
      const { data, error: updateError } = await supabase
        .from('ClassSchedule')
        .update({ date, branch_id: branchId, coach_id: coachId, time_start: timeStart, time_end: timeEnd })
        .eq('id', editingSchedule!.id)
        .select('id, date, time_start, time_end, branch_id, coach_id, Branch(name), User(name)')
        .single()

      setSaving(false)
      if (updateError) {
        setError(updateError.message)
        return
      }
      onUpdated?.(data as unknown as Schedule)
      onClose()
      return
    }

    const { data, error: insertError } = await supabase
      .from('ClassSchedule')
      .insert({ date, branch_id: branchId, coach_id: coachId, time_start: timeStart, time_end: timeEnd })
      .select('id, date, time_start, time_end, branch_id, coach_id, Branch(name), User(name)')
      .single()

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onCreated(data as unknown as Schedule)
    onClose()
  }

  const handleDelete = async () => {
    if (!editingSchedule) return
    setDeleting(true)
    const { error: deleteError } = await supabase.from('ClassSchedule').delete().eq('id', editingSchedule.id)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onDeleted?.(editingSchedule.id)
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

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-black text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

        {isEditing && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[13px] text-red-600 hover:text-red-700 font-medium"
              >
                Delete this schedule
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-gray-500 flex-1">Delete this class?</p>
                <button onClick={() => setConfirmDelete(false)} className="text-[12px] border rounded px-2 py-1">
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[12px] bg-red-600 text-white rounded px-2 py-1 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}