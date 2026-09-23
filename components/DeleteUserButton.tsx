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
  const router = useRouter()

  const handleToggle = async () => {
    const nextActive = !active
    if (!window.confirm(`${nextActive ? 'Reactivate' : 'Deactivate'} ${userName}'s login account?`)) return
    setLoading(true)
    const result = await setUserActive(userId, nextActive)
    setLoading(false)
    if (result.error) {
      window.alert(result.error)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
    >
      {loading ? 'Saving…' : active ? 'Deactivate' : 'Reactivate'}
    </button>
  )
}
