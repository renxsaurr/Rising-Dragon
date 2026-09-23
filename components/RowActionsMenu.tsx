'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const DotsIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

export default function RowActionsMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const button = buttonRef.current
      const menu = menuRef.current
      if (!button || !menu) return

      const buttonRect = button.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const gap = 8
      const spaceBelow = window.innerHeight - buttonRect.bottom
      const openUp = spaceBelow < menuRect.height + gap && buttonRect.top > spaceBelow
      const preferredTop = openUp
        ? buttonRect.top - menuRect.height - gap
        : buttonRect.bottom + gap
      const top = Math.max(gap, Math.min(preferredTop, window.innerHeight - menuRect.height - gap))
      const right = Math.max(gap, window.innerWidth - buttonRect.right)

      setPosition({ top, right })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open row actions"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-black transition-colors"
      >
        <DotsIcon />
      </button>

      {open && (
        createPortal(
          <div
            ref={menuRef}
            onClick={() => setOpen(false)}
            style={{
              top: position?.top ?? 0,
              right: position?.right ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="fixed z-[1000] w-40 rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
          >
            {children}
          </div>,
          document.body
        )
      )}
    </div>
  )
}
