'use client'

import { FOCUS_RING } from './ModalShell'

// Retry on a Failed history row. The review popup is opened by the history table, so the popup
// and its result stay open even if the row turns Sent or leaves the Failed filter after the refresh.
export default function RetryReminderButton({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={className ?? `inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-black ${FOCUS_RING}`}
    >
      Retry
    </button>
  )
}
