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
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)

    const result = await deleteUser(userId)

    if (result?.error) {
      alert(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    setShowConfirm(false)

    router.refresh()
  }

  return (
    <>
      {/* Delete Button */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || loading}
        className="px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Delete
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">

            {/* Title */}
            <h2 className="text-[17px] font-semibold text-black">
              Delete User
            </h2>

            {/* Message */}
            <p className="mt-3 text-[13px] leading-5 text-gray-600">
              Are you sure you want to continue deleting{' '}
              <span className="font-semibold text-black">
                {userName}
              </span>
              ?
            </p>

            <p className="mt-2 text-[12px] text-gray-400">
              This action cannot be undone.
            </p>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">

              {/* Cancel */}
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>

              {/* Confirm Delete */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2.5 bg-black text-white rounded-lg text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  )
}