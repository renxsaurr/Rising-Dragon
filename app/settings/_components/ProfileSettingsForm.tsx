'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateOwnProfile } from '@/app/settings/actions'

const INPUT = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none focus:border-gray-500 focus-visible:ring-2 focus-visible:ring-black/10'
const LABEL = 'mb-1.5 block text-[13px] font-medium text-gray-800'

export default function ProfileSettingsForm({
  firstName,
  middleName,
  lastName,
  contact,
}: {
  firstName: string
  middleName: string
  lastName: string
  contact: string
}) {
  const router = useRouter()
  const [first, setFirst] = useState(firstName)
  const [middle, setMiddle] = useState(middleName)
  const [last, setLast] = useState(lastName)
  const [phone, setPhone] = useState(contact)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateOwnProfile({ firstName: first, middleName: middle, lastName: last, contact: phone })
      if ('error' in result) setError(result.error)
      else {
        setNotice('Your name and phone number were saved.')
        router.refresh()
      }
    } catch {
      setError('Could not save your account details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="settings-first-name" className={LABEL}>First name</label>
          <input id="settings-first-name" autoComplete="given-name" maxLength={80} value={first} onChange={(event) => setFirst(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
        <div>
          <label htmlFor="settings-middle-name" className={LABEL}>Middle name <span className="font-normal text-gray-500">(optional)</span></label>
          <input id="settings-middle-name" autoComplete="additional-name" maxLength={80} value={middle} onChange={(event) => setMiddle(event.target.value)} disabled={saving} className={INPUT} />
        </div>
        <div>
          <label htmlFor="settings-last-name" className={LABEL}>Last name</label>
          <input id="settings-last-name" autoComplete="family-name" maxLength={80} value={last} onChange={(event) => setLast(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
        <div>
          <label htmlFor="settings-contact" className={LABEL}>Phone number</label>
          <input id="settings-contact" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Saving…' : 'Save account details'}
        </button>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </form>
  )
}
