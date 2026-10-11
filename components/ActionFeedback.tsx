'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'

type ConfirmOptions = {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type DialogState =
  | { type: 'success'; title: string; description: string }
  | ({ type: 'confirm' } & Required<ConfirmOptions>)
  | null

type ActionFeedbackValue = {
  showSuccess: (description: string, title?: string) => void
  confirmAction: (options: ConfirmOptions) => Promise<boolean>
}

const ActionFeedbackContext = createContext<ActionFeedbackValue | null>(null)

export function useActionFeedback() {
  const value = useContext(ActionFeedbackContext)
  if (!value) throw new Error('useActionFeedback must be used inside ActionFeedbackProvider.')
  return value
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const resolver = useRef<((confirmed: boolean) => void) | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const showSuccess = useCallback((description: string, title = 'Task successful') => {
    setDialog({ type: 'success', title, description })
  }, [])

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve
    setDialog({
      type: 'confirm',
      title: options.title ?? 'Are you sure?',
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      danger: options.danger ?? false,
    })
  }), [])

  const close = useCallback((confirmed = false) => {
    setDialog(null)
    resolver.current?.(confirmed)
    resolver.current = null
  }, [])

  useEffect(() => {
    if (!dialog) return
    confirmButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, close])

  const value = { showSuccess, confirmAction }

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(false) }}
        >
          <section
            role={dialog.type === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="action-feedback-title"
            aria-describedby="action-feedback-description"
            className="relative w-full max-w-sm rounded-2xl bg-white px-6 py-6 text-center shadow-2xl sm:px-7 sm:py-7"
          >
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => close(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-950"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className={`mx-auto grid h-10 w-10 place-items-center rounded-xl ${dialog.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {dialog.type === 'success' ? <Check size={22} strokeWidth={2.2} aria-hidden="true" /> : <TriangleAlert size={21} strokeWidth={2} aria-hidden="true" />}
            </div>
            <h2 id="action-feedback-title" className="mt-3 text-xl font-semibold tracking-tight text-gray-950">{dialog.title}</h2>
            <p id="action-feedback-description" className="mx-auto mt-1.5 max-w-xs text-sm leading-5 text-gray-500">{dialog.description}</p>

            {dialog.type === 'success' ? (
              <button type="button" onClick={() => close(false)} ref={confirmButtonRef} className="mt-5 h-10 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">
                Got it
              </button>
            ) : (
              <div className="mt-5 grid gap-2">
                <button type="button" onClick={() => close(true)} ref={confirmButtonRef} className={`h-10 w-full rounded-lg px-4 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${dialog.danger ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500' : 'bg-gray-950 hover:bg-gray-800 focus-visible:ring-gray-700'}`}>
                  {dialog.confirmLabel}
                </button>
                <button type="button" onClick={() => close(false)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">
                  {dialog.cancelLabel}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </ActionFeedbackContext.Provider>
  )
}
