import Link from 'next/link'
import { paymentsHref, type PaymentFilterKey } from './payments-url'
import { formatAmount } from '@/utils/payment-reminders'
import type { BranchPaymentStats, NotPaidGroup } from '@/utils/payment-records'

// Card classes copied from the Attendance class cards.
export default function BranchCards({
  branches,
  notPaid,
  selectedKey,
  month,
  filter,
}: {
  branches: BranchPaymentStats[]
  notPaid: Record<string, NotPaidGroup>
  selectedKey: string
  month: string
  filter: PaymentFilterKey
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {branches.map((branch) => {
        const active = branch.key === selectedKey
        // floor, so 99.6% never shows as 100% while something is still unpaid
        const percent = branch.expected > 0 ? Math.floor((branch.collected / branch.expected) * 100) : null
        const group = notPaid[branch.key]
        return (
          <Link
            key={branch.key}
            href={paymentsHref({ month, branch: branch.key, filter })}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={`min-w-0 rounded-xl border bg-white p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${active ? 'border-black shadow-sm ring-1 ring-black' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-black">{branch.name}</p>
                <p className="mt-0.5 text-xs text-black">
                  <span className="font-semibold">{formatAmount(branch.collected)}</span> collected of{' '}
                  {formatAmount(branch.expected)} expected
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-black">
                {percent === null ? '—' : `${percent}%`}
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-black" style={{ width: `${percent ?? 0}%` }} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
              <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                <p className="text-lg font-bold leading-none text-black">{branch.paidCount}</p>
                <p className="mt-1 text-[11px] font-semibold text-black">Paid</p>
              </div>
              <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                <p className="text-lg font-bold leading-none text-black">{branch.unpaidCount}</p>
                <p className="mt-1 text-[11px] font-semibold text-black">Unpaid</p>
              </div>
              <div className="min-w-0 rounded-lg border border-red-200 bg-white px-2.5 py-2">
                <p className="text-lg font-bold leading-none text-red-600">{branch.overdueCount}</p>
                <p className="mt-1 text-[11px] font-semibold text-black">Overdue</p>
              </div>
            </div>

            {group && group.activeCount > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                {group.notPaidCount > 0 ? (
                  <>
                    <span className="font-semibold text-amber-700">{group.notPaidCount}</span> of {group.activeCount}{' '}
                    students not paid yet
                  </>
                ) : (
                  <span className="font-medium text-emerald-700">All students paid</span>
                )}
              </p>
            )}
          </Link>
        )
      })}
    </div>
  )
}
