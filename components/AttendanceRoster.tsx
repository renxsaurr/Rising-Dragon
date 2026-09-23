'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [query, setQuery] = useState('')
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
    const name = `${student.first_name} ${student.middle_name ?? ''} ${student.last_name}`.toLowerCase()
    if (query && !name.includes(query.trim().toLowerCase())) return false
    if (filter === 'unmarked') return !statuses[student.id]
    if (filter === 'Present' || filter === 'Absent') return statuses[student.id] === filter
    return true
  })

  const mark = (studentId: number, status: Status) => {
    setStatuses((current) => ({ ...current, [studentId]: status }))
    setError('')
  }

  const markRemaining = (status: Status) => {
    setStatuses((current) => {
      const next = { ...current }
      for (const student of students) if (!next[student.id]) next[student.id] = status
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

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: students.length },
    { key: 'unmarked', label: 'Not marked', count: totals.unmarked },
    { key: 'Present', label: 'Present', count: totals.present },
    { key: 'Absent', label: 'Absent', count: totals.absent },
  ]
  const progress = students.length ? ((totals.present + totals.absent) / students.length) * 100 : 0

  return (
    <section className="rounded-xl border border-gray-200 bg-surface">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-950">{classLabel}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              <span className="font-medium text-emerald-700">{totals.present} present</span>
              {' · '}<span className="font-medium text-red-700">{totals.absent} absent</span>
              {' · '}{totals.unmarked} not marked
            </p>
          </div>
          {canMarkAttendance && students.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => markRemaining('Present')} disabled={totals.unmarked === 0} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                ✓ Mark the rest present
              </button>
              <button onClick={() => markRemaining('Absent')} disabled={totals.unmarked === 0} className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                Mark the rest absent
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
          <div className="bg-emerald-500 transition-all" style={{ width: `${students.length ? (totals.present / students.length) * 100 : 0}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${students.length ? (totals.absent / students.length) * 100 : 0}%` }} />
        </div>
        <p className="sr-only">{Math.round(progress)}% of students marked</p>

        {students.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><circle cx="11" cy="11" r="7" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M20 20l-3.5-3.5" /></svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student…"
                aria-label="Search students"
                className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="Filter students">
              {filters.map((item) => (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={filter === item.key}
                  onClick={() => setFilter(item.key)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${filter === item.key ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {item.label} <span className="tabular-nums text-gray-400">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!canMarkAttendance && (
        <p className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">This class hasn&apos;t happened yet. You can mark attendance on or after the class day.</p>
      )}

      {students.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-500">No students are enrolled at this branch yet.</p>
      ) : visibleStudents.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-500">No students match this filter.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibleStudents.map((student) => {
            const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
            const status = statuses[student.id]
            const changed = status && status !== saved[student.id]
            return (
              <li key={student.id} className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${status === 'Present' ? 'bg-emerald-50/40' : status === 'Absent' ? 'bg-red-50/40' : ''}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${status === 'Present' ? 'bg-emerald-100 text-emerald-800' : status === 'Absent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                    {student.first_name[0]}{student.last_name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {fullName}
                      {changed && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-600">Unsaved</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatBeltLabel(student.belt_level)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Attendance for ${fullName}`}>
                  <button
                    onClick={() => mark(student.id, 'Present')}
                    disabled={!canMarkAttendance}
                    aria-pressed={status === 'Present'}
                    className={`h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${status === 'Present' ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'}`}
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
        <div className="sticky bottom-0 z-10 -mb-px flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-gray-200 bg-surface/95 px-5 py-3.5 backdrop-blur">
          <div aria-live="polite" className="text-sm">
            {error
              ? <span className="text-red-600">{error}</span>
              : dirty
                ? <span className="font-medium text-amber-700">● {changedIds.length} unsaved change{changedIds.length === 1 ? '' : 's'}</span>
                : <span className="text-gray-500">{totals.unmarked === 0 ? 'Everyone is marked. All saved.' : 'All changes saved.'}</span>}
          </div>
          <div className="flex gap-2">
            {dirty && <button onClick={() => { setStatuses({ ...saved }); setError('') }} disabled={saving} className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Undo changes</button>}
            <button onClick={submit} disabled={saving || !dirty} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </section>
  )
}
