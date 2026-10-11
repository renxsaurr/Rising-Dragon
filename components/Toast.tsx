'use client'

import { useEffect, useRef } from 'react'
import { useActionFeedback } from './ActionFeedback'

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { showSuccess } = useActionFeedback()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    shown.current = true
    showSuccess(message)
    onDismiss()
  }, [message, onDismiss, showSuccess])

  return null
}
