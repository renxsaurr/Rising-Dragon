'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { createPayment } from '@/app/payments/actions'
import { monthlyDueDate } from '@/utils/billing-cycle'
import { findCoverageOverlap, formatCoverage, overlapMessage, type MonthlyCoverage } from '@/utils/payment-fees'
import type { NotPaidStudent, StudentPaymentSummary } from '@/utils/payment-records'
import { reminderWindowFor, type ReminderSchedule, type ReminderWindow } from '@/utils/reminder-timing'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './ModalShell'
import StudentInfoCard from './StudentInfoCard'

const moneyText = (amount: number) => (Math.round(amount * 100) / 100).toFixed(2)

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

function dueDateForMonth(enrollmentDate: string | null, month: string) {
  if (!enrollmentDate) return ''
  const offset = (Number(month.slice(0, 4)) - Number(enrollmentDate.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(enrollmentDate.slice(5, 7))
  return offset < 0 ? '' : monthlyDueDate(enrollmentDate, offset) ?? ''
}

/** Which reminder the chosen due date allows, in words. */
const timingText = (timing: ReminderWindow) =>
  timing.open
    ? `The ${timing.type} reminder can be sent now.`
    : `The ${timing.nextType} reminder opens on ${formatDate(timing.opensOn)}.`

/** "Send reminder" for a student with no bill this month: create a 1-month Monthly bill first. */
export default function CreateBillModal({
  student,
  month,
  today,
  monthlyFee,
  reminderSchedule,
  onCreated,
  onClose,
}: {
  student: NotPaidStudent
  /** 'YYYY-MM', the month shown on the page. */
  month: string
  today: string
  monthlyFee: number | null
  reminderSchedule: ReminderSchedule
  onCreated: (paymentId: number, timing: ReminderWindow) => void
  onClose: () => void
}) {
  const amount = monthlyFee === null ? '' : moneyText(monthlyFee)
  const [coverage, setCoverage] = useState<MonthlyCoverage[] | null>(null)
  const [overlapConfirmed, setOverlapConfirmed] = useState(false)
  const [serverWarning, setServerWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const amountFieldId = useId()
  const dueDate = dueDateForMonth(student.enrollmentDate, month)
  const coverageStart = dueDate
  const timing = isDate(dueDate) ? reminderWindowFor(dueDate, today, reminderSchedule) : null
  // No warning while the info card is loading; the server checks again on save.
  const overlap = coverage ? findCoverageOverlap(coverage, { kind: 'Monthly', coverageStart, quantity: 1, enrollmentDate: student.enrollmentDate }) : null
  const warning = overlap ? overlapMessage(overlap, 'Monthly', student.name) : serverWarning
  const blocked = Boolean(warning) && !overlapConfirmed

  const handleSummary = (summary: StudentPaymentSummary) => {
    setCoverage(summary.monthlyCoverage)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || blocked) return
    savingRef.current = true
    setSaving(true)
    setError('')

    try {
      const result = await createPayment({
        studentId: student.id,
        paymentType: 'Monthly',
        quantity: 1,
        coverageStart,
        amount,
        paidNow: false,
        dueDate,
        notes: null,
        confirmOverlap: overlapConfirmed,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      if ('needsConfirm' in result) {
        setServerWarning(result.warning)
        setOverlapConfirmed(false)
        return
      }
      onCreated(result.paymentId, reminderWindowFor(dueDate, today, reminderSchedule))
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title="Create bill and send reminder"
      description={`${student.name} · ${coverageStart ? formatCoverage(coverageStart, 1, student.enrollmentDate ?? coverageStart) : 'No enrollment billing date'} monthly fee`}
      busy={saving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-[13px] text-gray-700">
            The reminder goes to <span className="break-all font-medium text-gray-950">{student.guardianEmail}</span>.
          </p>
          <StudentInfoCard studentId={student.id} onLoaded={handleSummary} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={amountFieldId} className={LABEL}>Amount (₱)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500" aria-hidden="true">₱</span>
                <input
                  id={amountFieldId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  readOnly
                  required
                  disabled={saving}
                  className={`${INPUT} bg-gray-50 pl-7`}
                />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-xs font-medium text-gray-600">Scheduled due date</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-950">{dueDate ? formatDate(dueDate) : 'Student enrollment date is required'}</p>
            </div>
          </div>

          {monthlyFee === null && (
            <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              Set the academy monthly fee in Payment settings before creating this bill.
            </p>
          )}

          {timing && <p className="text-xs text-gray-600">{timingText(timing)}</p>}
          <p className="text-xs text-gray-500">
            Monthly · 1 billing cycle · covers {coverageStart ? formatCoverage(coverageStart, 1, student.enrollmentDate ?? coverageStart) : 'no billing cycle available'}. The bill starts as Unpaid.
          </p>

          {warning && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p>{warning}</p>
              <label className="mt-2 flex cursor-pointer items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={overlapConfirmed}
                  onChange={(event) => setOverlapConfirmed(event.target.checked)}
                  disabled={saving}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                />
                I understand, add it anyway
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-[13px] text-red-700 ring-1 ring-inset ring-red-600/20">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancel
          </button>
          <button type="submit" disabled={saving || blocked || !dueDate || monthlyFee === null} className={BUTTON_PRIMARY}>
            {saving ? 'Saving…' : 'Create bill & continue'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
