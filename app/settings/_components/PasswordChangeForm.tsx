'use client'

import { useState, type FormEvent } from 'react'
import { changeOwnPassword } from '@/app/settings/actions'

const INPUT = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none focus:border-gray-500 focus-visible:ring-2 focus-visible:ring-black/10'
const LABEL = 'mb-1.5 block text-[13px] font-medium text-gray-800'

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const result = await changeOwnPassword({ currentPassword, newPassword })
      if ('error' in result) setError(result.error)
      else {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setNotice('Your password has been changed.')
      }
    } catch {
      setError('Could not change your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="current-password" className={LABEL}>Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
        <div>
          <label htmlFor="new-password" className={LABEL}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
        <div>
          <label htmlFor="confirm-password" className={LABEL}>Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={saving} className={INPUT} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-600">Use at least 8 characters. Your current password is checked before saving.</p>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Updating…' : 'Change password'}
        </button>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </form>
  )
}
