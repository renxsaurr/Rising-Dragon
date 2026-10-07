'use client'

import { useRef, type KeyboardEvent } from 'react'
import Link from 'next/link'
import type { PaymentTab } from './payments-url'

export type TabItem = {
  key: PaymentTab
  /** id of the tab element, used by the panel's aria-labelledby. */
  id: string
  label: string
  count: number
  /** Amber badge when the count is above 0. */
  alert: boolean
  href: string
}

/** Attendance-style tab bar. Each tab is a link (the tab lives in the URL); arrow keys move between tabs. */
export default function PaymentTabs({ tabs, active, panelId }: { tabs: TabItem[]; active: PaymentTab; panelId: string }) {
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    tabRefs.current[next]?.focus()
  }

  return (
    // Scrolls sideways on small screens instead of wrapping the tabs.
    <div className="max-w-full overflow-x-auto">
      <div role="tablist" aria-label="Payment lists" className="flex w-max gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {tabs.map((tab, index) => {
          const selected = tab.key === active
          const badge =
            tab.alert && tab.count > 0
              ? 'bg-amber-100 text-amber-800'
              : selected
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-600'
          return (
            <Link
              key={tab.key}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              id={tab.id}
              href={tab.href}
              scroll={false}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              // Only the active tab is in the Tab order; arrow keys reach the others.
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                selected ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>{tab.count}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
