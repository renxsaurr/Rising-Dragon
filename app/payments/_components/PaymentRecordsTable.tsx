'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import PaginatedListItems from '@/components/PaginatedListItems'
import { formatAmount } from '@/utils/payment-display'
import type { PaymentKind, PaymentRecord } from '@/utils/payment-records'
import { paymentDetail } from './payment-detail'

const TH = 'px-4 py-4 text-left text-xs font-medium text-gray-500'

const KIND_BADGES: Record<PaymentKind, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'text-emerald-700' },
  overdue: { label: 'Overdue', className: 'text-red-700' },
  soon: { label: 'Due soon', className: 'text-amber-700' },
  unpaid: { label: 'Unpaid', className: 'text-gray-700' },
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

export default function PaymentRecordsTable({
  rows,
  emptyText,
  branches,
  branch,
  month,
  months,
}: {
  rows: PaymentRecord[]
  emptyText: string
  branches: { key: string; name: string }[]
  branch: string
  month: string
  months: { key: string; label: string }[]
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean)
  const paidRows = rows.filter((row) => row.status === 'Paid')
  const visibleRows = normalizedSearch
    ? paidRows.filter((row) => {
        const searchableFields = [
          row.studentName,
          row.branchName,
          row.isActive ? 'Active' : 'Inactive',
          formatAmount(row.amount),
          String(row.amount),
          row.dueDate,
          formatDate(row.dueDate),
          row.paidDate,
          row.paidDate ? formatDate(row.paidDate) : '',
          row.paymentType,
          row.method,
          row.status,
          KIND_BADGES[row.kind].label,
          row.notes,
          paymentDetail(row),
        ]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .map((value) => value.toLowerCase())
        return searchTerms.every((term) =>
          searchableFields.some((field) => field.includes(term)),
        )
      })
    : paidRows

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="payment-record-search" className="sr-only">Search payment records</label>
          <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="payment-record-search"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search student, branch, or payment method"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm font-medium text-gray-950 placeholder:font-medium placeholder:text-gray-500 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear payment search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <form action="/payments" method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value="history" />
          <input type="hidden" name="historyPage" value="payments" />
          <label className="sr-only" htmlFor="payment-history-branch">Branches</label>
          <div className="relative">
            <select
              id="payment-history-branch"
              name="branch"
              defaultValue={branch}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-11 min-w-[175px] appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-4 pr-11 text-sm font-medium text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            >
              {branches.map((option) => (
                <option key={option.key} value={option.key}>{option.key === 'all' ? 'All branches' : option.name}</option>
              ))}
            </select>
            <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
          <label className="sr-only" htmlFor="payment-history-month">What month</label>
          <div className="relative">
            <select
              id="payment-history-month"
              name="month"
              defaultValue={month}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-11 min-w-[175px] appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-4 pr-11 text-sm font-medium text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            >
              {months.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
        </form>
        <p className="text-sm font-medium text-gray-700" aria-live="polite">
          {visibleRows.length} of {paidRows.length} record{paidRows.length === 1 ? '' : 's'}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm font-medium text-gray-800">
          {paidRows.length === 0 ? emptyText : `No payment records match “${searchQuery.trim()}”.`}
        </div>
      ) : (
        <>
          <div className="hidden xl:block">
            <div className="overflow-x-auto">
              <table aria-label="Payment history" className="w-full min-w-[1120px] table-fixed border-collapse border-y border-gray-200 bg-white text-left text-sm text-gray-950">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th scope="col" className={`${TH} w-[17%]`}>Student</th>
                    <th scope="col" className={`${TH} w-[13%]`}>Branch</th>
                    <th scope="col" className={`${TH} w-[10%]`}>Billing plan</th>
                    <th scope="col" className={`${TH} w-[11%]`}>Amount</th>
                    <th scope="col" className={`${TH} w-[12%]`}>Due Date</th>
                    <th scope="col" className={`${TH} w-[12%]`}>Paid Date</th>
                    <th scope="col" className={`${TH} w-[12%]`}>Payment method</th>
                    <th scope="col" className={`${TH} w-[13%]`}>Status</th>
                  </tr>
                </thead>
                <PaginatedTableRows itemLabel="successful payments" colSpan={8}>
                  {visibleRows.map((row) => {
                    const badge = KIND_BADGES[row.kind]
                    return (
                      <tr key={row.id} className="border-b border-gray-100 align-middle">
                        <td className="break-words px-4 py-5">
                          <p className="break-words text-sm font-medium text-gray-950">
                            {row.studentName}
                            {!row.isActive && (
                              <span className="ml-2 align-middle text-xs font-medium text-gray-600">
                                Inactive
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{row.branchName || '—'}</td>
                        <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{row.paymentType || '—'}</td>
                        <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{formatAmount(row.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{formatDate(row.dueDate)}</td>
                        <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{row.paidDate ? formatDate(row.paidDate) : '—'}</td>
                        <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{row.method || '—'}</td>
                        <td className="px-4 py-5">
                          <span className={`whitespace-nowrap text-sm font-medium ${badge.className}`}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </PaginatedTableRows>
              </table>
            </div>
          </div>

          <div className="divide-y divide-gray-100 xl:hidden">
            <PaginatedListItems itemLabel="payment records">
              {visibleRows.map((row) => {
                const badge = KIND_BADGES[row.kind]
                return (
                  <article key={row.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium text-gray-950">
                          {row.studentName}
                          {!row.isActive && <span className="ml-2 text-xs font-normal text-gray-600">Inactive</span>}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-gray-700">{row.branchName || '—'}</p>
                      </div>
                      <span className={`shrink-0 whitespace-nowrap text-sm font-medium ${badge.className}`}>{badge.label}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Billing plan</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.paymentType || '—'}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount</dt><dd className="mt-1 text-sm font-medium text-gray-950">{formatAmount(row.amount)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Due Date</dt><dd className="mt-1 text-sm font-medium text-gray-950">{formatDate(row.dueDate)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Paid Date</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.paidDate ? formatDate(row.paidDate) : '—'}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Payment method</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.method || '—'}</dd></div>
                      <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</dt><dd className={`mt-1 text-sm font-medium ${badge.className}`}>{badge.label}</dd></div>
                    </dl>
                  </article>
                )
              })}
            </PaginatedListItems>
          </div>
        </>
      )}
    </div>
  )
}
