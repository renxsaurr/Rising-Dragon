import { formatAmount } from '@/utils/payment-reminders'
import type { BranchPaymentStats, NotPaidGroup } from '@/utils/payment-records'

// Card classes copied from the Attendance class cards.
export default function BranchCards({
  branches,
  notPaid,
}: {
  branches: BranchPaymentStats[]
  notPaid: Record<string, NotPaidGroup>
}) {
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {branches.map((branch) => {
        // floor, so 99.6% never shows as 100% while something is still unpaid
        const percent = branch.expected > 0 ? Math.floor((branch.collected / branch.expected) * 100) : null
        const group = notPaid[branch.key]
        return (
          <article
            key={branch.key}
            className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-gray-950">{branch.name}</p>
              </div>
              <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-900">
                {percent === null ? '—' : `${percent}%`}
              </span>
            </div>

            <div className="mt-3">
              <p className="text-2xl font-semibold tracking-tight text-gray-950">{formatAmount(branch.collected)}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-700">Collected of {formatAmount(branch.expected)} expected</p>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-black" style={{ width: `${percent ?? 0}%` }} />
            </div>

            <div className="mt-auto grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-100 pt-3">
              <div className="min-w-0 pr-2">
                <p className="text-lg font-semibold leading-none text-gray-950">{branch.paidCount}</p>
                <p className="mt-1 text-xs font-medium text-gray-700">Paid</p>
              </div>
              <div className="min-w-0 px-2">
                <p className="text-lg font-semibold leading-none text-gray-950">{branch.unpaidCount}</p>
                <p className="mt-1 text-xs font-medium text-gray-700">Unpaid</p>
              </div>
              <div className="min-w-0 pl-2">
                <p className="text-lg font-semibold leading-none text-red-700">{branch.overdueCount}</p>
                <p className="mt-1 text-xs font-medium text-gray-700">Overdue</p>
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
          </article>
        )
      })}
    </div>
  )
}
