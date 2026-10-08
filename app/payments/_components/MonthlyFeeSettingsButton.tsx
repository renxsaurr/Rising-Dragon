'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateAcademyMonthlyFee } from '@/app/payments/actions'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING, INPUT, LABEL } from './ModalShell'

const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)

export default function MonthlyFeeSettingsButton({ monthlyFee }: { monthlyFee: number | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(monthlyFee == null ? '' : monthlyFee.toFixed(2))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const close = () => {
    if (!saving) setOpen(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = value.trim()
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      setError('Enter a valid amount with up to two decimal places.')
      return
    }
    const amount = Number(normalized)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      setError('Enter an amount greater than ₱0 and no more than ₱1,000,000.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateAcademyMonthlyFee(amount)
      if ('error' in result) {
        setError(result.error)
      } else {
        setValue(amount.toFixed(2))
        setNotice(`Rate updated. ${result.updatedBills} unpaid monthly bill${result.updatedBills === 1 ? '' : 's'} updated. Paid records were kept unchanged.`)
        router.refresh()
      }
    } catch {
      setError('Could not save the monthly fee. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setNotice(''); setOpen(true) }}
        className={`inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-semibold text-gray-950 hover:bg-gray-50 ${FOCUS_RING}`}
      >
        {monthlyFee == null ? 'Set monthly fee' : 'Monthly fee settings'}
      </button>
      {open && (
        <ModalShell
          title="Academy monthly fee"
          description="This rate is used for monthly bills across all students."
          busy={saving}
          onClose={close}
        >
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <label htmlFor="academy-monthly-fee" className={LABEL}>Monthly fee (₱)</label>
                <input
                  id="academy-monthly-fee"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  onChange={(event) => { setValue(event.target.value); setError(''); setNotice('') }}
                  placeholder="e.g. 1500.00"
                  required
                  disabled={saving}
                  className={INPUT}
                />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-800">
                <p className="font-medium text-gray-950">What changes when you save</p>
                <p className="mt-1">All unpaid monthly bills update to this rate. A bill covering multiple months uses the rate multiplied by its number of months. Paid payment records stay unchanged.</p>
              </div>
              {monthlyFee !== null && (
                <p className="text-sm text-gray-800">Current rate: <span className="font-semibold text-gray-950">{money(monthlyFee)}</span> per month</p>
              )}
              {notice && <p role="status" className="break-words rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
              {error && <p role="alert" className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>
            <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={close} disabled={saving} className={BUTTON_SECONDARY}>Cancel</button>
              <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>{saving ? 'Saving…' : 'Save monthly fee'}</button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  )
}
