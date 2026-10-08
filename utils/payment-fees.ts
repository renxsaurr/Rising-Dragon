// Fees and limits for recording payments. No server-only imports: the Add payment popup uses these too.
import { coveredBillingDates, formatBillingCoverage } from '@/utils/billing-cycle'

/** Fee for one class session, in pesos. */
export const SESSION_FEE = 150

export const PAYMENT_TYPES = ['Monthly', 'Per session'] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const isPaymentType = (value: unknown): value is PaymentType =>
  PAYMENT_TYPES.some((type) => type === value)

export const MAX_MONTHS = 12
export const MAX_SESSIONS = 100

/** Enrollment-anniversary coverage, e.g. "Apr 5 – May 4, 2027". */
export function formatCoverage(coverageStart: string, months: number, enrollmentDate = coverageStart) {
  return formatBillingCoverage(coverageStart, months, enrollmentDate)
}

/** "₱1,500.00", the same format the server's formatAmount uses. */
export const formatPeso = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

/** An existing Monthly payment with details, as used by the overlap check. */
export type MonthlyCoverage = {
  coverageStart: string
  quantity: number
  status: 'Paid' | 'Unpaid'
  amount: number
  enrollmentDate?: string | null
}

/** What the new payment would cover: months for Monthly, one date's month for Per session. */
export type CoverageCheck =
  | { kind: 'Monthly'; coverageStart: string; quantity: number; enrollmentDate?: string | null }
  | { kind: 'Per session'; date: string }

export type CoverageOverlap = {
  /** 'YYYY-MM' keys that are already covered, oldest first. */
  months: string[]
  /** The existing Monthly payments that cover them. */
  payments: MonthlyCoverage[]
}

/** Month keys of the installment due dates represented by a monthly record. */
export function coveredMonths(coverageStart: string, months: number, enrollmentDate = coverageStart) {
  return coveredBillingDates(coverageStart, months, enrollmentDate).map((date) => date.slice(0, 7))
}

/**
 * Months the new payment shares with existing Monthly payments (Paid or Unpaid), or null when none.
 * Older records without details never count, because they are not in `existing`.
 */
export function findCoverageOverlap(existing: MonthlyCoverage[], next: CoverageCheck): CoverageOverlap | null {
  const wanted =
    next.kind === 'Monthly'
      ? coveredMonths(next.coverageStart, next.quantity, next.enrollmentDate ?? next.coverageStart)
      : /^\d{4}-\d{2}-\d{2}$/.test(next.date) ? [next.date.slice(0, 7)] : []
  if (wanted.length === 0) return null

  const wantedMonths = new Set(wanted)
  const months = new Set<string>()
  const payments: MonthlyCoverage[] = []
  for (const payment of existing) {
    const shared = coveredMonths(payment.coverageStart, payment.quantity, payment.enrollmentDate ?? payment.coverageStart).filter((month) => wantedMonths.has(month))
    if (shared.length) {
      payments.push(payment)
      for (const month of shared) months.add(month)
    }
  }
  return payments.length ? { months: [...months].sort(), payments } : null
}

/** The warning text. Same words in the popup and from the server. */
export function overlapMessage(overlap: CoverageOverlap, type: PaymentType, studentName?: string) {
  if (type === 'Monthly') {
    const covered = overlap.payments
      .map((payment) => `${formatCoverage(payment.coverageStart, payment.quantity, payment.enrollmentDate ?? payment.coverageStart)} (${payment.status} ${formatPeso(payment.amount)})`)
      .join('; ')
    return `Already covered: ${covered}. This might be a duplicate.`
  }
  const month = new Date(`${overlap.months[0]}-01T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
  return `${studentName || 'This student'} is covered by a Monthly payment for ${month}. Per-session payments are usually not needed while monthly is active.`
}
