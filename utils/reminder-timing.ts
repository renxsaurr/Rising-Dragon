// Reminder timing, in one place for the page, the popups and the server. No server-only imports.
import { addDays, dateInTimeZone } from '@/utils/dates'

export type ReminderType = 'Before due' | 'Due today' | 'After due'

// "Before due" opens the configured number of days before the due date, "Due today"
// opens on the due date, and "After due" opens the configured number of days after it.
export const BEFORE_DUE_WINDOW_DAYS = 3
export const AFTER_DUE_GRACE_DAYS = 3
export type ReminderSchedule = { beforeDueDays: number; afterDueDays: number }
export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  beforeDueDays: BEFORE_DUE_WINDOW_DAYS,
  afterDueDays: AFTER_DUE_GRACE_DAYS,
}

export type ReminderWindow =
  | { open: true; type: ReminderType; opensOn: string }
  | { open: false; type: null; nextType: ReminderType; opensOn: string }

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Which reminder can be sent today (Manila), or which one opens next and on what date. */
export function reminderWindowFor(
  dueDate: string,
  today = dateInTimeZone(),
  schedule: ReminderSchedule = DEFAULT_REMINDER_SCHEDULE,
): ReminderWindow {
  const daysUntilDue = daysBetween(today, dueDate)
  const beforeDueOpens = addDays(dueDate, -schedule.beforeDueDays)
  const afterDueOpens = addDays(dueDate, schedule.afterDueDays)
  if (daysUntilDue > schedule.beforeDueDays) return { open: false, type: null, nextType: 'Before due', opensOn: beforeDueOpens }
  if (daysUntilDue > 0) return { open: true, type: 'Before due', opensOn: beforeDueOpens }
  if (daysUntilDue === 0) return { open: true, type: 'Due today', opensOn: dueDate }
  if (-daysUntilDue < schedule.afterDueDays) return { open: false, type: null, nextType: 'After due', opensOn: afterDueOpens }
  return { open: true, type: 'After due', opensOn: afterDueOpens }
}
