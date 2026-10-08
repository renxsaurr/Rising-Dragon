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

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600'

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
  if (row.status === 'Sent' && row.sentAt) return { at: row.sentAt, label: null }
  if (row.status === 'Scheduled') return { at: row.lastAttemptAt ?? row.createdAt, label: 'Sending since' }
  return { at: row.completedAt ?? row.createdAt, label: row.status === 'Failed' ? 'Failed' : 'Closed' }
}

function StatusBadge({ status }: { status: ReminderStatus }) {
  const badge = STATUS_BADGES[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
      {badge.label}
    </span>
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

export default function ReminderHistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [detailsId, setDetailsId] = useState<number | null>(null)
  // The Retry popup lives here, not in the row, so it stays open after the list refreshes.
  const [retryId, setRetryId] = useState<number | null>(null)
  const closeDetails = useCallback(() => setDetailsId(null), [])
  const closeRetry = useCallback(() => setRetryId(null), [])
  const details = rows.find((row) => row.id === detailsId) ?? null

  return (
    <>
      {/* The table keeps its width and scrolls inside this box on small screens. */}
      <div className="overflow-x-auto">
        <table className="system-data-table w-full min-w-[900px] border-collapse text-left">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className={`${TH} pl-5`}>Date</th>
              <th className={TH}>Student</th>
              <th className={TH}>Payment</th>
              <th className={TH}>Type</th>
              <th className={TH}>Sent to</th>
              <th className={TH}>Status</th>
              <th className={`${TH} pr-5`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <PaginatedTableRows itemLabel="reminder history" colSpan={7}>
            {rows.map((row) => {
              const time = rowTime(row)
              return (
                <tr
                  key={row.id}
                  onClick={() => setDetailsId(row.id)}
                  className="cursor-pointer align-top transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-5 py-3">
                    <p className="text-sm text-gray-900">{formatDay(time.at)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {time.label ? `${time.label} · ${formatTime(time.at)}` : formatTime(time.at)}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {/* A real button, so keyboard users can open the details too. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDetailsId(row.id)
                      }}
                      className={`rounded text-left text-sm font-medium text-gray-900 hover:underline ${FOCUS_RING}`}
                    >
                      {row.studentName}
                      <span className="sr-only">, show reminder details</span>
                    </button>
                    <p className="mt-0.5 text-xs text-gray-500">{row.branchName}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <p className="text-sm font-medium text-gray-900">{row.amount === null ? '—' : formatPeso(row.amount)}</p>
                    {row.dueDate && <p className="mt-0.5 text-xs text-gray-500">Due {formatPlainDate(row.dueDate)}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{row.reminderType}</td>
                  <td className="px-3 py-3">
                    <p className="max-w-[220px] break-all text-sm text-gray-800">{row.recipientEmail}</p>
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                  {/* Clicks here (Retry) must not also open the details. */}
                  <td className="px-3 py-3 pr-5 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end"><RowActionsMenu>
                      <RowActionItem onClick={() => setDetailsId(row.id)}>View details</RowActionItem>
                      {row.status === 'Failed' && <RetryReminderButton onRetry={() => setRetryId(row.id)} className={ROW_ACTION_CLASS} />}
                    </RowActionsMenu></div>
                  </td>
                </tr>
              )
            })}
          </PaginatedTableRows>
        </table>
      </div>

      {details && <ReminderDetailsModal row={details} onClose={closeDetails} />}
      {retryId !== null && <ReminderReviewModal target={{ kind: 'retry', id: retryId }} onClose={closeRetry} />}
    </>
  )
}
