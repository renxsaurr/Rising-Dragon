'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { retryReminder } from '@/app/payments/actions'
import { Toast } from '@/components/Toast'

type Notice = { tone: 'error' | 'neutral'; text: string }

// Rendered on every reminder history row so its message stays visible after the
// page refreshes. The Retry button only shows on Failed rows; other rows show a
// short gray status.
export default function RetryReminderButton({
  reminderId,
  status,
}: {
  reminderId: number
  status: string
}) {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [toast, setToast] = useState('')
  const router = useRouter()
  const dismissToast = useCallback(() => setToast(''), [])

  const handleRetry = async () => {
    setLoading(true)
    setNotice(null)

    try {
      const result = await retryReminder(reminderId)
      router.refresh()

      if (result.error) {
        setNotice({ tone: 'error', text: result.error })
      } else if (result.status === 'Sent') {
        setToast(result.message)
      } else if (result.status === 'Skipped') {
        // Not an error: the guardian already paid or the student is inactive.
        setNotice({ tone: 'neutral', text: result.message })
      } else {
        setNotice({ tone: 'error', text: result.message ?? 'Could not retry this reminder.' })
      }
    } catch {
      setNotice({ tone: 'error', text: 'Could not retry this reminder. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {status === 'Failed' ? (
        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Retry'}
        </button>
      ) : status === 'Sent' ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-500">
          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          No action needed
        </span>
      ) : (
        <span className="whitespace-nowrap text-xs text-gray-500">
          {status === 'Scheduled' ? 'Sending…' : 'No action needed'}
        </span>
      )}

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`text-xs ${notice.tone === 'error' ? 'text-red-600' : 'text-gray-500'}`}
        >
          {notice.text}
        </p>
      )}

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  )
}
