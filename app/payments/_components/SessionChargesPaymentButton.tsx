'use client'

import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { markPerSessionChargesPaid } from '@/app/payments/actions'
import { PAYMENT_METHODS } from '@/utils/payment-methods'
import { formatAmount } from '@/utils/payment-display'
import type { PaymentRecord } from '@/utils/payment-records'
import { Toast } from '@/components/Toast'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './ModalShell'

const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
})

export default function SessionChargesPaymentButton({
  studentId,
  studentName,
  charges,
  today,
  trigger,
}: {
  studentId: number
  studentName: string
  charges: PaymentRecord[]
  today: string
  trigger: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>(charges.map((charge) => charge.id))
  const [paidDate, setPaidDate] = useState(today)
  const [method, setMethod] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const paidDateId = useId()
  const methodId = useId()
  const selectedCharges = useMemo(() => charges.filter((charge) => selected.includes(charge.id)), [charges, selected])
  const selectedTotal = selectedCharges.reduce((total, charge) => total + charge.amount, 0)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || selected.length === 0 || !method) return
    setSaving(true)
    setError('')
    try {
      const result = await markPerSessionChargesPaid({ studentId, paymentIds: selected, paidDate, method })
      if ('error' in result) {
        setError(result.error)
        return
      }
      const message = result.updatedCount === selected.length
        ? `${result.updatedCount} session charge${result.updatedCount === 1 ? '' : 's'} marked paid for ${studentName}.`
        : `${result.updatedCount} of ${selected.length} selected charges were still unpaid and marked paid.`
      setNotice(message)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={() => { setSelected(charges.map((charge) => charge.id)); setOpen(true); setError('') }}>{trigger}</div>
      {open && (
        <ModalShell title="Record session payment" description={`${studentName} · choose which unpaid sessions this payment covers.`} busy={saving} onClose={() => { if (!saving) setOpen(false) }} size="lg">
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {charges.map((charge) => {
                  const checked = selected.includes(charge.id)
                  return (
                    <label key={charge.id} className="flex cursor-pointer items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50">
                      <span className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={(event) => setSelected((current) => event.target.checked
                            ? [...current, charge.id]
                            : current.filter((id) => id !== charge.id))}
                          className="mt-1 h-4 w-4 accent-black"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-950">Class on {formatDate(charge.dueDate)}</span>
                          <span className="mt-0.5 block text-xs text-gray-700">{charge.branchName}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-gray-950">{formatAmount(charge.amount)}</span>
                    </label>
                  )
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={paidDateId} className={LABEL}>Paid date</label>
                  <input id={paidDateId} type="date" min="2020-01-01" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} required disabled={saving} className={INPUT} />
                </div>
                <div>
                  <label htmlFor={methodId} className={LABEL}>Payment method</label>
                  <select id={methodId} value={method} onChange={(event) => setMethod(event.target.value)} required disabled={saving} className={INPUT}>
                    <option value="" disabled>Choose a method</option>
                    {PAYMENT_METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <span className="text-gray-700">{selected.length} of {charges.length} sessions selected</span>
                <span className="font-semibold text-gray-950">{formatAmount(selectedTotal)}</span>
              </div>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>
            <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className={BUTTON_SECONDARY}>Cancel</button>
              <button type="submit" disabled={saving || selected.length === 0 || !method} className={BUTTON_PRIMARY}>
                {saving ? 'Saving…' : `Record ${selected.length || ''} payment${selected.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
      {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}
