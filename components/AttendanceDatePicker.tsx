'use client'

import { useRouter } from 'next/navigation'

export default function AttendanceDatePicker({ date }: { date: string }) {
  const router = useRouter()
  return (
    <label className="relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={1.75} />
        <path strokeLinecap="round" strokeWidth={1.75} d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      Pick date
      <input
        type="date"
        aria-label="Jump to date"
        value={date}
        onChange={(event) => event.target.value && router.push(`/attendance?date=${event.target.value}`)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}
