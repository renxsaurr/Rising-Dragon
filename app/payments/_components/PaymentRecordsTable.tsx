'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import MarkPaidButton from './MarkPaidButton'
import SendReminderButton from './SendReminderButton'
import { sendButtonState } from './reminder-button-state'
import RowActionsMenu from '@/components/RowActionsMenu'
import RowActionItem, { ROW_ACTION_CLASS } from '@/components/RowActionItem'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import PaginatedListItems from '@/components/PaginatedListItems'
import { REMINDER_TYPES, formatAmount } from '@/utils/payment-display'
import type { PaymentKind, PaymentRecord } from '@/utils/payment-records'
import type { ReminderSchedule } from '@/utils/reminder-timing'
import { paymentDetail } from './payment-detail'

const TH = 'px-4 py-4 text-left text-xs font-medium text-gray-500'

const KIND_BADGES: Record<PaymentKind, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 ring-red-600/20' },
  soon: { label: 'Due soon', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  unpaid: { label: 'Unpaid', className: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const formatDayMonth = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

const formatSentDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

// "5 days overdue", "Due in 2 days", "Paid Oct 1 · Online"
function statusNote(row: PaymentRecord) {
  if (row.status === 'Paid') {
    return [row.paidDate ? `Paid ${formatDayMonth(row.paidDate)}` : 'Paid', row.method].filter(Boolean).join(' · ')
  }
  const days = row.daysUntilDue
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

// The latest reminder type that has a row: After due > Due today > Before due.
function LatestReminder({ row }: { row: PaymentRecord }) {
  const latest = [...row.reminders].sort(
    (a, b) => REMINDER_TYPES.indexOf(b.reminderType) - REMINDER_TYPES.indexOf(a.reminderType),
  )[0]
  if (!latest) return <span className="text-sm text-gray-400">—</span>

  const detail =
    latest.status === 'Sent' && latest.sentAt
      ? `Sent ${formatSentDate(latest.sentAt)}`
      : latest.status === 'Scheduled'
        ? 'Sending…'
        : latest.status
  return (
    <span className={`whitespace-nowrap text-sm font-medium ${latest.status === 'Failed' ? 'text-red-700' : 'text-gray-950'}`}>
      {latest.reminderType} · {detail}
    </span>
  )
}

function PaymentRecordActions({ row, today, reminderSchedule }: {
  row: PaymentRecord
  today: string
  reminderSchedule: ReminderSchedule
}) {
  if (row.status !== 'Unpaid') return <span className="block text-right text-sm font-medium text-gray-500">—</span>

  const reminderState = sendButtonState(row, today, reminderSchedule)
  return (
    <div className="flex w-full justify-end">
      <RowActionsMenu>
        <MarkPaidButton
          payment={{
            id: row.id,
            studentName: row.studentName,
            amount: formatAmount(row.amount),
            dueDate: formatDate(row.dueDate),
          }}
          today={today}
          trigger={<RowActionItem>Mark as paid</RowActionItem>}
        />
        <SendReminderButton paymentId={row.id} {...reminderState} trigger={<RowActionItem disabled={Boolean(reminderState.disabledLabel || reminderState.disabledReason)} className={`${ROW_ACTION_CLASS} disabled:cursor-not-allowed disabled:text-gray-400`}>{reminderState.disabledLabel ?? 'Send reminder'}</RowActionItem>} />
      </RowActionsMenu>
    </div>
  )
}

export default function PaymentRecordsTable({
  rows,
  today,
  reminderSchedule,
  showBranch,
  emptyText,
}: {
  rows: PaymentRecord[]
  today: string
  reminderSchedule: ReminderSchedule
  showBranch: boolean
  emptyText: string
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean)
  const visibleRows = normalizedSearch
    ? rows.filter((row) => {
        const searchableFields = [
          row.studentName,
          row.branchName,
          row.isActive ? 'Active' : 'Inactive',
          formatAmount(row.amount),
          String(row.amount),
          row.dueDate,
          formatDate(row.dueDate),
          row.paidDate,
          row.paymentType,
          row.status,
          row.kind,
          KIND_BADGES[row.kind].label,
          row.method,
          row.notes,
          paymentDetail(row),
          statusNote(row),
          ...row.reminders.flatMap((reminder) => [reminder.reminderType, reminder.status]),
        ]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .map((value) => value.toLowerCase())
        return searchTerms.every((term) =>
          searchableFields.some((field) => field.includes(term)),
        )
      })
    : rows

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <div className="relative w-full max-w-md">
          <label htmlFor="payment-record-search" className="sr-only">Search payment records</label>
          <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="payment-record-search"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search student, branch, amount, status, or due date"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm font-medium text-gray-950 placeholder:font-medium placeholder:text-gray-500 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
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
        <p className="text-sm font-medium text-gray-950" aria-live="polite">
          {visibleRows.length} of {rows.length} record{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm font-medium text-gray-800">
          {rows.length === 0 ? emptyText : `No payment records match “${searchQuery.trim()}”.`}
        </div>
      ) : (
        <>
          <div className="hidden xl:block">
            <div className="overflow-x-auto">
              <table aria-label="Payment history" className="w-full min-w-[1040px] table-fixed border-collapse bg-white text-left text-sm text-gray-950">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th scope="col" className={`${TH} w-[21%]`}>Student</th>
                    <th scope="col" className={`${TH} w-[18%]`}>Amount</th>
                    <th scope="col" className={`${TH} w-[14%]`}>Due date</th>
                    <th scope="col" className={`${TH} w-[17%]`}>Status</th>
                    <th scope="col" className={`${TH} w-[22%]`}>Reminder</th>
                    <th scope="col" className={`${TH} w-[8%] text-right`}>Actions</th>
                  </tr>
                </thead>
                <PaginatedTableRows itemLabel="payment records" colSpan={6}>
                  {visibleRows.map((row) => {
                    const badge = KIND_BADGES[row.kind]
                    return (
                      <tr key={row.id} className="border-b border-gray-100 align-middle transition-colors last:border-b-0 hover:bg-gray-50/60">
                        <td className="break-words px-4 py-5">
                          <p className="break-words text-sm font-medium text-gray-950">
                            {row.studentName}
                            {!row.isActive && (
                              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-[11px] font-medium text-gray-600">
                                Inactive
                              </span>
                            )}
                          </p>
                          {showBranch && <p className="mt-0.5 text-xs font-normal text-gray-700">{row.branchName}</p>}
                        </td>
                        <td className="break-words px-4 py-5">
                          <p className="whitespace-nowrap text-sm font-medium text-gray-950">{formatAmount(row.amount)}</p>
                          {paymentDetail(row) && (
                            <p className="mt-0.5 whitespace-nowrap text-xs font-normal text-gray-700">{paymentDetail(row)}</p>
                          )}
                          {row.notes && (
                            <p className="mt-0.5 max-w-[200px] whitespace-normal break-words text-xs font-normal text-gray-700">
                              {row.notes}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{formatDate(row.dueDate)}</td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                            {badge.label}
                          </span>
                          <p className={`mt-1 whitespace-nowrap text-xs font-normal ${row.kind === 'overdue' ? 'text-red-700' : 'text-gray-700'}`}>
                            {statusNote(row)}
                          </p>
                        </td>
                        <td className="break-words px-4 py-5">
                          <LatestReminder row={row} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <PaymentRecordActions row={row} today={today} reminderSchedule={reminderSchedule} />
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
                        {showBranch && <p className="mt-1 text-xs font-medium text-gray-700">{row.branchName}</p>}
                      </div>
                      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>{badge.label}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount</dt><dd className="mt-1 text-sm font-medium text-gray-950">{formatAmount(row.amount)}{paymentDetail(row) && <span className="mt-0.5 block text-xs font-normal text-gray-700">{paymentDetail(row)}</span>}{row.notes && <span className="mt-0.5 block break-words text-xs font-normal text-gray-700">{row.notes}</span>}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Due date</dt><dd className="mt-1 text-sm font-medium text-gray-950">{formatDate(row.dueDate)}<span className={`mt-0.5 block text-xs font-normal ${row.kind === 'overdue' ? 'text-red-700' : 'text-gray-700'}`}>{statusNote(row)}</span></dd></div>
                      <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reminder</dt><dd className="mt-1"><LatestReminder row={row} /></dd></div>
                    </dl>
                    <div className="mt-3 flex justify-end border-t border-gray-100 pt-2">
                      <PaymentRecordActions row={row} today={today} reminderSchedule={reminderSchedule} />
                    </div>
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
