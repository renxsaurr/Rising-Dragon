import Link from 'next/link'
import HistoryToolbar from './HistoryToolbar'
import ReminderHistoryTable from './ReminderHistoryTable'
import { paymentsHref, type HistoryQuery, type PaymentFilterKey } from './payments-url'
import { REMINDER_TYPES } from '@/utils/payment-reminders'
import { HISTORY_PAGE_SIZE, HISTORY_STATUSES, type ReminderHistory } from '@/utils/reminder-history'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'
const PAGE_BUTTON = 'rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium'

// Same boxes as the stats on the branch cards.
function StatBox({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`min-w-0 rounded-lg border bg-white px-2.5 py-2 ${danger ? 'border-red-200' : 'border-gray-200'}`}>
      <p className={`text-lg font-bold leading-none ${danger ? 'text-red-600' : 'text-black'}`}>{value.toLocaleString('en-US')}</p>
      <p className="mt-1 text-[11px] font-semibold text-black">{label}</p>
    </div>
  )
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: string }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${PAGE_BUTTON} cursor-not-allowed text-gray-400`}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} className={`${PAGE_BUTTON} text-gray-700 hover:border-gray-400 hover:bg-gray-50 ${FOCUS}`}>
      {children}
    </Link>
  )
}

export default function ReminderHistoryView({
  history,
  base,
}: {
  history: ReminderHistory
  /** The payments view's own params, kept in every link. */
  base: { month: string; branch: string; filter: PaymentFilterKey }
}) {
  const { filters, rows, total, pageCount, summary, branches } = history
  const current = { hq: filters.q, hstatus: filters.status, htype: filters.type, hbranch: filters.branch }
  const href = (next: Partial<HistoryQuery>) =>
    paymentsHref({ ...base, view: 'history', history: { ...current, hpage: filters.page, ...next } })
  const hasFilters = Boolean(filters.q) || filters.status !== 'all' || filters.type !== 'all' || filters.branch !== 'all'
  const branchName = branches.find((branch) => String(branch.id) === filters.branch)?.name
  const first = total === 0 ? 0 : (filters.page - 1) * HISTORY_PAGE_SIZE + 1
  const last = Math.min(filters.page * HISTORY_PAGE_SIZE, total)

  return (
    <>
      <Link
        href={paymentsHref(base)}
        scroll={false}
        className={`mb-3 inline-flex items-center gap-1 rounded text-sm font-medium text-gray-700 hover:text-black ${FOCUS}`}
      >
        ← Back to payments
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Reminder history</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Every reminder email, newest first{branchName ? ` · counts for ${branchName}` : ''}.
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[320px]">
          <StatBox label="Sent" value={summary.sent} />
          <StatBox label="Failed" value={summary.failed} danger />
          <StatBox label="Skipped" value={summary.skipped} />
        </div>
      </div>

      {summary.failed > 0 && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">
            {summary.failed} reminder{summary.failed === 1 ? '' : 's'} failed
          </span>
          {' · '}
          <Link href={href({ hstatus: 'Failed', hpage: 1 })} scroll={false} className="font-semibold underline underline-offset-2 hover:text-red-800">
            Show failed
          </Link>
        </p>
      )}

      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          {/* key: a new set of filters (e.g. "Clear filters") resets the search box */}
          <HistoryToolbar
            key={JSON.stringify(current)}
            base={base}
            current={current}
            statuses={HISTORY_STATUSES}
            types={REMINDER_TYPES}
            branches={branches}
          />
        </div>

        {rows.length === 0 ? (
          <div className="p-5">
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
              <p className="text-sm font-medium text-gray-800">
                {hasFilters ? 'No reminders match these filters.' : 'No reminders yet.'}
              </p>
              {hasFilters && (
                <Link
                  href={paymentsHref({ ...base, view: 'history' })}
                  scroll={false}
                  className="mt-2 inline-block text-xs font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-black"
                >
                  Clear filters
                </Link>
              )}
            </div>
          </div>
        ) : (
          <ReminderHistoryTable rows={rows} />
        )}

        {total > 0 && (
          <nav aria-label="Reminder history pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <p className="text-[13px] text-gray-500">
              Showing {first}–{last} of {total.toLocaleString('en-US')}
            </p>
            <div className="flex gap-2">
              <PageLink href={href({ hpage: filters.page - 1 })} disabled={filters.page <= 1}>Previous</PageLink>
              <PageLink href={href({ hpage: filters.page + 1 })} disabled={filters.page >= pageCount}>Next</PageLink>
            </div>
          </nav>
        )}
      </section>
    </>
  )
}
