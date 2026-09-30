'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setUserActive } from '@/app/users/actions'

export default function DeleteUserButton({
  userId,
  userName,
  active,
  disabled = false,
}: {
  userId: number
  userName: string
  active: boolean
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleToggle = async () => {
    const nextActive = !active
    setLoading(true)
    setError('')
    const result = await setUserActive(userId, nextActive)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setIsConfirmOpen(false)
    router.refresh()
  }

  const closeConfirmation = () => {
    if (loading) return
    setIsConfirmOpen(false)
    setError('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setIsConfirmOpen(true) }}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center rounded-lg border bg-white px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
      >
        {active ? 'Deactivate' : 'Reactivate'}
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby={`user-status-title-${userId}`} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <button type="button" onClick={closeConfirmation} disabled={loading} aria-label="Close" className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50">×</button>
            <h2 id={`user-status-title-${userId}`} className="text-lg font-semibold text-gray-950">{active ? 'Deactivate account?' : 'Reactivate account?'}</h2>
            <p className="mb-5 mt-1 text-sm text-gray-600">
              {active
                ? `Deactivate ${userName}'s login? They will no longer be able to sign in. Their staff record and history will remain.`
                : `Restore ${userName}'s login access? They will be able to sign in again.`}
            </p>

            {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={closeConfirmation} disabled={loading} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleToggle} disabled={loading} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${active ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {loading ? 'Saving…' : active ? 'Deactivate account' : 'Reactivate account'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
