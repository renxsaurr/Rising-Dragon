import { addDays } from '@/utils/dates'

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth()

/** Enrollment-anniversary due date at a month offset, clamping short months to their last day. */
export function monthlyDueDate(enrollmentDate: string, offset: number): string | null {
  const anchor = parseDate(enrollmentDate)
  if (!anchor || !Number.isInteger(offset)) return null
  const month = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1))
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(anchor.getUTCDate(), lastDay)
  return `${month.toISOString().slice(0, 7)}-${String(day).padStart(2, '0')}`
}

/** Find the enrollment-cycle offset for a due date, or null if it is not on that cycle. */
export function monthlyDueOffset(enrollmentDate: string, dueDate: string): number | null {
  const anchor = parseDate(enrollmentDate)
  const due = parseDate(dueDate)
  if (!anchor || !due) return null
  const offset = monthIndex(due) - monthIndex(anchor)
  return monthlyDueDate(enrollmentDate, offset) === dueDate ? offset : null
}

/** The upcoming monthly due date strictly after the supplied date. */
export function nextMonthlyDueDate(enrollmentDate: string, afterDate: string): string | null {
  const anchor = parseDate(enrollmentDate)
  const after = parseDate(afterDate)
  if (!anchor || !after) return null
  let offset = Math.max(0, monthIndex(after) - monthIndex(anchor))
  let due = monthlyDueDate(enrollmentDate, offset)
  while (due && due <= afterDate) {
    offset += 1
    due = monthlyDueDate(enrollmentDate, offset)
  }
  return due
}

/** Due dates represented by a monthly payment. */
export function coveredBillingDates(coverageStart: string, quantity: number, enrollmentDate: string): string[] {
  const firstOffset = monthlyDueOffset(enrollmentDate, coverageStart)
  if (firstOffset === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 12) return []
  return Array.from({ length: quantity }, (_, index) => monthlyDueDate(enrollmentDate, firstOffset + index))
    .filter((date): date is string => date !== null)
}

/** Human-readable coverage period, e.g. Apr 5 – May 4, 2027. */
export function formatBillingCoverage(coverageStart: string, quantity: number, enrollmentDate: string): string {
  const periods = coveredBillingDates(coverageStart, quantity, enrollmentDate)
  if (!periods.length) return coverageStart
  const first = periods[0]
  const next = monthlyDueDate(enrollmentDate, (monthlyDueOffset(enrollmentDate, first) ?? 0) + periods.length)
  const last = next ? addDays(next, -1) : first
  const firstDate = parseDate(first)!
  const lastDate = parseDate(last)!
  const firstLabel = firstDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const lastLabel = lastDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  return `${firstLabel} – ${lastLabel}`
}
