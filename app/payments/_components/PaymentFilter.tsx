'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PAYMENT_FILTERS, isPaymentFilter, paymentsHref, type PaymentFilterKey, type PaymentTab } from './payments-url'

// Dropdown classes copied from the Attendance roster filter.
export default function PaymentFilter({
  month,
  branch,
  filter,
  counts,
  tab,
}: {
  month: string
  branch: string
  filter: PaymentFilterKey
  counts: Record<PaymentFilterKey, number>
  /** The tab chosen in the URL, kept in the links. Left out = the page's default tab. */
  tab?: PaymentTab
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <>
      <label className="sr-only" htmlFor="payment-filter">Filter payments</label>
      <select
        id="payment-filter"
        // key resets the uncontrolled value when the URL (and so the filter prop) changes
        key={filter}
        defaultValue={filter}
        aria-busy={pending}
        onChange={(event) => {
          const next = event.target.value
          if (!isPaymentFilter(next)) return
          startTransition(() => router.push(paymentsHref({ month, branch, filter: next, tab }), { scroll: false }))
        }}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-black/10"
      >
        {PAYMENT_FILTERS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({counts[option.key]})
          </option>
        ))}
      </select>
    </>
  )
}
