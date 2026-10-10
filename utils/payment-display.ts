import type { ReminderType } from '@/utils/reminder-timing'

// A payment can have at most one reminder row for each reminder type.
export const REMINDER_TYPES: ReminderType[] = ['Before due', 'Due today', 'After due']

export const formatAmount = (amount: number | string) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount))
