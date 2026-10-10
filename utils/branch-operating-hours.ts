import { formatTimeRange } from '@/utils/dates'

export const BRANCH_WEEKDAYS = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 7, label: 'Sunday', shortLabel: 'Sun' },
] as const

export type BranchOperatingWindow = {
  weekday: number
  time_start: string
  time_end: string
}

export type BranchOperatingHoursResult =
  | { value: BranchOperatingWindow[] }
  | { error: string }

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export function validateBranchOperatingHours(input: unknown): BranchOperatingHoursResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'Add at least one operating time window.' }
  }
  if (input.length > 28) return { error: 'A branch can have up to four time windows per day.' }

  const windows: BranchOperatingWindow[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'Check each operating day and time range.' }
    }
    const row = item as Record<string, unknown>
    const weekday = row.weekday
    const timeStart = row.time_start
    const timeEnd = row.time_end
    if (
      !Number.isInteger(weekday) ||
      (weekday as number) < 1 ||
      (weekday as number) > 7 ||
      !isTime(timeStart) ||
      !isTime(timeEnd) ||
      timeStart >= timeEnd
    ) return { error: 'Check each operating day and time range.' }
    windows.push({
      weekday: weekday as number,
      time_start: timeStart,
      time_end: timeEnd,
    })
  }

  windows.sort((a, b) => a.weekday - b.weekday || a.time_start.localeCompare(b.time_start))
  const perDay = new Map<number, BranchOperatingWindow[]>()
  for (const window of windows) {
    const dayWindows = perDay.get(window.weekday) ?? []
    if (dayWindows.length >= 4) return { error: 'A branch can have up to four time windows per day.' }
    const previous = dayWindows[dayWindows.length - 1]
    if (previous && window.time_start < previous.time_end) {
      return { error: 'Operating time windows on the same day cannot overlap.' }
    }
    dayWindows.push(window)
    perDay.set(window.weekday, dayWindows)
  }

  return { value: windows }
}

/** Parse JSONB read from Supabase. Null means this legacy branch has no saved hours. */
export function parseBranchOperatingHours(value: unknown): BranchOperatingWindow[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  const result = validateBranchOperatingHours(value)
  return 'value' in result ? result.value : null
}

export function branchOperatingWindowsForDay(
  hours: BranchOperatingWindow[] | null,
  weekday: number,
) {
  return hours?.filter((window) => window.weekday === weekday) ?? []
}

export function branchOperatingHoursConflict(
  hours: BranchOperatingWindow[] | null,
  weekday: number,
  start: string,
  end: string,
) {
  if (hours === null) return 'Set this branch’s operating hours before scheduling classes.'
  const windows = branchOperatingWindowsForDay(hours, weekday)
  const day = BRANCH_WEEKDAYS.find((item) => item.value === weekday)?.label ?? 'selected day'
  if (windows.length === 0) return `This branch is closed on ${day}.`
  if (!windows.some((window) => window.time_start <= start.slice(0, 5) && window.time_end >= end.slice(0, 5))) {
    return `The class must fit within this branch’s operating hours on ${day}.`
  }
  return null
}

export function formatBranchOperatingHours(hours: BranchOperatingWindow[] | null, weekday: number) {
  if (hours === null) return 'Hours not set'
  const windows = branchOperatingWindowsForDay(hours, weekday)
  return windows.length
    ? windows.map((window) => formatTimeRange(window.time_start, window.time_end)).join(' · ')
    : 'Closed'
}

export function formatBranchOperatingSchedule(hours: BranchOperatingWindow[] | null) {
  if (hours === null) return 'Operating hours not set'
  const openDays = BRANCH_WEEKDAYS.map((day) => {
    const windows = branchOperatingWindowsForDay(hours, day.value)
    return windows.length
      ? `${day.shortLabel} ${windows.map((window) => formatTimeRange(window.time_start, window.time_end)).join(' / ')}`
      : null
  }).filter((value): value is string => value !== null)
  return openDays.length ? openDays.join(' · ') : 'Closed all week'
}
