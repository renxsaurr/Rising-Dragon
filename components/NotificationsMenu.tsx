'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronRight, RefreshCw, X } from 'lucide-react'
import { getHeaderNotifications } from '@/app/notifications/actions'
import type { SystemNotification } from '@/utils/notifications'
import { createClient } from '@/utils/supabase/client'

const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
}).format(new Date(value))

const statusColor = {
  'Action needed': 'text-red-700',
  Upcoming: 'text-gray-600',
  Update: 'text-blue-700',
} as const

const seenStorageKey = (userId: number) => `rising-dragon-notification-seen:${userId}`
const readStorageKey = (userId: number) => `rising-dragon-notification-read:${userId}`

function readSeenIds(key: string) {
  try {
    const saved = window.localStorage.getItem(key)
    return saved === null ? null : new Set<string>(JSON.parse(saved) as string[])
  } catch {
    return new Set<string>()
  }
}

function saveSeenIds(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-200)))
  } catch {
    // Notifications still work for this visit when browser storage is unavailable.
  }
}

function readReadIds(key: string) {
  try {
    const saved = window.localStorage.getItem(key)
    return saved === null ? new Set<string>() : new Set<string>(JSON.parse(saved) as string[])
  } catch {
    return new Set<string>()
  }
}

function saveReadIds(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-200)))
  } catch {
    // The unread count still works for this visit when browser storage is unavailable.
  }
}

export default function NotificationsMenu({ userId }: { userId: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const refreshInFlightRef = useRef(false)
  const seenMemoryRef = useRef(new Set<string>())
  const readIdsRef = useRef(new Set<string>())
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toastNotification, setToastNotification] = useState<SystemNotification | null>(null)
  const unreadCount = notifications.reduce((count, notification) => count + Number(!readIds.has(notification.id)), 0)

  useEffect(() => {
    const savedReadIds = readReadIds(readStorageKey(userId))
    readIdsRef.current = savedReadIds
    setReadIds(savedReadIds)
  }, [userId])

  const markNotificationRead = (notificationId: string) => {
    if (!readIdsRef.current.has(notificationId)) {
      const nextReadIds = new Set(readIdsRef.current)
      nextReadIds.add(notificationId)
      readIdsRef.current = nextReadIds
      setReadIds(nextReadIds)
      saveReadIds(readStorageKey(userId), nextReadIds)
    }
    setToastNotification(null)
  }

  const refresh = useCallback(async (showLoading = false) => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const result = await getHeaderNotifications()
      if (result.error) {
        setError(result.error)
        return
      }

      const nextNotifications = result.notifications
      setNotifications(nextNotifications)
      const key = seenStorageKey(userId)
      const savedSeen = readSeenIds(key)
      const isFirstLoad = savedSeen === null && seenMemoryRef.current.size === 0
      const seen = new Set([...seenMemoryRef.current, ...(savedSeen ?? [])])
      const unseen = isFirstLoad
        ? nextNotifications
        : nextNotifications.filter((notification) => !seen.has(notification.id))

      if (unseen.length) setToastNotification(unseen[0])
      for (const notification of nextNotifications) seen.add(notification.id)
      seenMemoryRef.current = seen
      saveSeenIds(key, seen)
    } catch {
      setError('Notifications could not be loaded. Please try again.')
    } finally {
      refreshInFlightRef.current = false
      if (showLoading) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const handleOutsideClick = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    const onFocus = () => void refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Realtime updates surface new records quickly; periodic refresh remains
    // as a fallback for projects where these tables are not in the realtime publication.
    let client: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      client = createClient()
      channel = client.channel(`header-notifications-${userId}`)
      for (const table of ['payment_reminder', 'payment', 'class_schedule', 'attendance', 'schedule_absence_report'] as const) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => void refresh())
      }
      channel.subscribe()
    } catch {
      // The immediate and periodic server refreshes still keep the bell current.
    }

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (client && channel) void client.removeChannel(channel)
    }
  }, [refresh, userId])

  useEffect(() => {
    if (!toastNotification) return
    const timeout = window.setTimeout(() => setToastNotification(null), 8_000)
    return () => window.clearTimeout(timeout)
  }, [toastNotification])

  const toggleOpen = () => {
    const nextIsOpen = !isOpen
    setIsOpen(nextIsOpen)
    if (nextIsOpen) {
      setToastNotification(null)
      void refresh(true)
    }
  }

  return (
    <>
      <div ref={wrapperRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Open notifications"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggleOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-red-500/20"
        >
          <Bell aria-hidden className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span aria-label={`${unreadCount} unread notifications`} className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <section role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-[80] mt-2 flex max-h-[min(76vh,36rem)] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">Notifications</h2>
              </div>
              <button type="button" aria-label="Refresh notifications" onClick={() => void refresh(true)} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50">
                <RefreshCw aria-hidden className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-gray-500">Loading notifications…</p>
              ) : error ? (
                <div className="px-4 py-6 text-center">
                  <p role="alert" className="text-sm text-red-700">{error}</p>
                  <button type="button" onClick={() => void refresh(true)} className="mt-3 text-sm font-semibold text-gray-900 underline underline-offset-4">Try again</button>
                </div>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-600">You’re all caught up.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <Link href={notification.href} onClick={() => { markNotificationRead(notification.id); setIsOpen(false) }} className="block px-4 py-3 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-5 text-gray-950">{notification.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-gray-600">{notification.detail}</span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                              <span className="font-medium text-gray-500">{notification.category}</span>
                              <span aria-hidden className="text-gray-300">·</span>
                              <span className={`font-medium ${statusColor[notification.status]}`}>{notification.status}</span>
                              <span aria-hidden className="text-gray-300">·</span>
                              <time dateTime={notification.date} className="text-gray-500">{dateTime(notification.date)}</time>
                            </span>
                          </span>
                          <ChevronRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>

      {toastNotification && (
        <aside role="status" aria-live="polite" className="fixed right-4 top-4 z-[100] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/15">
          <div className="flex items-start gap-3 p-4">
            <span aria-hidden className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toastNotification.status === 'Action needed' ? 'bg-red-600' : toastNotification.status === 'Update' ? 'bg-blue-600' : 'bg-gray-500'}`} />
            <Link href={toastNotification.href} onClick={() => markNotificationRead(toastNotification.id)} className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-black/20">
              <span className="block text-sm font-semibold text-gray-950">{toastNotification.title}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-700">{toastNotification.detail}</span>
              <span className="mt-2 block text-xs font-semibold text-gray-950">Open notification <span aria-hidden>→</span></span>
            </Link>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToastNotification(null)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-950">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </>
  )
}
