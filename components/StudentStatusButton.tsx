'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStudentActive } from '@/app/students/actions'

export default function StudentStatusButton({
  studentId,
  studentName,
  isActive,
  className,
}: {
  studentId: number
  studentName: string
  isActive: boolean
  className?: string
}) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const nextIsActive = !isActive
  const actionLabel = isActive ? 'Archive' : 'Restore'

  const handleStatusChange = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await setStudentActive(studentId, nextIsActive)

      if (result.error) {
        setError(result.error)
        return
      }

      setIsConfirming(false)
      router.refresh()
    } catch {
      setError(`Could not ${isActive ? 'archive' : 'restore'} this student. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const closeConfirmation = () => {
    if (loading) return
    setIsConfirming(false)
    setError('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setIsConfirming(true) }}
        className={className ?? `inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${isActive ? 'border-red-200 bg-white text-red-700 hover:bg-red-50' : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'}`}
      >
        {actionLabel}
      </button>

      {isConfirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby={`student-status-title-${studentId}`} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <button type="button" onClick={closeConfirmation} disabled={loading} aria-label="Close" className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50">×</button>
            <h2 id={`student-status-title-${studentId}`} className="text-lg font-semibold text-gray-950">{isActive ? 'Archive student?' : 'Restore student?'}</h2>
            <p className="mb-5 mt-1 text-sm text-gray-600">
              {isActive
                ? `Archive ${studentName}? Their profile and history will be kept, and they will no longer appear in active student lists or attendance rosters.`
                : `Restore ${studentName}? They will appear in active student lists and attendance rosters again.`}
            </p>

            {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={closeConfirmation} disabled={loading} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleStatusChange} disabled={loading} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {loading ? 'Saving…' : `${actionLabel} student`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
