// Used by the server page and the client filter, so nothing server-only here.
export const PAYMENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'soon', label: 'Due soon' },
  { key: 'paid', label: 'Paid' },
] as const

export type PaymentFilterKey = (typeof PAYMENT_FILTERS)[number]['key']

export const isPaymentFilter = (value: unknown): value is PaymentFilterKey =>
  PAYMENT_FILTERS.some((filter) => filter.key === value)

export const PAYMENT_TABS = ['notpaid', 'missed', 'records'] as const

export type PaymentTab = (typeof PAYMENT_TABS)[number]

export const HISTORY_PAGES = ['business', 'payments', 'reminders'] as const
export type HistoryPage = (typeof HISTORY_PAGES)[number]

export const isPaymentTab = (value: unknown): value is PaymentTab =>
  PAYMENT_TABS.some((tab) => tab === value)

/** Reminder history filters in the URL. Defaults ("all", page 1, empty search) are left out. */
export type HistoryQuery = {
  hq?: string
  hstatus?: string
  htype?: string
  hbranch?: string
  hpage?: number
}

/** Build a /payments link. "all" branches and "all" payments are left out of the URL. */
export function paymentsHref({
  month,
  branch,
  filter,
  tab,
  view,
  history,
  historyPage,
}: {
  month: string
  branch?: string
  filter?: PaymentFilterKey
  /** Left out = the page picks its default tab. */
  tab?: PaymentTab
  view?: 'history' | 'reports'
  history?: HistoryQuery
  historyPage?: HistoryPage
}) {
  const params = new URLSearchParams({ month })
  if (branch && branch !== 'all') params.set('branch', branch)
  if (filter && filter !== 'all') params.set('filter', filter)
  if (tab) params.set('tab', tab)
  if (view) params.set('view', view)
  if (view === 'history' && historyPage) params.set('historyPage', historyPage)
  if (view === 'history' && history) {
    if (history.hq) params.set('hq', history.hq)
    if (history.hstatus && history.hstatus !== 'all') params.set('hstatus', history.hstatus)
    if (history.htype && history.htype !== 'all') params.set('htype', history.htype)
    if (history.hbranch && history.hbranch !== 'all') params.set('hbranch', history.hbranch)
    if (history.hpage && history.hpage > 1) params.set('hpage', String(history.hpage))
  }
  return `/payments?${params}`
}
