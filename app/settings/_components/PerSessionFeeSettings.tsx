'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateAcademyPerSessionFee } from '@/app/payments/actions'

const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)

export default function PerSessionFeeSettings({ fee }: { fee: number }) {
  const router = useRouter()
  const [value, setValue] = useState(fee.toFixed(2))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = value.trim()
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
      setError('Enter a positive amount with up to two decimal places.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateAcademyPerSessionFee(Number(normalized))
      if ('error' in result) setError(result.error)
      else {
        setValue(Number(normalized).toFixed(2))
        setNotice(`Rate saved. ${result.updatedCharges} unpaid attendance charge${result.updatedCharges === 1 ? '' : 's'} updated.`)
        router.refresh()
      }
    } catch {
      setError('Could not save the per-session fee. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="academy-per-session-fee" className="block text-[13px] font-medium text-gray-800">Fee per class (₱)</label>
      <div className="flex flex-wrap gap-2">
        <input id="academy-per-session-fee" type="number" min="0.01" max="1000000" step="0.01" value={value} onChange={(event) => { setValue(event.target.value); setError(''); setNotice('') }} required disabled={saving} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none focus:border-gray-500 focus-visible:ring-2 focus-visible:ring-black/10" />
        <button type="submit" disabled={saving} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save rate'}</button>
      </div>
      <p className="text-sm text-gray-700">Current rate: <span className="font-semibold text-gray-950">{money(fee)}</span>. It is charged when a pay-per-session student checks in.</p>
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    </form>
  )
}
