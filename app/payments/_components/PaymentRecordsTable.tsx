'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import MarkPaidButton from './MarkPaidButton'
import SendReminderButton from './SendReminderButton'
import { sendButtonState } from './reminder-button-state'
import RowActionsMenu from '@/components/RowActionsMenu'
import RowActionItem, { ROW_ACTION_CLASS } from '@/components/RowActionItem'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import { formatBeltLabel } from '@/utils/belts'
import { REMINDER_TYPES, formatAmount } from '@/utils/payment-display'
import type { PaymentKind, PaymentRecord } from '@/utils/payment-records'
import type { ReminderSchedule } from '@/utils/reminder-timing'
import { paymentDetail } from './payment-detail'

const TH = 'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-950'

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
    <span className={`whitespace-nowrap text-[13px] ${latest.status === 'Failed' ? 'text-red-600' : 'text-gray-700'}`}>
      {latest.reminderType} · {detail}
    </span>
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
          formatBeltLabel(row.beltLevel),
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
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
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
        <p className="text-xs text-gray-500" aria-live="polite">
          {visibleRows.length} of {rows.length} record{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="p-5">
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
            <p className="text-sm font-medium text-gray-800">
              {rows.length === 0
                ? emptyText
                : `No payment records match “${searchQuery.trim()}”.`}
            </p>
            {rows.length > 0 && (
              <p className="mt-1 text-[13px] text-gray-500">Try another name or payment detail.</p>
            )}
          </div>
        </div>
      ) : (
        // The table keeps its width and scrolls inside this box on small screens.
        <div className="overflow-x-auto">
      <table className="system-data-table payment-records-table w-full min-w-[880px] border-collapse text-left">
        <thead className="border-b border-gray-100 bg-white">
          <tr>
            <th className={`${TH} pl-5`}>Student</th>
            <th className={TH}>Amount</th>
            <th className={TH}>Due date</th>
            <th className={TH}>Status</th>
            <th className={TH}>Reminder</th>
            <th className={`${TH} pr-5 text-right`}>Action</th>
          </tr>
        </thead>
        <PaginatedTableRows itemLabel="payment records" colSpan={6}>
          {visibleRows.map((row) => {
            const badge = KIND_BADGES[row.kind]
            const reminderState = sendButtonState(row, today, reminderSchedule)
            return (
              <tr key={row.id} className="align-top">
                <td className="px-5 py-3">
                  <p className="break-words text-sm font-medium text-gray-900">
                    {row.studentName}
                    {!row.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-[11px] font-medium text-gray-600">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-700">
                    {[formatBeltLabel(row.beltLevel), showBranch ? row.branchName : null].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="whitespace-nowrap text-sm font-medium text-gray-900">{formatAmount(row.amount)}</p>
                  {paymentDetail(row) && (
                    <p className="mt-0.5 whitespace-nowrap text-xs text-gray-700">{paymentDetail(row)}</p>
                  )}
                  {row.notes && (
                    <p className="mt-0.5 max-w-[200px] whitespace-normal break-words text-xs text-gray-700">
                      {row.notes}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{formatDate(row.dueDate)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                    {badge.label}
                  </span>
                  <p className={`mt-1 whitespace-nowrap text-xs ${row.kind === 'overdue' ? 'text-red-700' : 'text-gray-700'}`}>
                    {statusNote(row)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <LatestReminder row={row} />
                </td>
                <td className="px-3 py-3 pr-5">
                  {row.status === 'Unpaid' ? (
                    <div className="flex justify-end">
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
                  ) : (
                    <span className="block text-right text-sm text-gray-500">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </PaginatedTableRows>
      </table>
        </div>
      )}
    </div>
  )
}
