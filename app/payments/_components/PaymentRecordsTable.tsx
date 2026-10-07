import MarkPaidButton from './MarkPaidButton'
import SendReminderButton from './SendReminderButton'
import { formatBeltLabel } from '@/utils/belts'
import { isValidEmail } from '@/utils/email'
import { formatCoverage } from '@/utils/payment-fees'
import { REMINDER_TYPES, formatAmount, reminderWindowFor } from '@/utils/payment-reminders'
import type { PaymentKind, PaymentRecord } from '@/utils/payment-records'

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500'

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

// "5 days overdue", "Due in 2 days", "Paid Oct 1 · GCash"
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

// "Monthly · Oct – Nov 2026", "Monthly · Oct 2026" or "6 sessions". Nothing for older records.
function paymentDetail(row: PaymentRecord) {
  if (row.paymentType === 'Monthly' && row.coverageStart && row.quantity) {
    return `Monthly · ${formatCoverage(row.coverageStart, row.quantity)}`
  }
  if (row.paymentType === 'Per session' && row.quantity) {
    return `${row.quantity} session${row.quantity === 1 ? '' : 's'}`
  }
  return null
}

/** Whether the row's "Send reminder" button can be used, and why not. */
function sendButtonState(row: PaymentRecord, today: string) {
  const timing = reminderWindowFor(row.dueDate, today)
  // The type that is open today, or the one that opens next.
  const reminderType = timing.open ? timing.type : timing.nextType
  if (!row.guardianEmail) return { reminderType, disabledReason: 'No guardian email' }
  if (!isValidEmail(row.guardianEmail)) return { reminderType, disabledReason: 'Invalid guardian email' }
  if (!row.isActive) return { reminderType, disabledReason: 'Student is inactive' }
  if (!timing.open) return { reminderType, disabledLabel: `Available ${formatDayMonth(timing.opensOn)}` }

  const existing = row.reminders.find((reminder) => reminder.reminderType === reminderType)
  if (existing?.status === 'Sent') {
    return {
      reminderType,
      disabledLabel: existing.sentAt ? `Sent ${formatSentDate(existing.sentAt)}` : 'Sent',
      // After due is the last reminder, so there is nothing left to send by email.
      hint: reminderType === 'After due' ? 'All reminders sent · contact parent' : undefined,
    }
  }
  if (existing?.status === 'Failed') {
    return { reminderType, disabledReason: `${reminderType} failed. Use Retry in Reminder history.` }
  }
  if (existing?.status === 'Scheduled') return { reminderType, disabledLabel: 'Sending…' }
  // No row yet, or a Skipped one that Send may reuse.
  return { reminderType }
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
  showBranch,
  emptyText,
}: {
  rows: PaymentRecord[]
  today: string
  showBranch: boolean
  emptyText: string
}) {
  if (rows.length === 0) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">{emptyText}</p>
        </div>
      </div>
    )
  }

  return (
    // The table keeps its width and scrolls inside this box on small screens.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className={`${TH} pl-5`}>Student</th>
            <th className={TH}>Amount</th>
            <th className={TH}>Due date</th>
            <th className={TH}>Status</th>
            <th className={TH}>Reminder</th>
            <th className={`${TH} pr-5 text-right`}>Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const badge = KIND_BADGES[row.kind]
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
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[formatBeltLabel(row.beltLevel), showBranch ? row.branchName : null].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="whitespace-nowrap text-sm font-medium text-gray-900">{formatAmount(row.amount)}</p>
                  {paymentDetail(row) && (
                    <p className="mt-0.5 whitespace-nowrap text-xs text-gray-500">{paymentDetail(row)}</p>
                  )}
                  {row.notes && (
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-gray-500" title={row.notes}>
                      {row.notes}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{formatDate(row.dueDate)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                    {badge.label}
                  </span>
                  <p className={`mt-1 whitespace-nowrap text-xs ${row.kind === 'overdue' ? 'text-red-600' : 'text-gray-500'}`}>
                    {statusNote(row)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <LatestReminder row={row} />
                </td>
                <td className="px-3 py-3 pr-5">
                  {row.status === 'Unpaid' ? (
                    <div className="flex flex-col items-end gap-2">
                      <MarkPaidButton
                        payment={{
                          id: row.id,
                          studentName: row.studentName,
                          amount: formatAmount(row.amount),
                          dueDate: formatDate(row.dueDate),
                        }}
                        today={today}
                      />
                      <SendReminderButton paymentId={row.id} {...sendButtonState(row, today)} />
                    </div>
                  ) : (
                    <span className="block text-right text-sm text-gray-400">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
