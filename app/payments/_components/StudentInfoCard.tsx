'use client'

import { useEffect, useRef, useState } from 'react'
import { getStudentPaymentSummary } from '@/app/payments/actions'
import { formatCoverage, formatPeso } from '@/utils/payment-fees'
import type { StudentPayment, StudentPaymentSummary } from '@/utils/payment-records'

type CardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: StudentPaymentSummary }

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

// "Paid Oct 1, 2026 · ₱900.00 · Monthly Oct – Nov 2026 · GCash"
function paymentLine(payment: StudentPayment) {
  const when = payment.status === 'Paid' && payment.paidDate
    ? `Paid ${formatDate(payment.paidDate)}`
    : `Due ${formatDate(payment.dueDate)} · Unpaid`
  const detail =
    payment.paymentType === 'Monthly' && payment.coverageStart && payment.quantity
      ? `Monthly ${formatCoverage(payment.coverageStart, payment.quantity)}`
      : payment.paymentType === 'Per session' && payment.quantity
        ? `${payment.quantity} session${payment.quantity === 1 ? '' : 's'}`
        : null
  return [when, formatPeso(payment.amount), detail, payment.status === 'Paid' ? payment.method : null]
    .filter(Boolean)
    .join(' · ')
}

/** Mounted with key={studentId}, so every student starts in the loading state. */
export default function StudentInfoCard({
  studentId,
  onLoaded,
}: {
  studentId: number
  onLoaded?: (summary: StudentPaymentSummary) => void
}) {
  const [state, setState] = useState<CardState>({ status: 'loading' })
  // Read the latest callback without reloading when the parent re-renders.
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => {
    onLoadedRef.current = onLoaded
  })

  useEffect(() => {
    let cancelled = false
    getStudentPaymentSummary(studentId)
      .then((result) => {
        if (cancelled) return
        if ('error' in result) {
          setState({ status: 'error', message: result.error })
          return
        }
        setState({ status: 'ready', summary: result.summary })
        onLoadedRef.current?.(result.summary)
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: "Could not load this student's payments." })
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  return (
    <div aria-live="polite" className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
      {state.status === 'loading' && <p className="text-gray-500">Loading payment history…</p>}
      {state.status === 'error' && <p className="text-red-600">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          <p>
            Guardian: <span className="font-semibold text-gray-950">{state.summary.guardianName ?? '—'}</span>
          </p>
          {state.summary.payments.length === 0 ? (
            <p className="mt-1 text-gray-500">No payments yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {state.summary.payments.map((payment) => (
                <li key={payment.id} className="break-words">{paymentLine(payment)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
