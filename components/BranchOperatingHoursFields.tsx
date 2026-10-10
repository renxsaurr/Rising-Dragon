'use client'

import { BRANCH_WEEKDAYS, type BranchOperatingWindow } from '@/utils/branch-operating-hours'

export default function BranchOperatingHoursFields({
  value,
  onChange,
}: {
  value: BranchOperatingWindow[]
  onChange: (value: BranchOperatingWindow[]) => void
}) {
  const setDayWindows = (weekday: number, windows: BranchOperatingWindow[]) => {
    onChange([
      ...value.filter((window) => window.weekday !== weekday),
      ...windows,
    ])
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="px-1 text-[13px] font-semibold text-gray-900">Operating hours</legend>
      <p className="mb-3 text-xs text-gray-500">Add one or more time windows for each open day.</p>
      <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
        {BRANCH_WEEKDAYS.map((day) => {
          const windows = value.filter((window) => window.weekday === day.value)
          return (
            <div key={day.value} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-gray-800">{day.label}</p>
                  {windows.length === 0 && <p className="mt-0.5 text-xs text-gray-400">Closed</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setDayWindows(day.value, [...windows, { weekday: day.value, time_start: '', time_end: '' }])}
                  disabled={windows.length >= 4}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  {windows.length === 0 ? 'Add hours' : 'Add time window'}
                </button>
              </div>
              {windows.map((window, index) => (
                <div key={`${day.value}-${index}`} className="mt-2 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`branch-hours-${day.value}-${index}-start`}>{day.label} opens</label>
                  <input
                    id={`branch-hours-${day.value}-${index}-start`}
                    type="time"
                    required
                    value={window.time_start}
                    onChange={(event) => setDayWindows(day.value, windows.map((item, itemIndex) => itemIndex === index ? { ...item, time_start: event.target.value } : item))}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-sm text-gray-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/10"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <label className="sr-only" htmlFor={`branch-hours-${day.value}-${index}-end`}>{day.label} closes</label>
                  <input
                    id={`branch-hours-${day.value}-${index}-end`}
                    type="time"
                    required
                    value={window.time_end}
                    onChange={(event) => setDayWindows(day.value, windows.map((item, itemIndex) => itemIndex === index ? { ...item, time_end: event.target.value } : item))}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-sm text-gray-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/10"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${day.label} time window ${index + 1}`}
                    onClick={() => setDayWindows(day.value, windows.filter((_, itemIndex) => itemIndex !== index))}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-800"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
