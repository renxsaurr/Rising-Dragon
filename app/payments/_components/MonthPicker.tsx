import Link from 'next/link'
import { paymentsHref, type HistoryPage, type PaymentFilterKey, type PaymentTab } from './payments-url'
import { formatMonth, shiftMonth } from '@/utils/payment-records'

const ARROW =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-black transition-colors hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

// ‹ October 2026 › — the month label copies Attendance's black date picker button.
export default function MonthPicker({
  month,
  branch,
  filter,
  tab,
  view,
  historyPage,
}: {
  month: string
  branch: string
  filter: PaymentFilterKey
  /** The tab chosen in the URL, kept in the links. Left out = the page's default tab. */
  tab?: PaymentTab
  view?: 'history' | 'reports'
  historyPage?: HistoryPage
}) {
  const previous = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)

  return (
    <nav aria-label="Choose month" className="flex items-center gap-1.5">
      <Link
        href={paymentsHref({ month: previous, branch, filter, tab, view, historyPage })}
        scroll={false}
        aria-label={`Previous month, ${formatMonth(previous)}`}
        className={ARROW}
      >
        <Chevron direction="left" />
      </Link>
      <span className="inline-flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 text-sm font-semibold text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {formatMonth(month)}
      </span>
      <Link
        href={paymentsHref({ month: next, branch, filter, tab, view, historyPage })}
        scroll={false}
        aria-label={`Next month, ${formatMonth(next)}`}
        className={ARROW}
      >
        <Chevron direction="right" />
      </Link>
    </nav>
  )
}
