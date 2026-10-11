'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export type AttendanceSessionOption = {
  id: number
  timeStart: string
  timeEnd: string
  coachName: string
}

export type AttendanceBranchOption = {
  id: number
  name: string
  sessions: AttendanceSessionOption[]
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AttendanceBranchSelector({
  date,
  branches,
  selectedBranchId,
  selectedScheduleId,
}: {
  date: string
  branches: AttendanceBranchOption[]
  selectedBranchId: number
  selectedScheduleId: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId)
  const selectedSession = selectedBranch?.sessions.find((session) => session.id === selectedScheduleId)

  const navigateTo = (branchId: number, scheduleId?: number) => {
    const sessionQuery = scheduleId === undefined ? '' : `&scheduleId=${scheduleId}`
    router.push(`/attendance?date=${encodeURIComponent(date)}&branchId=${branchId}${sessionQuery}`)
    setOpen(false)
  }

  if (!selectedBranch) return null

  const classBadge = (count: number) => count > 0
    ? `${count} ${count === 1 ? 'class' : 'classes'}`
    : 'No class'

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1 sm:max-w-md">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 text-left text-sm font-medium text-gray-950 shadow-sm hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <span className="min-w-0 truncate">{selectedBranch.name}</span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {classBadge(selectedBranch.sessions.length)}
            </span>
            <ChevronDown size={17} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <>
            <button type="button" aria-label="Close branch list" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
            <div role="listbox" aria-label="Branches with classes on this date" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
              {branches.map((branch) => {
                const selected = branch.id === selectedBranchId
                return (
                  <button
                    key={branch.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => navigateTo(branch.id, branch.sessions[0]?.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${selected ? 'bg-gray-100 font-semibold text-gray-950' : 'text-gray-800 hover:bg-gray-50'}`}
                  >
                    <span className="min-w-0 truncate">{branch.name}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {classBadge(branch.sessions.length)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selectedBranch.sessions.length > 1 && selectedSession && (
        <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <span className="sr-only">Class session</span>
          <select
            value={selectedSession.id}
            onChange={(event) => navigateTo(selectedBranchId, Number(event.target.value))}
            className="h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            {selectedBranch.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatTime(session.timeStart)}–{formatTime(session.timeEnd)} · {session.coachName}
              </option>
            ))}
          </select>
          <ChevronDown size={17} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
        </label>
      )}
    </div>
  )
}
