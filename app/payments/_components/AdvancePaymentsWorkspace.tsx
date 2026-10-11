'use client'

import Link from 'next/link'
import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getAdvanceBillOptions, recordAdvancePayment, type AdvanceBillOption } from '@/app/payments/actions'
import { PAYMENT_METHODS } from '@/utils/payment-methods'
import type { StudentChoice } from './StudentCombobox'
import StudentCombobox from './StudentCombobox'
import { paymentsHref } from './payments-url'
import { BUTTON_PRIMARY, FOCUS_RING, INPUT, LABEL } from './ModalShell'

const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
})
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

export default function AdvancePaymentsWorkspace({ students, today }: {
  students: StudentChoice[]
  today: string
}) {
  const router = useRouter()
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
        setNotice('Advance payment recorded and added to payment history.')
        setOptions((current) => current.map((option) => option.dueDate === selectedDate ? { ...option, status: 'Paid' } : option))
        setSelectedDate('')
        setMethod('')
        router.refresh()
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selected = options.find((option) => option.dueDate === selectedDate)
  const historyHref = paymentsHref({ month: paidDate.slice(0, 7), branch: 'all', filter: 'all', view: 'history', historyPage: 'payments' })

  return (
    <section aria-labelledby="advance-payments-title" className="max-w-4xl space-y-6">
      <div>
        <h2 id="advance-payments-title" className="text-lg font-semibold tracking-tight text-gray-950">Record an advance payment</h2>
        <p className="mt-1 text-sm text-gray-700">Find a monthly student from any branch, then choose an upcoming bill to pay.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <label htmlFor={studentFieldId} className={LABEL}>Student</label>
          <StudentCombobox inputId={studentFieldId} students={students} selectedId={studentId} onSelect={selectStudent} disabled={saving} showSelectedDetails={false} />
        </div>

        {studentId !== null && <div aria-live="polite" className="space-y-2">
          <h3 className={LABEL}>Upcoming monthly bills</h3>
          {loading ? <p className="text-sm text-gray-700">Loading bills…</p> : options.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">No upcoming bills are available. Record the student’s first monthly payment before recording an advance payment.</p>
          ) : options.map((option) => {
            const unavailable = option.status === 'Paid' || option.amount === null || Boolean(option.blockedByDueDate)
            return <div key={option.dueDate}>
              <button type="button" disabled={unavailable || saving} aria-pressed={selectedDate === option.dueDate}
                onClick={() => { setSelectedDate(option.dueDate); setError(''); setNotice('') }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${FOCUS_RING} ${selectedDate === option.dueDate ? 'border-black bg-gray-50' : 'border-gray-200 bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-950">{option.coverage}</span>
                  <span className="mt-0.5 block text-xs text-gray-700">Due {formatDate(option.dueDate)} · {option.status}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-gray-950">{option.amount === null ? 'Fee not set' : money(option.amount)}</span>
              </button>
              {option.blockedByDueDate && <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">An earlier monthly bill due {formatDate(option.blockedByDueDate)} is unpaid. Mark it as paid before recording an advance payment.</p>}
            </div>
          })}
        </div>}

        {selected && selected.status !== 'Paid' && <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={paidDateFieldId} className={LABEL}>Paid date</label><input id={paidDateFieldId} type="date" min="2020-01-01" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} required disabled={saving} className={INPUT} /></div>
          <div><label htmlFor={methodFieldId} className={LABEL}>Payment method</label><select id={methodFieldId} value={method} onChange={(event) => setMethod(event.target.value)} required disabled={saving} className={INPUT}><option value="" disabled>Choose a method</option>{PAYMENT_METHODS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
        </div>}

        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice} <Link href={historyHref} className="ml-1 font-semibold underline underline-offset-2">View payment history</Link></p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {selected && <div className="flex justify-end border-t border-gray-100 pt-4">
          <button type="submit" disabled={saving || selected.status === 'Paid' || !method} className={BUTTON_PRIMARY}>{saving ? 'Saving…' : 'Record advance payment'}</button>
        </div>}
      </form>
    </section>
  )
}
