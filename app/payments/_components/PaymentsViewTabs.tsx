import Link from 'next/link'
import { paymentsHref, type PaymentFilterKey, type PaymentTab } from './payments-url'

type PaymentsView = 'payments' | 'history'

export default function PaymentsViewTabs({
  active,
  month,
  branch,
  filter,
  tab,
  className = 'mb-5',
}: {
  active: PaymentsView
  month: string
  branch: string
  filter: PaymentFilterKey
  tab?: PaymentTab
  className?: string
}) {
  const tabs = [
    { id: 'payments' as const, label: 'Payments', href: paymentsHref({ month, branch, filter, tab }) },
    { id: 'history' as const, label: 'History', href: paymentsHref({ month, branch, filter, tab, view: 'history', historyPage: 'business' }) },
  ]

  return (
    <nav aria-label="Payment pages" className={className}>
      <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={false}
            aria-current={active === tab.id ? 'page' : undefined}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
              active === tab.id
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-950'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
