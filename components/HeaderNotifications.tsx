'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarDays } from 'lucide-react'
import { getHeaderUpdates } from '@/app/header-actions'

type HeaderUpdate = {
  id: string
  title: string
  detail: string
  href: string
}

export default function HeaderNotifications({ isHeadCoach }: { isHeadCoach: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [updates, setUpdates] = useState<HeaderUpdate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const openMenu = async () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    setIsOpen(true)

    setLoading(true)
    setError('')
    try {
      const result = await getHeaderUpdates()
      setUpdates(result.updates as HeaderUpdate[])
      setError(result.error ?? '')
    } catch {
      setError('Could not load updates. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={openMenu} aria-label="Open notifications" aria-haspopup="dialog" aria-expanded={isOpen} className="relative grid h-10 w-10 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-red-500/20">
        <Bell className="h-[18px] w-[18px]" />
      </button>

      {isOpen && (
        <section role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-950">Notifications</h2>
            <p className="mt-0.5 text-xs text-gray-500">{isHeadCoach ? 'Assistant Coach availability for the next 7 days' : 'Your classes for the next 7 days'}</p>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Loading updates…</p>
          ) : error ? (
            <p role="alert" className="px-4 py-6 text-sm text-red-700">{error}</p>
          ) : updates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CalendarDays className="mx-auto h-5 w-5 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-700">No upcoming updates</p>
              <p className="mt-1 text-xs text-gray-500">New availability or class assignments will appear here.</p>
            </div>
          ) : (
            <div className="max-h-[min(60vh,22rem)] overflow-y-auto divide-y divide-gray-100">
              {updates.map((update) => (
                <Link key={update.id} href={update.href} onClick={() => setIsOpen(false)} className="block px-4 py-3 transition-colors hover:bg-gray-50">
                  <span className="block text-sm font-medium text-gray-900">{update.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">{update.detail}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-[10px] text-gray-400">Live updates · no unread status is tracked yet</p>
          </div>
        </section>
      )}
    </div>
  )
}
