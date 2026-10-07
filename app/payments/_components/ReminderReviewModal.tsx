'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  getReminderPreview,
  getRetryPreview,
  retryReminder,
  sendPaymentReminder,
} from '@/app/payments/actions'
import type { ReminderPreview } from '@/utils/payment-reminders'

// payment = "Send reminder" on a payment row; retry = "Retry" on a failed history row.
export type ReminderTarget = { kind: 'payment' | 'retry'; id: number }

type Notice = { tone: 'success' | 'error' | 'neutral'; text: string }

const NOTICE_STYLES: Record<Notice['tone'], string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  error: 'bg-red-50 text-red-700 ring-red-600/20',
  neutral: 'bg-gray-50 text-gray-600 ring-gray-500/20',
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2'

// closed = the failed reminder was closed because no reminder is needed. Not an error.
const toNotice = (result: { error: string; closed?: boolean }): Notice => ({
  tone: result.closed ? 'neutral' : 'error',
  text: result.error,
})

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-gray-950">{value}</dd>
    </div>
  )
}

/** The Head Coach checks the student, recipient, amount, due date and email before anything is sent. */
export default function ReminderReviewModal({ target, onClose }: { target: ReminderTarget; onClose: () => void }) {
  const [preview, setPreview] = useState<ReminderPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Set on the first click and never cleared, so a double click can't send twice.
  const attempted = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    let cancelled = false
    const load = target.kind === 'payment' ? getReminderPreview : getRetryPreview
    load(target.id)
      .then((result) => {
        if (cancelled) return
        if ('preview' in result) setPreview(result.preview)
        else setNotice(toNotice(result))
      })
      .catch(() => {
        if (!cancelled) setNotice({ tone: 'error', text: 'Could not load the preview. Please try again.' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [target.kind, target.id])

  // Move focus into the popup, and give it back to the button that opened it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [])

  // The popup can't be closed while an email is being sent.
  const close = useCallback(() => {
    if (!sending) onClose()
  }, [sending, onClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])

  const handleSend = async () => {
    if (!preview || attempted.current) return
    attempted.current = true
    setSending(true)
    setNotice(null)

    const reviewed = { recipient: preview.recipient, reminderType: preview.reminderType }
    try {
      const result =
        target.kind === 'payment'
          ? await sendPaymentReminder(target.id, reviewed)
          : await retryReminder(target.id, reviewed)
      setNotice('success' in result ? { tone: 'success', text: result.message } : toNotice(result))
    } catch {
      setNotice({
        tone: 'error',
        text: 'Could not reach the server. Refresh the page and check Reminder history before trying again.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 text-left"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white outline-none"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id={titleId} className="text-[17px] font-semibold text-gray-950">
            {target.kind === 'payment' ? 'Review payment reminder' : 'Review reminder retry'}
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Check the details below. Nothing is sent until you press Send email.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {notice && (
            <p
              role={notice.tone === 'error' ? 'alert' : 'status'}
              className={`mb-4 rounded-lg px-4 py-2.5 text-[13px] ring-1 ring-inset ${NOTICE_STYLES[notice.tone]}`}
            >
              {notice.text}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">Loading preview…</p>
          ) : (
            preview && (
              <>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Detail label="Student" value={preview.studentName} />
                  <Detail label="Guardian" value={preview.guardianName ?? '—'} />
                  <Detail label="Recipient email" value={preview.recipient} />
                  <Detail label="Amount" value={preview.amount} />
                  <Detail label="Due date" value={preview.dueDate} />
                  <Detail label="Reminder type" value={preview.reminderType} />
                  <Detail label="Subject" value={preview.subject} className="sm:col-span-2" />
                </dl>
                <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Email preview
                </p>
                {/* Empty sandbox: no scripts, forms or links can run inside the preview. */}
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-[420px] w-full rounded-lg border border-gray-200 bg-gray-100"
                />
                {/* The same subject and text the guardian gets, from the same server function. */}
                <details className="mt-4 rounded-lg border border-gray-200">
                  <summary className={`cursor-pointer select-none rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-black ${FOCUS_RING}`}>
                    Preview email
                  </summary>
                  <div className="space-y-3 border-t border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Subject</p>
                      <p className="mt-0.5 break-words text-sm text-gray-950">{preview.subject}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Message</p>
                      <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800">{preview.text}</pre>
                    </div>
                  </div>
                </details>
              </>
            )
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={close}
            disabled={sending}
            className={`rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-red-600/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            {notice ? 'Close' : 'Cancel'}
          </button>
          {preview && !notice && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              aria-busy={sending}
              className={`rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {sending ? 'Sending…' : 'Send email'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
