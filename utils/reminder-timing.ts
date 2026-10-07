// Reminder timing, in one place for the page, the popups and the server. No server-only imports.
import { addDays, dateInTimeZone } from '@/utils/dates'

export type ReminderType = 'Before due' | 'Due today' | 'After due'

// "Before due" opens 3 days before the due date, "Due today" on the due date, and
// "After due" 3 days after it. The 1–2 days after the due date are a grace period.
export const BEFORE_DUE_WINDOW_DAYS = 3
export const AFTER_DUE_GRACE_DAYS = 3

export type ReminderWindow =
  | { open: true; type: ReminderType; opensOn: string }
  | { open: false; type: null; nextType: ReminderType; opensOn: string }

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Which reminder can be sent today (Manila), or which one opens next and on what date. */
export function reminderWindowFor(dueDate: string, today = dateInTimeZone()): ReminderWindow {
  const daysUntilDue = daysBetween(today, dueDate)
  const beforeDueOpens = addDays(dueDate, -BEFORE_DUE_WINDOW_DAYS)
  const afterDueOpens = addDays(dueDate, AFTER_DUE_GRACE_DAYS)
  if (daysUntilDue > BEFORE_DUE_WINDOW_DAYS) return { open: false, type: null, nextType: 'Before due', opensOn: beforeDueOpens }
  if (daysUntilDue > 0) return { open: true, type: 'Before due', opensOn: beforeDueOpens }
  if (daysUntilDue === 0) return { open: true, type: 'Due today', opensOn: dueDate }
  if (-daysUntilDue < AFTER_DUE_GRACE_DAYS) return { open: false, type: null, nextType: 'After due', opensOn: afterDueOpens }
  return { open: true, type: 'After due', opensOn: afterDueOpens }
}
