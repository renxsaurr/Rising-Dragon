// Fees and limits for recording payments. No server-only imports: the Add payment popup uses these too.

/** Fee for one class session, in pesos. */
export const SESSION_FEE = 150

/** Monthly fee in pesos. null until the owner confirms the amount, so the form starts empty. */
export const MONTHLY_FEE: number | null = null

export const PAYMENT_TYPES = ['Monthly', 'Per session'] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const isPaymentType = (value: unknown): value is PaymentType =>
  PAYMENT_TYPES.some((type) => type === value)

export const MAX_MONTHS = 12
export const MAX_SESSIONS = 100

const monthStart = (date: string, add: number) => {
  const [year, month] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + add, 1))
}

const monthLabel = (date: Date, withYear: boolean) =>
  date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })

/** Months covered: "Oct 2026", "Oct – Nov 2026", or "Dec 2026 – Jan 2027" when the years differ. */
export function formatCoverage(coverageStart: string, months: number) {
  const first = monthStart(coverageStart, 0)
  if (months <= 1) return monthLabel(first, true)
  const last = monthStart(coverageStart, months - 1)
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear()
  return `${monthLabel(first, !sameYear)} – ${monthLabel(last, true)}`
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
}

/** What the new payment would cover: months for Monthly, one date's month for Per session. */
export type CoverageCheck =
  | { kind: 'Monthly'; coverageStart: string; quantity: number }
  | { kind: 'Per session'; date: string }

export type CoverageOverlap = {
  /** 'YYYY-MM' keys that are already covered, oldest first. */
  months: string[]
  /** The existing Monthly payments that cover them. */
  payments: MonthlyCoverage[]
}

/** 'YYYY-MM' keys for every month from coverageStart, e.g. ('2026-10-01', 2) → ['2026-10', '2026-11']. */
export function coveredMonths(coverageStart: string, months: number) {
  if (!/^\d{4}-\d{2}/.test(coverageStart) || !Number.isInteger(months) || months < 1) return []
  return Array.from({ length: months }, (_, index) => monthStart(coverageStart, index).toISOString().slice(0, 7))
}

/**
 * Months the new payment shares with existing Monthly payments (Paid or Unpaid), or null when none.
 * Older records without details never count, because they are not in `existing`.
 */
export function findCoverageOverlap(existing: MonthlyCoverage[], next: CoverageCheck): CoverageOverlap | null {
  const wanted =
    next.kind === 'Monthly'
      ? coveredMonths(next.coverageStart, next.quantity)
      : /^\d{4}-\d{2}-\d{2}$/.test(next.date) ? [next.date.slice(0, 7)] : []
  if (wanted.length === 0) return null

  const wantedMonths = new Set(wanted)
  const months = new Set<string>()
  const payments: MonthlyCoverage[] = []
  for (const payment of existing) {
    const shared = coveredMonths(payment.coverageStart, payment.quantity).filter((month) => wantedMonths.has(month))
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
      .map((payment) => `${formatCoverage(payment.coverageStart, payment.quantity)} (${payment.status} ${formatPeso(payment.amount)})`)
      .join('; ')
    return `Already covered: ${covered}. This might be a duplicate.`
  }
  const month = formatCoverage(`${overlap.months[0]}-01`, 1)
  return `${studentName || 'This student'} is covered by a Monthly payment for ${month}. Per-session payments are usually not needed while monthly is active.`
}
