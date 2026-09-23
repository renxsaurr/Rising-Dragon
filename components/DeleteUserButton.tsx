'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteUser } from '@/app/users/actions'

type DeleteUserButtonProps = {
  userId: string
  userName: string
  disabled?: boolean
}

export default function DeleteUserButton({
  userId,
  userName,
  disabled = false,
}: DeleteUserButtonProps) {
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${userName}?`
    )

    if (!confirmed) return

    setLoading(true)

    const result = await deleteUser(userId)

    if (result?.error) {
      alert(result.error)
      setLoading(false)
      return
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={disabled || loading}
      className="px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? 'Deleting...' : 'Delete'}
    </button>
  )
}