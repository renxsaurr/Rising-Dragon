'use client'

import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { paymentsHref, type HistoryPage, type HistoryQuery, type PaymentFilterKey } from './payments-url'

const PAGES: { id: HistoryPage; label: string }[] = [
  { id: 'business', label: 'Business intelligence' },
  { id: 'payments', label: 'Payment history' },
  { id: 'reminders', label: 'Reminder history' },
]

export default function HistoryPageTabs({
  active,
  month,
  branch,
  filter,
  history,
}: {
  active: HistoryPage
  month: string
  branch: string
  filter: PaymentFilterKey
  history?: HistoryQuery
}) {
  const router = useRouter()

  return (
    <div className="mb-5">
      <label htmlFor="history-page-select" className="sr-only">History section</label>
      <div className="relative w-full max-w-xs">
        <select
          id="history-page-select"
          value={active}
          onChange={(event) => {
            router.push(
              paymentsHref({
                month,
                branch,
                filter,
                view: 'history',
                historyPage: event.target.value as HistoryPage,
                history,
              }),
              { scroll: false },
            )
          }}
          className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm font-medium text-gray-950 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-black/10"
        >
          {PAGES.map((page) => <option key={page.id} value={page.id}>{page.label}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-700" />
      </div>
    </div>
  )
}
