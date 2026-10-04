'use client'

import DashboardShell, { getLastKnownUser } from '@/components/DashboardShell'

export default function DashboardLoading({ title }: { title: string }) {
  return (
    <DashboardShell title={title} currentUser={getLastKnownUser()}>
      <div role="status" aria-label="Loading" className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-10 w-full rounded-lg bg-gray-100" />
        <div className="space-y-2 rounded-xl border border-gray-100 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-9 rounded-md bg-gray-100" />
          ))}
        </div>
        <span className="sr-only">Loading</span>
      </div>
    </DashboardShell>
  )
}
