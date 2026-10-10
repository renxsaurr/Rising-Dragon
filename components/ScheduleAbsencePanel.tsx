'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatTimeRange } from '@/utils/dates'
import {
  getAbsenceCoverageOptions,
  reportScheduleAbsence,
  resolveAbsenceReport,
  type AbsenceCoverageSession,
} from '@/app/scheduling/actions'

export type ScheduleAbsenceReportView = {
  id: number
  coach_id: number
  starts_on: string
  ends_on: string
  reason: string | null
  status: 'pending' | 'resolved'
  resolution: 'covered' | 'cancelled' | 'partially_cancelled' | 'no_sessions' | null
  created_at: string
  substitute_coach_id: number | null
  coach: { name: string; primary_branch_name: string | null } | null
  substitute_coach: { name: string } | null
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function dateRange(report: ScheduleAbsenceReportView) {
  return report.starts_on === report.ends_on
    ? dateLabel(report.starts_on)
    : `${dateLabel(report.starts_on)} – ${dateLabel(report.ends_on)}`
}

function classTimesOverlap(first: AbsenceCoverageSession, second: AbsenceCoverageSession) {
  return first.date === second.date && first.time_start.slice(0, 5) < second.time_end.slice(0, 5) && first.time_end.slice(0, 5) > second.time_start.slice(0, 5)
}

function normalizeCoverageChoices(
  sessions: AbsenceCoverageSession[],
  proposed: Record<number, number | 'cancel' | ''>,
) {
  const choices: Record<number, number | 'cancel' | ''> = {}
  for (const session of sessions) {
    const usedCoachIds = new Set(sessions
      .filter((other) => other.id !== session.id && classTimesOverlap(session, other))
      .map((other) => choices[other.id])
      .filter((choice): choice is number => typeof choice === 'number'))
    const freeAssistants = session.assistant_options.filter((coach) => !usedCoachIds.has(coach.id))
    const currentChoice = proposed[session.id]
    if (typeof currentChoice === 'number' && freeAssistants.some((coach) => coach.id === currentChoice)) choices[session.id] = currentChoice
    else if (freeAssistants.length === 1) choices[session.id] = freeAssistants[0].id
    else if (freeAssistants.length > 1) choices[session.id] = ''
    else if (session.head_coach && !usedCoachIds.has(session.head_coach.id)) choices[session.id] = session.head_coach.id
    else choices[session.id] = 'cancel'
  }
  return choices
}

function resolutionLabel(report: ScheduleAbsenceReportView) {
  if (report.status === 'pending') return 'Waiting for coverage'
  if (report.resolution === 'covered') return report.substitute_coach ? `Covered by ${report.substitute_coach.name}` : 'All classes covered'
  if (report.resolution === 'partially_cancelled') return 'Some classes covered; others cancelled'
  if (report.resolution === 'cancelled') return 'Affected classes cancelled'
  return 'No classes needed coverage'
}

export default function ScheduleAbsencePanel({
  reports: initialReports,
  isAssistantCoach,
  today,
}: {
  reports: ScheduleAbsenceReportView[]
  isAssistantCoach: boolean
  today: string
}) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [reason, setReason] = useState('')
  const [coverageOptions, setCoverageOptions] = useState<Record<number, AbsenceCoverageSession[]>>({})
  const [coverageChoices, setCoverageChoices] = useState<Record<number, Record<number, number | 'cancel' | ''>>>({})
  const [alreadyCancelled, setAlreadyCancelled] = useState<Record<number, number>>({})
  const [reviewingReportId, setReviewingReportId] = useState<number | null>(null)
  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>({})
  const [busyReportId, setBusyReportId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => setReports(initialReports), [initialReports])

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusyReportId(0)
    setError('')
    setNotice('')
    const result = await reportScheduleAbsence({ starts_on: startsOn, ends_on: endsOn, reason })
    setBusyReportId(null)
    if ('error' in result) { setError(result.error); return }
    setNotice(result.message)
    setReason('')
    router.refresh()
  }

  const handleReviewReport = async (reportId: number) => {
    setReviewingReportId(reportId)
    setReviewErrors((current) => ({ ...current, [reportId]: '' }))
    const result = await getAbsenceCoverageOptions(reportId)
    setReviewingReportId(null)
    if ('error' in result) { setReviewErrors((current) => ({ ...current, [reportId]: result.error })); return }
    setCoverageOptions((current) => ({ ...current, [reportId]: result.sessions }))
    setAlreadyCancelled((current) => ({ ...current, [reportId]: result.alreadyCancelled }))
    setCoverageChoices((current) => ({ ...current, [reportId]: normalizeCoverageChoices(result.sessions, {}) }))
  }

  const handleResolveReport = async (reportId: number) => {
    const sessions = coverageOptions[reportId] ?? []
    const choices = coverageChoices[reportId] ?? {}
    if (sessions.some((session) => choices[session.id] === '')) {
      setReviewErrors((current) => ({ ...current, [reportId]: 'Choose an available coach for each class before continuing.' }))
      return
    }
    setBusyReportId(reportId)
    setReviewErrors((current) => ({ ...current, [reportId]: '' }))
    setNotice('')
    const decisions = sessions.map((session) => ({
      session_id: session.id,
      coach_id: typeof choices[session.id] === 'number' ? choices[session.id] as number : null,
    }))
    const result = await resolveAbsenceReport(reportId, decisions)
    setBusyReportId(null)
    if ('error' in result) { setReviewErrors((current) => ({ ...current, [reportId]: result.error })); return }
    setNotice(result.message)
    router.refresh()
  }

  const inputClass = 'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10'
  const pendingReports = reports.filter((report) => report.status === 'pending')
  const resolvedReports = reports.filter((report) => report.status !== 'pending')
  const getFreeOptions = (reportId: number, session: AbsenceCoverageSession) => {
    const sessions = coverageOptions[reportId] ?? []
    const choices = coverageChoices[reportId] ?? {}
    const usedCoachIds = new Set(sessions.filter((other) => other.id !== session.id && classTimesOverlap(session, other))
      .map((other) => choices[other.id]).filter((choice): choice is number => typeof choice === 'number'))
    return {
      assistants: session.assistant_options.filter((coach) => !usedCoachIds.has(coach.id)),
      headCoach: session.head_coach && !usedCoachIds.has(session.head_coach.id) ? session.head_coach : null,
    }
  }

  return (
    <section className={`${isAssistantCoach ? 'mt-6' : ''} overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm`}>
      <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-gray-950">{isAssistantCoach ? 'Report time away' : 'Coverage requests'}</h2>
      </div>

      {isAssistantCoach && (
        <form onSubmit={submitReport} className="grid gap-4 border-b border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-[1fr_1fr_minmax(160px,1.4fr)_auto] sm:items-end sm:p-5">
          <label className="text-xs font-medium text-gray-600">From<input type="date" required min={today} value={startsOn} onChange={(event) => {
            setStartsOn(event.target.value)
            if (event.target.value > endsOn) setEndsOn(event.target.value)
          }} className={inputClass} /></label>
          <label className="text-xs font-medium text-gray-600">Through<input type="date" required min={startsOn || today} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-medium text-gray-600">Note <span className="font-normal text-gray-400">(optional)</span><input type="text" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a short note" className={inputClass} /></label>
          <button disabled={busyReportId === 0 || !startsOn || !endsOn || startsOn > endsOn} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{busyReportId === 0 ? 'Submitting…' : 'Report dates'}</button>
        </form>
      )}

      {error && <p role="alert" className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-5">{error}</p>}
      {notice && <p role="status" className="mx-4 mt-4 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 sm:mx-5">{notice}</p>}

      <div className="space-y-3 p-4 sm:p-5">
        {pendingReports.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm font-medium text-gray-900">
            {isAssistantCoach ? 'No pending time-away reports.' : 'No coverage requests need review.'}
          </p>
        ) : pendingReports.map((report) => {
          const sessions = coverageOptions[report.id]
          const choices = coverageChoices[report.id] ?? {}
          return (
            <article key={report.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-950">{dateRange(report)}</p>
                  {!isAssistantCoach && <p className="mt-1 text-sm font-medium text-gray-800">{report.coach?.name ?? 'Assistant Coach'}{report.coach?.primary_branch_name ? ` · ${report.coach.primary_branch_name}` : ''}</p>}
                  {report.reason && <p className="mt-2 text-sm text-gray-700">{report.reason}</p>}
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">Pending</span>
              </div>
              {!isAssistantCoach && !sessions && <div className="mt-4">
                {reviewErrors[report.id] && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{reviewErrors[report.id]}</p>}
                <button type="button" onClick={() => handleReviewReport(report.id)} disabled={reviewingReportId === report.id} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                  {reviewingReportId === report.id ? 'Checking availability…' : 'Review affected classes'}
                </button>
              </div>}
              {!isAssistantCoach && sessions && <div className="mt-4 space-y-3">
                {alreadyCancelled[report.id] > 0 && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{alreadyCancelled[report.id]} class{alreadyCancelled[report.id] === 1 ? ' is' : 'es are'} already cancelled.</p>}
                {sessions.length === 0 ? <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm font-medium text-gray-800">No scheduled classes need coverage during these dates.</p> : sessions.map((session) => {
                  const selected = choices[session.id] ?? ''
                  const freeOptions = getFreeOptions(report.id, session)
                  return <div key={session.id} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">{new Date(`${session.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="mt-0.5 text-sm text-gray-800">{formatTimeRange(session.time_start, session.time_end)} · {session.branch_name}</p>
                    </div>
                    {freeOptions.assistants.length > 0 ? <label className="text-xs font-medium text-gray-700">Available assistant coach
                      <span className="relative mt-1 block">
                        <select value={typeof selected === 'number' ? selected : ''} onChange={(event) => setCoverageChoices((current) => ({
                          ...current,
                          [report.id]: normalizeCoverageChoices(coverageOptions[report.id] ?? [], { ...(current[report.id] ?? {}), [session.id]: event.target.value ? Number(event.target.value) : '' }),
                        }))} className={`${inputClass} appearance-none pr-10`}>
                          {freeOptions.assistants.length > 1 && <option value="">Choose an available coach</option>}
                          {freeOptions.assistants.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                        </select>
                        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    </label> : freeOptions.headCoach
                      ? <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">No assistant is free for this class. {freeOptions.headCoach.name} will cover.</p>
                      : <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">No coach is available. This class will be cancelled.</p>}
                  </div>
                })}
                {reviewErrors[report.id] && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{reviewErrors[report.id]}</p>}
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setCoverageOptions((current) => { const next = { ...current }; delete next[report.id]; return next }); setReviewErrors((current) => ({ ...current, [report.id]: '' })) }} disabled={busyReportId === report.id} className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                  <button type="button" onClick={() => handleResolveReport(report.id)} disabled={busyReportId === report.id || sessions.some((session) => choices[session.id] === '')} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                    {busyReportId === report.id ? 'Saving…' : sessions.length === 0 ? 'Mark reviewed' : sessions.some((session) => choices[session.id] === 'cancel') ? 'Confirm coverage and cancellation' : 'Assign coverage'}
                  </button>
                </div>
              </div>}
            </article>
          )
        })}

        {resolvedReports.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800">Recently resolved</h3>
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {resolvedReports.slice(0, 5).map((report) => (
                <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    {!isAssistantCoach && <p className="text-sm font-medium text-gray-800">{report.coach?.name ?? 'Assistant Coach'}</p>}
                    <p className="text-sm font-medium text-gray-900">{dateRange(report)}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{resolutionLabel(report)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
