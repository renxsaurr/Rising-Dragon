'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { createPayment } from '@/app/payments/actions'
import { MONTHLY_DUE_DAY } from '@/utils/academy-settings'
import { MONTHLY_FEE, findCoverageOverlap, formatCoverage, overlapMessage, type MonthlyCoverage } from '@/utils/payment-fees'
import type { NotPaidStudent, StudentPaymentSummary } from '@/utils/payment-records'
import { reminderWindowFor, type ReminderWindow } from '@/utils/reminder-timing'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './ModalShell'
import StudentInfoCard from './StudentInfoCard'

const moneyText = (amount: number) => (Math.round(amount * 100) / 100).toFixed(2)

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

/** MONTHLY_DUE_DAY of the month, or the month's last day when the month is shorter (e.g. February). */
function defaultDueDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${String(Math.min(MONTHLY_DUE_DAY, lastDay)).padStart(2, '0')}`
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
  onCreated,
  onClose,
}: {
  student: NotPaidStudent
  /** 'YYYY-MM', the month shown on the page. */
  month: string
  today: string
  onCreated: (paymentId: number, timing: ReminderWindow) => void
  onClose: () => void
}) {
  const [amount, setAmount] = useState(MONTHLY_FEE === null ? '' : moneyText(MONTHLY_FEE))
  const [amountEdited, setAmountEdited] = useState(false)
  const [dueDate, setDueDate] = useState(() => defaultDueDate(month))
  const [coverage, setCoverage] = useState<MonthlyCoverage[] | null>(null)
  const [overlapConfirmed, setOverlapConfirmed] = useState(false)
  const [serverWarning, setServerWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const amountFieldId = useId()
  const dueDateFieldId = useId()

  const coverageStart = `${month}-01`
  const timing = isDate(dueDate) ? reminderWindowFor(dueDate, today) : null
  // No warning while the info card is loading; the server checks again on save.
  const overlap = coverage ? findCoverageOverlap(coverage, { kind: 'Monthly', coverageStart, quantity: 1 }) : null
  const warning = overlap ? overlapMessage(overlap, 'Monthly', student.name) : serverWarning
  const blocked = Boolean(warning) && !overlapConfirmed

  const handleSummary = (summary: StudentPaymentSummary) => {
    setCoverage(summary.monthlyCoverage)
    // Last monthly fee → MONTHLY_FEE → empty. Never overwrites an amount typed by hand.
    if (!amountEdited && summary.lastMonthlyFee !== null) setAmount(moneyText(summary.lastMonthlyFee))
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
      onCreated(result.paymentId, reminderWindowFor(dueDate, today))
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
      description={`${student.name} · ${formatCoverage(coverageStart, 1)} monthly fee`}
      busy={saving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
                  onChange={(event) => {
                    setAmount(event.target.value)
                    setAmountEdited(true)
                  }}
                  required
                  disabled={saving}
                  className={`${INPUT} pl-7`}
                />
              </div>
            </div>
            <div>
              <label htmlFor={dueDateFieldId} className={LABEL}>Due date</label>
              <input
                id={dueDateFieldId}
                type="date"
                min="2020-01-01"
                max="2100-12-31"
                value={dueDate}
                onChange={(event) => {
                  setDueDate(event.target.value)
                  setServerWarning(null)
                }}
                required
                disabled={saving}
                className={INPUT}
              />
            </div>
          </div>

          {timing && <p className="text-xs text-gray-600">{timingText(timing)}</p>}
          <p className="text-xs text-gray-500">
            Monthly · 1 month · covers {formatCoverage(coverageStart, 1)}. The bill starts as Unpaid.
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

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancel
          </button>
          <button type="submit" disabled={saving || blocked} className={BUTTON_PRIMARY}>
            {saving ? 'Saving…' : 'Create bill & continue'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
