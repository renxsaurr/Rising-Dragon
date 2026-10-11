'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import type { BranchReportSession } from '@/utils/branch-reports'
import { formatTimeRange } from '@/utils/dates'

function formatSessionDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusCounts({ session }: { session: BranchReportSession }) {
  const counts = [
    ['Present', session.present],
    ['Late', session.late],
    ['Absent', session.absent],
    ['Excused', session.excused],
  ] as const
  const recorded = counts.filter(([, value]) => value > 0)
  if (!recorded.length) return <span className="text-xs text-gray-500">No statuses recorded</span>
  return (
    <span className="text-sm font-medium text-gray-700">
      {recorded.map(([label, value]) => `${value} ${label.toLowerCase()}`).join(' · ')}
    </span>
  )
}

function RecordingCell({ session }: { session: BranchReportSession }) {
  if (session.cancelled) return <span className="text-xs font-medium text-gray-600">Cancelled</span>
  if (session.expectedMarks === null) return <span className="text-xs font-medium text-gray-600">Not due · {session.recordedMarks} recorded</span>
  if (session.expectedMarks === 0) return <span className="text-xs font-medium text-gray-600">No expected roster</span>
  return (
    <span className="block whitespace-nowrap">
      <span className="block text-sm font-semibold text-gray-950">{session.recordedMarks} of {session.expectedMarks} recorded</span>
      {session.unrecordedMarks > 0 && <span className="mt-0.5 block text-xs text-gray-600">{session.unrecordedMarks} not recorded</span>}
      {session.unrecordedMarks === 0 && <span className="mt-0.5 block text-xs text-gray-600">All expected statuses entered</span>}
    </span>
  )
}

export default function BranchReportSessions({ sessions }: {
  sessions: BranchReportSession[]
}) {
  const [search, setSearch] = useState('')
  const matchingSessions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return sessions

    return sessions.filter((session) => {
      const statuses = [
        session.present > 0 ? 'present' : '',
        session.late > 0 ? 'late' : '',
        session.absent > 0 ? 'absent' : '',
        session.excused > 0 ? 'excused' : '',
        session.cancelled ? 'cancelled' : '',
      ].join(' ')
      const searchable = [
        session.date,
        formatSessionDate(session.date),
        formatTimeRange(session.timeStart, session.timeEnd),
        session.branchName,
        session.coachName,
        statuses,
      ].join(' ').toLocaleLowerCase()
      return searchable.includes(term)
    })
  }, [search, sessions])

  return (
    <section aria-labelledby="class-session-records-title" className="min-w-0 bg-white">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 id="class-session-records-title" className="text-lg font-semibold tracking-tight text-gray-950">Class session records</h3>
        <span className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">{sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <label className="relative block w-full max-w-xl">
          <span className="sr-only">Search class sessions by date, branch, coach, or status</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search date, branch, coach, or status"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-950 outline-none placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear session search" className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X className="h-4 w-4" aria-hidden="true" /></button>}
        </label>
        {search.trim() && <p className="text-sm text-gray-600" aria-live="polite">{matchingSessions.length} of {sessions.length} sessions match</p>}
      </div>
      <div className="overflow-x-auto border-y border-gray-200">
        <table className="system-data-table branch-report-table w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="w-16 px-5 py-5 text-left text-[15px] font-medium text-gray-600">#</th>
              <th scope="col" className="px-5 py-5 text-left text-[15px] font-medium text-gray-600">Session</th>
              <th scope="col" className="px-5 py-5 text-left text-[15px] font-medium text-gray-600">Branch · coach</th>
              <th scope="col" className="px-5 py-5 text-left text-[15px] font-medium text-gray-600">Status</th>
              <th scope="col" className="px-5 py-5 text-left text-[15px] font-medium text-gray-600">Recording</th>
              <th scope="col" className="px-5 py-5 text-right text-[15px] font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <PaginatedTableRows itemLabel="class sessions" pageSize={10} colSpan={6}>
            {matchingSessions.map((session, index) => (
              <tr key={session.id} className="border-b border-gray-100 print:break-inside-avoid">
                <td className="w-16 px-5 py-7 text-left align-middle text-base font-medium tabular-nums text-gray-700">{index + 1}</td>
                <th scope="row" className="px-5 py-7 text-left align-middle text-base font-medium text-gray-950">
                  <span className="block whitespace-nowrap">{formatSessionDate(session.date)}</span>
                  <span className="mt-1 block whitespace-nowrap text-sm font-normal text-gray-600">{formatTimeRange(session.timeStart, session.timeEnd)}</span>
                </th>
                <td className="px-5 py-7 align-middle text-base font-medium text-gray-950">
                  <span className="block">{session.branchName}</span>
                  <span className="mt-1 block text-sm font-normal text-gray-600">{session.coachName}</span>
                </td>
                <td className="px-5 py-7 align-middle"><StatusCounts session={session} /></td>
                <td className="px-5 py-7 align-middle"><RecordingCell session={session} /></td>
                <td className="px-5 py-7 text-right align-middle">
                  {!session.cancelled && (
                    <Link
                      href={`/attendance?date=${session.date}&branchId=${session.branchId}&scheduleId=${session.id}`}
                      className="whitespace-nowrap text-sm font-semibold text-gray-800 underline decoration-gray-300 underline-offset-2 hover:text-black"
                    >
                      Open attendance
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </PaginatedTableRows>
          {matchingSessions.length === 0 && <tbody><tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-600">{search.trim() ? 'No sessions match your search.' : 'No class sessions match this period and branch selection.'}</td></tr></tbody>}
        </table>
      </div>
    </section>
  )
}
