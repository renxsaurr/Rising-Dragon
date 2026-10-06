'use client'

import { useCallback, useState } from 'react'
import ReminderReviewModal from './ReminderReviewModal'

// Rendered on every reminder history row. The Retry button only shows on Failed rows
// and opens the review popup first; other rows show a short gray status.
export default function RetryReminderButton({
  reminderId,
  status,
}: {
  reminderId: number
  status: string
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <div className="flex flex-col items-start gap-1">
      {status === 'Failed' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-red-600/5 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Retry
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

      {/* Kept outside the status check so the result stays visible after the row turns Sent. */}
      {open && <ReminderReviewModal target={{ kind: 'retry', id: reminderId }} onClose={close} />}
    </div>
  )
}
