'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function AddScheduleModal({
  weekDates,
  branches,
  coaches,
  existingSchedules,
  onClose,
  onCreated,
}: {
  weekDates: string[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string }[]
  existingSchedules: any[]
  onClose: () => void
  onCreated: (schedule: any) => void
}) {
  const supabase = createClient()
  const [date, setDate] = useState(weekDates[0])
  const [branchId, setBranchId] = useState(branches[0]?.id)
  const [coachId, setCoachId] = useState(coaches[0]?.id)
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // client-side conflict check — same coach, same date, overlapping time range
  const hasConflict = () => {
    return existingSchedules.some((s) => {
      if (s.date !== date || s.coach_id !== coachId) return false
      return timeStart < s.time_end && timeEnd > s.time_start // overlap test
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
    const { data, error: insertError } = await supabase
      .from('ClassSchedule')
      .insert({ date, branch_id: branchId, coach_id: coachId, time_start: timeStart, time_end: timeEnd })
      .select('id, date, time_start, time_end, branch_id, coach_id, Branch(name), User(name)')
      .single()

    setSaving(false)

    if (insertError) {
      // catches it too if you added the DB-level exclusion constraint
      setError(insertError.message)
      return
    }

    onCreated(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold mb-4">Add Schedule</h3>

        <div className="space-y-3">
          <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
            {weekDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select value={coachId} onChange={(e) => setCoachId(Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm">
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex gap-2">
            <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-1/2 border rounded-lg p-2 text-sm" />
            <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-1/2 border rounded-lg p-2 text-sm" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-black text-white rounded-lg py-2 text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}