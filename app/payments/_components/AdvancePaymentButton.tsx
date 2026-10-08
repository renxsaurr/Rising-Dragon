'use client'

import { useCallback, useId, useState, type FormEvent } from 'react'
import { getAdvanceBillOptions, recordAdvancePayment, type AdvanceBillOption } from '@/app/payments/actions'
import { PAYMENT_METHODS } from '@/utils/payment-methods'
import type { StudentChoice } from './StudentCombobox'
import StudentCombobox from './StudentCombobox'
import ModalShell, { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING, INPUT, LABEL } from './ModalShell'

const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
})
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

export default function AdvancePaymentButton({ students, today }: { students: StudentChoice[]; today: string }) {
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState<number | null>(null)
  const [options, setOptions] = useState<AdvanceBillOption[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [paidDate, setPaidDate] = useState(today)
  const [method, setMethod] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const studentFieldId = useId()
  const paidDateFieldId = useId()
  const methodFieldId = useId()
  const close = useCallback(() => {
    if (saving) return
    setOpen(false)
    setStudentId(null)
    setOptions([])
    setSelectedDate('')
    setError('')
    setNotice('')
  }, [saving])

  const selectStudent = async (id: number | null) => {
    setStudentId(id)
    setOptions([])
    setSelectedDate('')
    setError('')
    setNotice('')
    if (id === null) return
    setLoading(true)
    try {
      const result = await getAdvanceBillOptions(id)
      if ('error' in result) setError(result.error)
      else setOptions(result.options)
    } catch {
      setError('Could not load this student’s monthly bills.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || studentId === null || !selectedDate) return
    setSaving(true)
    setError('')
    try {
      const result = await recordAdvancePayment({ studentId, dueDate: selectedDate, paidDate, method })
      if ('error' in result) setError(result.error)
      else {
        setNotice('Advance payment recorded. The selected bill is marked paid.')
        setOptions((current) => current.map((option) => option.dueDate === selectedDate ? { ...option, status: 'Paid' } : option))
        setSelectedDate('')
        setMethod('')
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selected = options.find((option) => option.dueDate === selectedDate)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-semibold text-gray-950 hover:bg-gray-50 ${FOCUS_RING}`}
      >
        Record advance payment
      </button>
      {open && (
        <ModalShell title="Record advance payment" description="Choose a student and one of their upcoming monthly bills." busy={saving} onClose={close}>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <label htmlFor={studentFieldId} className={LABEL}>Student</label>
                <StudentCombobox inputId={studentFieldId} students={students} selectedId={studentId} onSelect={selectStudent} disabled={saving} />
              </div>
              {studentId !== null && (
                <div aria-live="polite" className="space-y-2">
                  <p className={LABEL}>Upcoming monthly bills</p>
                  {loading ? <p className="text-sm text-gray-600">Loading bills…</p> : options.length === 0 ? (
                    <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">No upcoming bills are available. Record the student’s first monthly payment before recording an advance payment.</p>
                  ) : options.map((option) => {
                    const isPaid = option.status === 'Paid'
                    const unavailable = isPaid || option.amount === null
                    return (
                      <button
                        key={option.dueDate}
                        type="button"
                        disabled={unavailable || saving}
                        aria-pressed={selectedDate === option.dueDate}
                        onClick={() => { setSelectedDate(option.dueDate); setError(''); setNotice('') }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${FOCUS_RING} ${selectedDate === option.dueDate ? 'border-black bg-gray-50' : 'border-gray-200 bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-950">{option.coverage}</span>
                          <span className="mt-0.5 block text-xs text-gray-700">Due {formatDate(option.dueDate)} · {option.status}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-950">{option.amount === null ? 'Fee not set' : money(option.amount)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {selected && selected.status !== 'Paid' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={paidDateFieldId} className={LABEL}>Paid date</label>
                    <input id={paidDateFieldId} type="date" min="2020-01-01" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} required disabled={saving} className={INPUT} />
                  </div>
                  <div>
                    <label htmlFor={methodFieldId} className={LABEL}>Payment method</label>
                    <select id={methodFieldId} value={method} onChange={(event) => setMethod(event.target.value)} required disabled={saving} className={INPUT}>
                      <option value="" disabled>Choose a method</option>
                      {PAYMENT_METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
              {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>
            <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={close} disabled={saving} className={BUTTON_SECONDARY}>Close</button>
              <button type="submit" disabled={saving || !selected || selected.status === 'Paid' || !method} className={BUTTON_PRIMARY}>
                {saving ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  )
}
