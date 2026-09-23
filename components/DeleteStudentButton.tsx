'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: number
  studentName: string
}) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.from('Student').delete().eq('id', studentId)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setIsConfirming(false)
    router.refresh()
  }

  if (isConfirming) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => setIsConfirming(false)}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-[17px] font-semibold text-black mb-2">Remove student?</h3>
          <p className="text-[13px] text-gray-500 mb-1">
            This will permanently remove <span className="font-medium text-black">{studentName}</span> from the system.
          </p>
          <p className="text-[13px] text-gray-500 mb-5">This action can't be undone.</p>

          {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setIsConfirming(false)}
              className="flex-1 h-10 border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-[13px] font-semibold transition-colors"
            >
              {loading ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="text-[12px] font-semibold text-gray-400 hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  )
}