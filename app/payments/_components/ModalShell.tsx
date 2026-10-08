'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

// Shared classes for the payment popups, copied from Attendance's buttons and dropdown.
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'
export const BUTTON_PRIMARY = `rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`
export const BUTTON_SECONDARY = `rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`
export const INPUT = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-black/10 disabled:bg-gray-50'
export const LABEL = 'mb-1.5 block text-[13px] font-medium text-gray-700'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Popup frame in the ReminderReviewModal style. Focuses the first field on open,
 * keeps Tab inside the popup, closes on Escape unless busy, and gives focus back on close.
 */
export default function ModalShell({
  title,
  description,
  busy,
  onClose,
  size = 'md',
  children,
}: {
  title: string
  description?: string
  busy: boolean
  onClose: () => void
  /** 'lg' for longer forms such as Add payment. */
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  // The key handler is added once, so it reads the latest values from refs.
  const busyRef = useRef(busy)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    busyRef.current = busy
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    const previous = document.activeElement as HTMLElement | null
    const firstField = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstField ?? dialog)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busyRef.current) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-3 py-3 text-left sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} flex-col overflow-hidden rounded-2xl bg-white outline-none sm:max-h-[calc(100dvh-2rem)]`}
      >
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 id={titleId} className="break-words text-[17px] font-semibold text-gray-950">{title}</h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 break-words text-[13px] text-gray-700">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
