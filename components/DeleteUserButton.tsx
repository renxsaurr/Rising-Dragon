'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'

import { deleteUser } from '@/app/users/actions'

type DeleteUserButtonProps = {
  userId: number
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

  const closeConfirm = () => {
    if (loading) return

    setShowConfirm(false)
  }

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
      {/* DELETE ICON */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || loading}
        title="Delete user"
        aria-label={`Delete ${userName}`}
        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2
          size={20}
          strokeWidth={2}
        />
      </button>

      {/* CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">

            {/* Close */}
            <button
              type="button"
              onClick={closeConfirm}
              disabled={loading}
              aria-label="Close"
              className="absolute right-4 top-4 p-1 text-gray-400 hover:text-black transition-colors"
            >
              <X size={18} />
            </button>

            {/* Delete Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
              <Trash2
                size={22}
                className="text-red-500"
              />
            </div>

            {/* Title */}
            <h2 className="text-[18px] font-semibold text-black">
              Delete User
            </h2>

            {/* Message */}
            <p className="mt-2 text-[13px] leading-5 text-gray-600">
              Are you sure you want to continue
              deleting{' '}
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

              <button
                type="button"
                onClick={closeConfirm}
                disabled={loading}
                className="h-10 px-5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="h-10 px-5 bg-black text-white rounded-lg text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading
                  ? 'Deleting...'
                  : 'Delete'}
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  )
}