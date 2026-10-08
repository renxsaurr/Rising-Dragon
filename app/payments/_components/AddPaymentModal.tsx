'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { createPayment } from '@/app/payments/actions'
import { monthlyDueDate, monthlyDueOffset } from '@/utils/billing-cycle'
import { PAYMENT_METHODS } from '@/utils/payment-methods'
import {
  MAX_MONTHS,
  MAX_SESSIONS,
  PAYMENT_TYPES,
  SESSION_FEE,
  findCoverageOverlap,
  formatCoverage,
  formatPeso,
  overlapMessage,
  type MonthlyCoverage,
  type PaymentType,
} from '@/utils/payment-fees'
import type { StudentPaymentSummary } from '@/utils/payment-records'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING, INPUT, LABEL } from './ModalShell'
import StudentCombobox, { type StudentChoice } from './StudentCombobox'
import StudentInfoCard from './StudentInfoCard'

const LABEL_INLINE = 'text-[13px] font-medium text-gray-700'

// Same look as Attendance's Present button: black when selected.
const toggleClass = (selected: boolean) =>
  `h-9 flex-1 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
    selected ? 'bg-black text-white' : 'border border-gray-200 text-black hover:border-gray-400 hover:bg-gray-50'
  }`

/** "1,500.50" or "₱1500" → 1500.5. null when blank or not a number. */
const toMoney = (value: string) => {
  const text = value.replace(/[₱,\s]/g, '')
  const amount = Number(text)
  return text && Number.isFinite(amount) ? amount : null
}
const moneyText = (amount: number) => (Math.round(amount * 100) / 100).toFixed(2)
const formatDayMonth = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export default function AddPaymentModal({
  students,
  branchName,
  month,
  today,
  monthlyFee,
  initialStudentId,
  onClose,
}: {
  students: StudentChoice[]
  branchName?: string
  /** The month shown on the page ('YYYY-MM'), used as the default start month. */
  month: string
  /** Today in Manila, from the server. */
  today: string
  /** Academy-wide fee, configured once by the Head Coach. */
  monthlyFee: number | null
  /** Preselected student. The combobox shows the name, and the info card and overlap check run as usual. */
  initialStudentId?: number
  onClose: () => void
}) {
  const [studentId, setStudentId] = useState<number | null>(initialStudentId ?? null)
  const [paymentType, setPaymentType] = useState<PaymentType>('Monthly')
  const [startMonth, setStartMonth] = useState(month)
  const [months, setMonths] = useState('1')
  const [sessions, setSessions] = useState('1')
  const [rate, setRate] = useState(moneyText(SESSION_FEE))
  // null = use the calculated amount; a string = typed by hand.
  const [amountOverride, setAmountOverride] = useState<string | null>(null)
  const [paidNow, setPaidNow] = useState(true)
  const [paidDate, setPaidDate] = useState(today)
  const [method, setMethod] = useState('')
  // null = follow the default (the start month for Monthly); a string = picked by hand.
  const [dueDateOverride, setDueDateOverride] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  // Monthly coverage from the info card, tagged with the student it belongs to.
  const [knownMonthly, setKnownMonthly] = useState<{ studentId: number; items: MonthlyCoverage[] } | null>(null)
  const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null)
  const [overlapConfirmed, setOverlapConfirmed] = useState(false)
  // A warning the server sent back (e.g. the info card was still loading when Add was pressed).
  const [serverWarning, setServerWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Blocks a second submit before React has re-rendered the disabled button.
  const savingRef = useRef(false)

  const studentFieldId = useId()
  const startMonthFieldId = useId()
  const monthsFieldId = useId()
  const sessionsFieldId = useId()
  const rateFieldId = useId()
  const amountFieldId = useId()
  const paidNowLabelId = useId()
  const paidDateFieldId = useId()
  const methodFieldId = useId()
  const dueDateFieldId = useId()
  const notesFieldId = useId()

  const isMonthly = paymentType === 'Monthly'
  const quantity = Number(isMonthly ? months : sessions)
  const maxQuantity = isMonthly ? MAX_MONTHS : MAX_SESSIONS
  const quantityValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity
  const unitPrice = isMonthly ? monthlyFee : toMoney(rate)
  const calculatedAmount = quantityValid && unitPrice !== null ? moneyText(quantity * unitPrice) : ''
  const amount = amountOverride ?? calculatedAmount
  const selectedMonth = /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : ''
  const monthOffset = enrollmentDate && selectedMonth
    ? (Number(selectedMonth.slice(0, 4)) - Number(enrollmentDate.slice(0, 4))) * 12 + Number(selectedMonth.slice(5, 7)) - Number(enrollmentDate.slice(5, 7))
    : null
  const coverageStart = isMonthly && enrollmentDate && monthOffset !== null
    ? monthlyDueDate(enrollmentDate, monthOffset) ?? ''
    : ''
  const coverage = isMonthly && coverageStart && quantityValid ? formatCoverage(coverageStart, quantity, enrollmentDate ?? coverageStart) : null
  const dueDate = isMonthly ? coverageStart : dueDateOverride ?? ''
  const student = students.find((choice) => choice.id === studentId) ?? null

  // Per session: the month comes from the paid date (Paid now) or the due date.
  const perSessionDate = paidNow ? paidDate : dueDate
  // No warning while this student's summary is still loading; the server checks again on save.
  const knownCoverage = knownMonthly && knownMonthly.studentId === studentId ? knownMonthly.items : null
  const liveOverlap = knownCoverage
    ? findCoverageOverlap(
        knownCoverage,
        isMonthly
          ? { kind: 'Monthly', coverageStart, quantity: quantityValid ? quantity : 0, enrollmentDate }
          : { kind: 'Per session', date: perSessionDate },
      )
    : null
  const overlapWarning = liveOverlap ? overlapMessage(liveOverlap, paymentType, student?.name) : serverWarning
  const blockedByOverlap = Boolean(overlapWarning) && !overlapConfirmed

  // Any change to what the payment covers needs a fresh "I understand".
  const clearOverlap = () => {
    setOverlapConfirmed(false)
    setServerWarning(null)
  }

  const selectStudent = (id: number | null) => {
    setStudentId(id)
    setEnrollmentDate(null)
    clearOverlap()
  }

  const handleSummary = (id: number, summary: StudentPaymentSummary) => {
    setKnownMonthly({ studentId: id, items: summary.monthlyCoverage })
    setEnrollmentDate(summary.enrollmentDate)
    if (summary.enrollmentDate) {
      const latest = summary.monthlyCoverage[0]
      const latestOffset = latest ? monthlyDueOffset(summary.enrollmentDate, latest.coverageStart) : null
      const nextDate = latest && latestOffset !== null
        ? monthlyDueDate(summary.enrollmentDate, latestOffset + latest.quantity)
        : monthlyDueDate(summary.enrollmentDate, 0)
      if (nextDate) setStartMonth(nextDate.slice(0, 7))
    }
  }

  const chooseType = (type: PaymentType) => {
    setPaymentType(type)
    // The amount and due date mean something different for the other type.
    setAmountOverride(null)
    setDueDateOverride(null)
    clearOverlap()
  }

  const summaryLine = [
    `Record ${formatPeso(toMoney(amount) ?? 0)}`,
    quantityValid ? (isMonthly ? `${plural(quantity, 'month')}${coverage ? ` (${coverage})` : ''}` : plural(quantity, 'session')) : null,
    student?.name ?? 'No student chosen',
    paidNow
      ? [`Paid ${formatDayMonth(paidDate || today)}`, method || null].filter(Boolean).join(' · ')
      : dueDate
        ? `Due ${formatDayMonth(dueDate)}`
        : 'No due date yet',
  ]
    .filter(Boolean)
    .join(' · ')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    if (studentId === null) {
      setError('Choose a student from the list.')
      return
    }
    if (blockedByOverlap) return
    savingRef.current = true
    setSaving(true)
    setError('')

    try {
      const result = await createPayment({
        studentId,
        paymentType,
        quantity,
        coverageStart: isMonthly ? coverageStart : null,
        amount,
        paidNow,
        paidDate: paidNow ? paidDate : null,
        method: paidNow ? method : null,
        dueDate: paidNow ? null : dueDate,
        notes,
        confirmOverlap: overlapConfirmed,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      if ('needsConfirm' in result) {
        // The server found an overlap the popup didn't know about yet. Keep the popup open.
        setServerWarning(result.warning)
        setOverlapConfirmed(false)
        return
      }
      // revalidatePath in the action refreshes the list.
      onClose()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title="Add payment"
      description={branchName ? `Showing students from ${branchName}.` : undefined}
      busy={saving}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {/* a) Student */}
          <div>
            <label htmlFor={studentFieldId} className={LABEL}>Student</label>
            <StudentCombobox
              inputId={studentFieldId}
              students={students}
              selectedId={studentId}
              onSelect={selectStudent}
              disabled={saving}
            />
            {/* b) Info card */}
            {studentId !== null && (
              <StudentInfoCard
                key={studentId}
                studentId={studentId}
                onLoaded={(summary) => handleSummary(studentId, summary)}
              />
            )}
          </div>

          {/* c) Type */}
          <div>
            <p className={LABEL}>Type</p>
            <div className="flex gap-2" role="group" aria-label="Payment type">
              {PAYMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={paymentType === type}
                  onClick={() => chooseType(type)}
                  disabled={saving}
                  className={toggleClass(paymentType === type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* d) Monthly or Per session details */}
          {isMonthly ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={startMonthFieldId} className={LABEL}>Billing month</label>
                <input
                  id={startMonthFieldId}
                  type="month"
                  min={enrollmentDate?.slice(0, 7) ?? '2020-01'}
                  max="2100-12"
                  // shown as a plain text box in browsers without a month picker
                  pattern="\d{4}-\d{2}"
                  placeholder="2026-10"
                  value={startMonth}
                  onChange={(event) => {
                    setStartMonth(event.target.value)
                    clearOverlap()
                  }}
                  required
                  disabled={saving || !enrollmentDate}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor={monthsFieldId} className={LABEL}>Months</label>
                <input
                  id={monthsFieldId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_MONTHS}
                  step={1}
                  value={months}
                  onChange={(event) => {
                    setMonths(event.target.value)
                    clearOverlap()
                  }}
                  required
                  disabled={saving}
                  className={INPUT}
                />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-xs font-medium text-gray-700">Academy monthly fee</p>
                <p className="mt-1 text-sm font-semibold text-gray-950">{monthlyFee === null ? 'Not configured' : formatPeso(monthlyFee)}</p>
              </div>
              {coverage && <p className="text-xs text-gray-700 sm:col-span-2">Due on the {formatDayMonth(coverageStart)} enrollment-date cycle · covers {coverage}</p>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={sessionsFieldId} className={LABEL}>Sessions</label>
                <input
                  id={sessionsFieldId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_SESSIONS}
                  step={1}
                  value={sessions}
                  onChange={(event) => setSessions(event.target.value)}
                  required
                  disabled={saving}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor={rateFieldId} className={LABEL}>Rate per session (₱)</label>
                <input
                  id={rateFieldId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  disabled={saving}
                  className={INPUT}
                />
              </div>
            </div>
          )}

          {/* e) Amount */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor={amountFieldId} className={LABEL_INLINE}>Amount (₱)</label>
              {amountOverride !== null && !isMonthly && (
                <span className="text-xs text-gray-500">
                  Custom amount ·{' '}
                  <button
                    type="button"
                    onClick={() => setAmountOverride(null)}
                    disabled={saving}
                    className={`font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-black ${FOCUS_RING}`}
                  >
                    Reset
                  </button>
                </span>
              )}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500" aria-hidden="true">₱</span>
              <input
                id={amountFieldId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => { if (!isMonthly) setAmountOverride(event.target.value) }}
                readOnly={isMonthly}
                required
                disabled={saving}
                className={`${INPUT} pl-7 ${isMonthly ? 'bg-gray-50' : ''}`}
              />
            </div>
          </div>

          {/* f) Paid now */}
          <div className="space-y-3 rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span id={paidNowLabelId} className={LABEL_INLINE}>Paid now</span>
              <button
                type="button"
                role="switch"
                aria-checked={paidNow}
                aria-labelledby={paidNowLabelId}
                onClick={() => {
                  setPaidNow((value) => !value)
                  clearOverlap()
                }}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${FOCUS_RING} ${paidNow ? 'bg-black' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${paidNow ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {paidNow ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={paidDateFieldId} className={LABEL}>Paid date</label>
                  <input
                    id={paidDateFieldId}
                    type="date"
                    min="2020-01-01"
                    max={today}
                    value={paidDate}
                    onChange={(event) => {
                      setPaidDate(event.target.value)
                      clearOverlap()
                    }}
                    required
                    disabled={saving}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={methodFieldId} className={LABEL}>Method</label>
                  <select
                    id={methodFieldId}
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    required
                    disabled={saving}
                    className={INPUT}
                  >
                    <option value="" disabled>Choose a method</option>
                    {PAYMENT_METHODS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : !isMonthly ? (
              <div>
                <label htmlFor={dueDateFieldId} className={LABEL}>Due date</label>
                <input
                  id={dueDateFieldId}
                  type="date"
                  min="2020-01-01"
                  max="2100-12-31"
                  value={dueDate}
                  onChange={(event) => {
                    setDueDateOverride(event.target.value)
                    clearOverlap()
                  }}
                  required
                  disabled={saving}
                  className={INPUT}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-700">This monthly bill is due on the student’s scheduled billing date: <span className="font-semibold text-gray-950">{coverageStart ? formatDayMonth(coverageStart) : 'loading enrollment date…'}</span>.</p>
            )}
          </div>

          {/* g) Notes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor={notesFieldId} className={LABEL_INLINE}>
                Notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <span className="text-xs text-gray-400" aria-live="polite">{notes.length}/500</span>
            </div>
            <textarea
              id={notesFieldId}
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={saving}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-black/10 disabled:bg-gray-50"
            />
          </div>

          {overlapWarning && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p>{overlapWarning}</p>
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

          {/* h) Summary */}
          <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-[13px] text-gray-700">{summaryLine}</p>

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
          <button
            type="submit"
            disabled={saving || students.length === 0 || blockedByOverlap || !quantityValid || (isMonthly && (!coverageStart || monthlyFee === null))}
            className={BUTTON_PRIMARY}
          >
            {saving ? 'Saving…' : 'Add payment'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
