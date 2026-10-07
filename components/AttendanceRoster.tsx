'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveAttendance } from '@/app/attendance/actions'
import { Toast } from '@/components/Toast'
import { formatBeltLabel } from '@/utils/belts'

type Student = { id: number; first_name: string; middle_name: string | null; last_name: string; belt_level: string }
type Status = 'Present' | 'Absent'
type Filter = 'all' | 'unmarked' | 'Present' | 'Absent'

function toStatusMap(rows: { student_id: number; status: Status }[]) {
  const map: Record<number, Status> = {}
  for (const row of rows) map[row.student_id] = row.status
  return map
}

export default function AttendanceRoster({
  scheduleId,
  classLabel,
  students,
  initialAttendance,
  canMarkAttendance,
}: {
  scheduleId: number
  classLabel: string
  students: Student[]
  initialAttendance: { student_id: number; status: Status }[]
  canMarkAttendance: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<Record<number, Status>>(() => toStatusMap(initialAttendance))
  const [statuses, setStatuses] = useState<Record<number, Status>>(() => toStatusMap(initialAttendance))
  const [filter, setFilter] = useState<Filter>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const dismissToast = useCallback(() => setToast(''), [])

  const totals = useMemo(() => {
    let present = 0
    let absent = 0
    for (const student of students) {
      if (statuses[student.id] === 'Present') present += 1
      if (statuses[student.id] === 'Absent') absent += 1
    }
    return { present, absent, unmarked: students.length - present - absent }
  }, [statuses, students])

  const changedIds = students.filter((student) => statuses[student.id] && statuses[student.id] !== saved[student.id]).map((student) => student.id)
  const dirty = changedIds.length > 0

  // warn before leaving the page with unsaved marks
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const visibleStudents = students.filter((student) => {
    if (filter === 'unmarked') return !statuses[student.id]
    if (filter === 'Present' || filter === 'Absent') return statuses[student.id] === filter
    return true
  })

  const mark = (studentId: number, status: Status) => {
    setStatuses((current) => ({ ...current, [studentId]: status }))
    setError('')
  }

  const markRemainingPresent = () => {
    setStatuses((current) => {
      const next = { ...current }
      for (const student of students) if (!next[student.id]) next[student.id] = 'Present'
      return next
    })
    setError('')
  }

  const submit = async () => {
    const records = changedIds.map((id) => ({ student_id: id, status: statuses[id] }))
    setSaving(true)
    setError('')
    const result = await saveAttendance(scheduleId, records)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSaved({ ...statuses })
    setToast(`Attendance saved · ${records.length} student${records.length === 1 ? '' : 's'} updated`)
    router.refresh()
  }

  return (
    <section className="min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-950">{classLabel}</h2>
          </div>
          {canMarkAttendance && students.length > 0 && totals.unmarked > 0 && (
            <button onClick={markRemainingPresent} className="text-xs font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-black">
              Mark remaining present
            </button>
          )}
        </div>

        {students.length > 0 && (
          <div className="mt-4 flex justify-end">
            <label className="sr-only" htmlFor="attendance-filter">Filter students</label>
            <select
              id="attendance-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400"
            >
              <option value="all">All students ({students.length})</option>
              <option value="unmarked">Not marked ({totals.unmarked})</option>
              <option value="Present">Present ({totals.present})</option>
              <option value="Absent">Absent ({totals.absent})</option>
            </select>
          </div>
        )}
      </div>

      {!canMarkAttendance && (
        <p className="border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-xs text-black">Attendance can be recorded starting at the scheduled class time.</p>
      )}

      {students.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-500">No students are enrolled at this branch yet.</p>
      ) : visibleStudents.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-500">No students match this filter.</p>
      ) : (
        <ul className="max-h-[448px] min-w-0 divide-y divide-gray-100 overflow-x-hidden overflow-y-auto overscroll-contain bg-white">
          {visibleStudents.map((student) => {
            const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
            const status = statuses[student.id]
            const changed = status && status !== saved[student.id]
            return (
              <li key={student.id} className="flex min-h-16 min-w-0 items-center justify-between gap-3 bg-white px-5 py-3 transition-colors">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/attendance/history?studentId=${student.id}`}
                      onClick={(event) => {
                        if (dirty && !window.confirm('Attendance changes are unsaved. Leave this class without saving?')) {
                          event.preventDefault()
                        }
                      }}
                      className="block break-words text-sm font-medium text-gray-900 hover:underline"
                    >
                      {fullName}
                      {changed && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-red-600">Unsaved</span>}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500">{formatBeltLabel(student.belt_level)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Attendance for ${fullName}`}>
                  <button
                    onClick={() => mark(student.id, 'Present')}
                    disabled={!canMarkAttendance}
                    aria-pressed={status === 'Present'}
                    className={`h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${status === 'Present' ? 'bg-black text-white' : 'border border-gray-200 text-black hover:border-gray-400 hover:bg-gray-50'}`}
                  >
                    ✓ Present
                  </button>
                  <button
                    onClick={() => mark(student.id, 'Absent')}
                    disabled={!canMarkAttendance}
                    aria-pressed={status === 'Absent'}
                    className={`h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${status === 'Absent' ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'}`}
                  >
                    ✕ Absent
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canMarkAttendance && students.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-gray-200 bg-white px-5 py-3.5">
          <div aria-live="polite" className="text-sm">
            {error
              ? <span className="text-red-600">{error}</span>
              : dirty
              ? <span className="font-medium text-red-600">● {changedIds.length} unsaved change{changedIds.length === 1 ? '' : 's'}</span>
                : <span className="text-gray-500">{totals.unmarked === 0 ? 'Everyone is marked. All saved.' : 'All changes saved.'}</span>}
          </div>
          <div className="flex gap-2">
            {dirty && <button onClick={() => { setStatuses({ ...saved }); setError('') }} disabled={saving} className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Undo changes</button>}
            <button onClick={submit} disabled={saving || !dirty} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </section>
  )
}
