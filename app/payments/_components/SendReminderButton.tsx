'use client'

import { useCallback, useId, useState, type ReactNode } from 'react'
import ReminderReviewModal from './ReminderReviewModal'
import type { ReminderType } from '@/utils/payment-reminders'

// Shown on Unpaid payment rows. Opens the review popup; nothing is sent from here.
export default function SendReminderButton({
  paymentId,
  reminderType,
  disabledLabel,
  disabledReason,
  hint,
  trigger,
  compact = false,
}: {
  paymentId: number
  reminderType: ReminderType
  /** Replaces the button text, e.g. "Sent Oct 5". */
  disabledLabel?: string
  /** Why the button can't be used, shown under it. */
  disabledReason?: string
  /** Small gray note under the button in place of the reminder type. */
  hint?: string
  trigger?: ReactNode
  /** Hide the helper text when the trigger is rendered inside an action menu. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const noteId = useId()
  const disabled = Boolean(disabledLabel || disabledReason)

  return (
    <div className={compact ? 'flex w-full flex-col gap-1' : 'flex flex-col items-end gap-1'}>
      {trigger ? (
        <div>
          <div onClick={() => { if (!disabled) setOpen(true) }}>{trigger}</div>
          {!compact && disabled && disabledReason && <span id={noteId} className="mt-1 block max-w-[190px] px-3 text-xs text-amber-700">{disabledReason}</span>}
        </div>
      ) : <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-describedby={noteId}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-red-600/5 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:hover:bg-gray-50"
      >
        {disabledLabel ?? 'Send reminder'}
      </button>}
      {!compact && <span
        id={noteId}
        className={`max-w-[200px] text-right text-xs ${disabledReason ? 'text-amber-700' : 'text-gray-500'}`}
      >
        {disabledReason ?? hint ?? `${reminderType} reminder`}
      </span>}

      {/* Kept outside the disabled check so the result stays visible after the page refreshes. */}
      {open && <ReminderReviewModal target={{ kind: 'payment', id: paymentId }} onClose={close} />}
    </div>
  )
}
