'use client'

import { useState, type ReactNode } from 'react'

export default function SchedulingPageTabs({ scheduleContent, closuresContent, scheduleAction }: { scheduleContent: ReactNode; closuresContent: ReactNode; scheduleAction?: ReactNode }) {
  const [activeTab, setActiveTab] = useState<'directory' | 'closures'>('directory')
  const tabs = [
    { id: 'directory' as const, label: 'Directory' },
    { id: 'closures' as const, label: 'Branch Closures' },
  ]

  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1" role="tablist" aria-label="Schedule pages">
        {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-950'}`}>{tab.label}</button>)}
      </div>
      {activeTab === 'directory' && scheduleAction}
    </div>
    <div role="tabpanel">{activeTab === 'directory' ? scheduleContent : closuresContent}</div>
  </div>
}
