'use client'

import { useCallback, useState, type ReactNode } from 'react'
import ModalShell, { BUTTON_SECONDARY, FOCUS_RING } from './ModalShell'
import ReminderReviewModal from './ReminderReviewModal'
import RetryReminderButton from './RetryReminderButton'
import { formatPeso } from '@/utils/payment-fees'
import type { ReminderStatus } from '@/utils/payment-reminders'
import type { HistoryRow } from '@/utils/reminder-history'
import RowActionsMenu from '@/components/RowActionsMenu'
import RowActionItem, { ROW_ACTION_CLASS } from '@/components/RowActionItem'
import PaginatedTableRows from '@/components/PaginatedTableRows'

const TH = 'px-4 py-4 text-left text-xs font-medium text-gray-500'

const STATUS_BADGES: Record<ReminderStatus, { label: string; className: string }> = {
  Sent: { label: 'Sent', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  Failed: { label: 'Failed', className: 'bg-red-50 text-red-700 ring-red-600/20' },
  Skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  Scheduled: { label: 'Sending…', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
}

// Timestamps are shown in Manila time; due/scheduled dates are plain dates.
const formatDay = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const formatDateTime = (timestamp: string | null) => (timestamp ? `${formatDay(timestamp)}, ${formatTime(timestamp)}` : '—')
const formatPlainDate = (date: string | null) =>
  date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

/** Sent rows show when they were sent; other rows when the attempt finished (or started, while sending). */
function rowTime(row: HistoryRow) {
  if (row.status === 'Sent' && row.sentAt) return row.sentAt
  if (row.status === 'Scheduled') return row.lastAttemptAt ?? row.createdAt
  return row.completedAt ?? row.createdAt
}

function StatusBadge({ status }: { status: ReminderStatus }) {
  const badge = STATUS_BADGES[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function ReminderRowActions({ row, onView, onRetry }: {
  row: HistoryRow
  onView: () => void
  onRetry: () => void
}) {
  return (
    <RowActionsMenu>
      <RowActionItem onClick={onView}>View details</RowActionItem>
      {row.status === 'Failed' && <RetryReminderButton onRetry={onRetry} className={ROW_ACTION_CLASS} />}
    </RowActionsMenu>
  )
}

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-950">{children}</dd>
    </div>
  )
}

function ReminderDetailsModal({ row, onClose }: { row: HistoryRow; onClose: () => void }) {
  return (
    <ModalShell title={`${row.reminderType} reminder`} description={`${row.studentName} · ${row.branchName}`} busy={false} onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label="Status"><StatusBadge status={row.status} /></Detail>
          <Detail label="Type">{row.reminderType}</Detail>
          <Detail label="Sent to" wide>{row.recipientEmail}</Detail>
          <Detail label="Payment">
            {row.amount === null ? '—' : formatPeso(row.amount)}
            {row.dueDate && <span className="text-gray-500"> · Due {formatPlainDate(row.dueDate)}</span>}
          </Detail>
          <Detail label="Scheduled for">{formatPlainDate(row.scheduledFor)}</Detail>
          <Detail label="Attempts">{row.attemptCount}</Detail>
          <Detail label="Last attempt">{formatDateTime(row.lastAttemptAt)}</Detail>
          {row.sentAt ? (
            <Detail label="Sent at">{formatDateTime(row.sentAt)}</Detail>
          ) : (
            <Detail label="Finished at">{formatDateTime(row.completedAt)}</Detail>
          )}
          <Detail label="Sent by">{row.sentByName ?? 'Automatic (old daily job)'}</Detail>
        </dl>

        {row.errorMessage &&
          (row.status === 'Failed' ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              <p className="font-semibold">Error</p>
              <p className="mt-0.5 break-words">{row.errorMessage}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-700">
              <p className="font-semibold">Reason</p>
              <p className="mt-0.5 break-words">{row.errorMessage}</p>
            </div>
          ))}
      </div>
      <div className="shrink-0 flex justify-end border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
        <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Close</button>
      </div>
    </ModalShell>
  )
}

export default function ReminderHistoryTable({ rows, searchQuery }: { rows: HistoryRow[]; searchQuery: string }) {
  const [detailsId, setDetailsId] = useState<number | null>(null)
  // The Retry popup lives here, not in the row, so it stays open after the list refreshes.
  const [retryId, setRetryId] = useState<number | null>(null)
  const closeDetails = useCallback(() => setDetailsId(null), [])
  const closeRetry = useCallback(() => setRetryId(null), [])
  const details = rows.find((row) => row.id === detailsId) ?? null
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visibleRows = searchTerms.length
    ? rows.filter((row) => {
        const time = rowTime(row)
        const searchableFields = [
          row.studentName,
          row.recipientEmail,
          row.status,
          row.reminderType,
          formatDay(time),
          formatTime(time),
          row.amount === null ? '' : formatPeso(row.amount),
        ].map((value) => value.toLowerCase())
        return searchTerms.every((term) => searchableFields.some((field) => field.includes(term)))
      })
    : rows

  return (
    <>
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-medium text-gray-950" aria-live="polite">
          {visibleRows.length} of {rows.length} reminder{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm font-medium text-gray-800">
          {rows.length === 0 ? 'No reminder history yet.' : `No reminders match “${searchQuery.trim()}”.`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Reminder history" className="w-full min-w-[1040px] table-fixed border-collapse bg-white text-left text-sm text-gray-950">
            <thead className="border-b border-gray-200">
              <tr>
                <th scope="col" className={`${TH} w-[22%]`}>Date</th>
                <th scope="col" className={`${TH} w-[18%]`}>Student</th>
                <th scope="col" className={`${TH} w-[12%]`}>Payment</th>
                <th scope="col" className={`${TH} w-[12%]`}>Type</th>
                <th scope="col" className={`${TH} w-[18%]`}>Sent to</th>
                <th scope="col" className={`${TH} w-[10%]`}>Status</th>
                <th scope="col" className={`${TH} w-[8%] text-right`}>Actions</th>
              </tr>
            </thead>
            <PaginatedTableRows itemLabel="reminder history" colSpan={7}>
              {visibleRows.map((row) => {
                const time = rowTime(row)
                return (
                  <tr
                    key={row.id}
                    onClick={() => setDetailsId(row.id)}
                    className="cursor-pointer border-b border-gray-100 align-middle transition-colors last:border-b-0 hover:bg-gray-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{formatDay(time)} · {formatTime(time)}</td>
                    <td className="break-words px-4 py-5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDetailsId(row.id)
                        }}
                        className={`rounded text-left text-sm font-medium text-gray-950 hover:underline ${FOCUS_RING}`}
                      >
                        {row.studentName}
                        <span className="sr-only">, show reminder details</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{row.amount === null ? '—' : formatPeso(row.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-sm font-medium text-gray-950">{row.reminderType}</td>
                    <td className="break-all px-4 py-5 text-sm font-medium text-gray-950"><p className="max-w-[220px]">{row.recipientEmail}</p></td>
                    <td className="px-4 py-5"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex w-full justify-end">
                        <ReminderRowActions row={row} onView={() => setDetailsId(row.id)} onRetry={() => setRetryId(row.id)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </PaginatedTableRows>
          </table>
        </div>
      )}

      {details && <ReminderDetailsModal row={details} onClose={closeDetails} />}
      {retryId !== null && <ReminderReviewModal target={{ kind: 'retry', id: retryId }} onClose={closeRetry} />}
    </>
  )
}
