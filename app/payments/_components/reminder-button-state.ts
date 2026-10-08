// The "Send reminder" button rules, shared by the payment records table and the "Not paid yet" list.
// No server-only imports, so client components can use it too.
import { isValidEmail } from '@/utils/email'
import type { ReminderSummary } from '@/utils/payment-records'
import { DEFAULT_REMINDER_SCHEDULE, reminderWindowFor, type ReminderSchedule } from '@/utils/reminder-timing'

export type ReminderButtonInput = {
  dueDate: string
  /** Already trimmed and lowercased. */
  guardianEmail: string
  isActive: boolean
  reminders: ReminderSummary[]
  paymentType?: string | null
}

const formatDayMonth = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

const formatSentDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

/** Whether a payment's "Send reminder" button can be used, and why not. */
export function sendButtonState(
  input: ReminderButtonInput,
  today: string,
  schedule: ReminderSchedule = DEFAULT_REMINDER_SCHEDULE,
) {
  const timing = reminderWindowFor(input.dueDate, today, schedule)
  // The type that is open today, or the one that opens next.
  const reminderType = timing.open ? timing.type : timing.nextType
  if (input.paymentType === 'Per session') return { reminderType, disabledReason: 'Email reminders are for monthly bills.' }
  if (!input.guardianEmail) return { reminderType, disabledReason: 'No guardian email' }
  if (!isValidEmail(input.guardianEmail)) return { reminderType, disabledReason: 'Invalid guardian email' }
  if (!input.isActive) return { reminderType, disabledReason: 'Student is inactive' }
  if (!timing.open) return { reminderType, disabledLabel: `Available ${formatDayMonth(timing.opensOn)}` }

  const existing = input.reminders.find((reminder) => reminder.reminderType === reminderType)
  if (existing?.status === 'Sent') {
    return {
      reminderType,
      disabledLabel: existing.sentAt ? `Sent ${formatSentDate(existing.sentAt)}` : 'Sent',
      // After due is the last reminder, so there is nothing left to send by email.
      hint: reminderType === 'After due' ? 'All reminders sent · contact parent' : undefined,
    }
  }
  if (existing?.status === 'Failed') {
    return { reminderType, disabledReason: `${reminderType} failed. Use Retry in Reminder history.` }
  }
  if (existing?.status === 'Scheduled') return { reminderType, disabledLabel: 'Sending…' }
  // No row yet, or a Skipped one that Send may reuse.
  return { reminderType }
}
