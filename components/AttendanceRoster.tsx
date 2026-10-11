'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addPerSessionWalkIn, saveAttendance } from '@/app/attendance/actions'
import { Toast } from '@/components/Toast'
import { beltTextColorClass, formatBeltLabel } from '@/utils/belts'

type Student = { id: number; first_name: string; middle_name: string | null; last_name: string; belt_level: string; billing_plan: 'Monthly' | 'Per session' }
type Status = 'Present' | 'Late' | 'Absent' | 'Excused'
type Filter = 'all' | 'unmarked' | Status
const STATUSES: { value: Status; icon: string; selected: string }[] = [
  { value: 'Present', icon: '✓', selected: 'bg-emerald-200 text-emerald-950' },
  { value: 'Late', icon: '◷', selected: 'bg-amber-200 text-amber-950' },
  { value: 'Absent', icon: '×', selected: 'bg-red-200 text-red-950' },
  { value: 'Excused', icon: '—', selected: 'bg-slate-200 text-slate-950' },
]

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
  availableWalkIns,
}: {
  scheduleId: number
  classLabel: string
  students: Student[]
  initialAttendance: { student_id: number; status: Status }[]
  canMarkAttendance: boolean
  availableWalkIns: { id: number; name: string; belt: string }[]
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<Record<number, Status>>(() => toStatusMap(initialAttendance))
  const [statuses, setStatuses] = useState<Record<number, Status>>(() => toStatusMap(initialAttendance))
  const [filter, setFilter] = useState<Filter>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [walkInId, setWalkInId] = useState('')
  const [addingWalkIn, setAddingWalkIn] = useState(false)
  const dismissToast = useCallback(() => setToast(''), [])

  const totals = useMemo(() => {
    const counts: Record<Status, number> = { Present: 0, Late: 0, Absent: 0, Excused: 0 }
    for (const student of students) {
      const status = statuses[student.id]
      if (status) counts[status] += 1
    }
    return { ...counts, unmarked: students.length - Object.values(counts).reduce((sum, count) => sum + count, 0) }
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
    if (filter !== 'all') return statuses[student.id] === filter
    return true
  })

  const mark = (studentId: number, status: Status) => {
    setStatuses((current) => ({ ...current, [studentId]: status }))
    setError('')
  }

  const addWalkIn = async () => {
    const id = Number(walkInId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('Choose a per-session student first.')
      return
    }
    setAddingWalkIn(true)
    setError('')
    const result = await addPerSessionWalkIn(scheduleId, id)
    setAddingWalkIn(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setWalkInId('')
    setToast('Walk-in checked in · session charge added to Payments')
    router.refresh()
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
        </div>

        {availableWalkIns.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-950">Walk-in check-in</h3>
              <p className="mt-1 text-xs text-gray-600">Add a per-session student to this class.</p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <label htmlFor="attendance-walk-in" className="mb-1 block text-xs font-medium text-gray-700">Student</label>
                <div className="relative">
                  <select id="attendance-walk-in" value={walkInId} onChange={(event) => setWalkInId(event.target.value)} disabled={!canMarkAttendance || addingWalkIn || saving} className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-950 outline-none focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500">
                    <option value="">Choose student</option>
                    {availableWalkIns.map((student) => <option key={student.id} value={student.id}>{student.name} · {formatBeltLabel(student.belt)}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <button type="button" onClick={addWalkIn} disabled={!canMarkAttendance || !walkInId || addingWalkIn || saving} className="h-10 w-full rounded-lg bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 sm:w-auto">
                {addingWalkIn ? 'Checking in…' : 'Check in walk-in'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600" role="status">
              {!canMarkAttendance ? 'Check-in opens when the scheduled class starts.' : 'The student’s per-session charge will be added to Payments.'}
            </p>
          </div>
        )}

        {students.length > 0 && (
          <div className="mt-4 flex justify-end">
            <label className="sr-only" htmlFor="attendance-filter">Filter students</label>
            <div className="relative">
              <select
                id="attendance-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="h-9 appearance-none rounded-lg border border-gray-200 bg-white py-0 pl-3 pr-10 text-sm text-gray-950 outline-none focus:border-gray-400"
              >
                <option value="all">All students ({students.length})</option>
                <option value="unmarked">Not marked ({totals.unmarked})</option>
                {STATUSES.map(({ value }) => <option key={value} value={value}>{value} ({totals[value]})</option>)}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-900" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
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
        <div className="max-h-[448px] overflow-auto overscroll-contain">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(240px,1fr)_repeat(4,minmax(112px,128px))] border-b border-gray-200 bg-white text-center">
              <div className="px-5 py-3 text-left text-xs font-semibold text-gray-700">Student</div>
              {STATUSES.map(({ value }) => <div key={value} className="border-l border-gray-200 px-2 py-3 text-xs font-semibold text-gray-700">{value}</div>)}
            </div>
            <ul className="divide-y divide-gray-200 bg-white">
              {visibleStudents.map((student) => {
                const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
                const status = statuses[student.id]
                const changed = status && status !== saved[student.id]
                return (
                  <li key={student.id} className="grid min-h-[68px] grid-cols-[minmax(240px,1fr)_repeat(4,minmax(112px,128px))]">
                    <div className="flex min-w-0 flex-col justify-center px-5 py-3">
                      <Link
                        href={`/attendance/history?studentId=${student.id}`}
                        onClick={(event) => {
                          if (dirty && !window.confirm('Attendance changes are unsaved. Leave this class without saving?')) {
                            event.preventDefault()
                          }
                        }}
                        className="break-words text-sm font-medium text-gray-900 hover:underline"
                      >
                        {fullName}
                        {changed && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-red-600">Unsaved</span>}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-600"><span className={`font-medium ${beltTextColorClass(student.belt_level)}`}>{formatBeltLabel(student.belt_level)}</span> · {student.billing_plan === 'Per session' ? 'Per session' : 'Monthly'}</p>
                    </div>
                    {STATUSES.map(({ value, icon, selected }) => {
                      const active = status === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => mark(student.id, value)}
                          disabled={!canMarkAttendance || student.billing_plan === 'Per session'}
                          aria-label={`${active ? 'Selected: ' : 'Mark as '}${value} for ${fullName}`}
                          aria-pressed={active}
                          className={`group flex min-h-[68px] flex-col items-center justify-center gap-1 border-l border-gray-200 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? selected : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}`}
                        >
                          <span className={`text-base leading-none ${active ? '' : 'opacity-0 group-hover:opacity-60'}`} aria-hidden="true">{icon}</span>
                          <span className={active ? 'font-medium' : 'sr-only'}>{value}</span>
                        </button>
                      )
                    })}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
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
