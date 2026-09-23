'use client'

import { useEffect, useState } from 'react'

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => setVisible(false), 2200)
    const remove = setTimeout(onDismiss, 2500)
    return () => {
      cancelAnimationFrame(show)
      clearTimeout(hide)
      clearTimeout(remove)
    }
  }, [onDismiss])

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="bg-black text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
        <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {message}
      </div>
    </div>
  )
}