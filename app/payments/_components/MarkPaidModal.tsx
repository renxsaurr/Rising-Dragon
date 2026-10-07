'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { markPaymentPaid } from '@/app/payments/actions'
import { PAYMENT_METHODS } from '@/utils/payment-methods'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './ModalShell'

/** Already formatted for display by the server. */
export type PaymentToMark = { id: number; studentName: string; amount: string; dueDate: string }

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-gray-950">{value}</dd>
    </div>
  )
}

export default function MarkPaidModal({
  payment,
  today,
  onClose,
}: {
  payment: PaymentToMark
  /** Today in Manila, from the server. */
  today: string
  onClose: () => void
}) {
  const [paidDate, setPaidDate] = useState(today)
  const [method, setMethod] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const paidDateFieldId = useId()
  const methodFieldId = useId()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')

    try {
      const result = await markPaymentPaid({ paymentId: payment.id, paidDate, method })
      if ('error' in result) {
        setError(result.error)
        return
      }
      onClose()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Mark as paid" busy={saving} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:grid-cols-3">
            <Detail label="Student" value={payment.studentName} />
            <Detail label="Amount" value={payment.amount} />
            <Detail label="Due date" value={payment.dueDate} />
          </dl>

          <div>
            <label htmlFor={paidDateFieldId} className={LABEL}>Paid date</label>
            <input
              id={paidDateFieldId}
              type="date"
              min="2020-01-01"
              max={today}
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
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

          <p className="text-xs text-gray-500">This doesn&apos;t send any email.</p>

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
          <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? 'Saving…' : 'Mark as paid'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
