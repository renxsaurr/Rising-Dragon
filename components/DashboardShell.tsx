'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
  </svg>
)
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 4v-1a4 4 0 00-3-3.87" />
  </svg>
)
const CheckSquareIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
)
const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)
const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21h18M6 21V7l6-4 6 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
  </svg>
)
const CreditCardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M2 10h20" />
  </svg>
)
const AwardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="8" r="6" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.5 13.5L6 22l6-3 6 3-2.5-8.5" />
  </svg>
)
const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="3" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)
const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)
const IdCardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.75} />
    <circle cx="8" cy="12" r="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M5 17c.5-1.5 1.8-2.5 3-2.5s2.5 1 3 2.5M14 9h6M14 13h6" />
  </svg>
)

type CurrentUser = {
  id: number
  name: string
  role: string
  home_branch_id: number | null
} | null

export default function DashboardShell({
  title,
  currentUser,
  children,
}: {
  title: string
  currentUser: CurrentUser
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isHeadCoach = currentUser?.role === 'head_coach'

  const workspaceItems = [
    { label: 'Students', href: '/students', icon: UsersIcon, show: true, soon: false },
    { label: 'Attendance', href: '/attendance', icon: CheckSquareIcon, show: true, soon: false },
    { label: 'Schedule', href: '/scheduling', icon: CalendarIcon, show: true, soon: false },
    { label: 'Branches', href: '/branches', icon: BuildingIcon, show: isHeadCoach, soon: false },
  ]

  const reportItems = [
    { label: 'Payments', href: '/payments', icon: CreditCardIcon, show: true, soon: false },
    { label: 'Promotions', href: '/promotions', icon: AwardIcon, show: true, soon: true },
  ]

  const systemItems = [
    { label: 'Notifications', href: '/notifications', icon: BellIcon, show: true, soon: true },
    { label: 'Settings', href: '/settings', icon: SettingsIcon, show: true, soon: true },
    { label: 'Users', href: '/users', icon: IdCardIcon, show: true, soon: false},
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const renderItem = (item: { label: string; href: string; icon: () => React.ReactElement; soon: boolean }) => {
    const isActive = pathname === item.href
    const Icon = item.icon

    if (item.soon) {
      return (
        <div
          key={item.href}
          title="Coming soon"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-gray-600 cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <Icon />
            {item.label}
          </div>
          <span className="text-[10px] font-semibold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
            Soon
          </span>
        </div>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
          isActive
            ? 'bg-red-600 text-white'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Icon />
        {item.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      <aside className="w-64 bg-black flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo.png" alt="" fill className="object-contain" />
          </div>
          <span className="text-white text-[14px] font-semibold">Rising Dragon</span>
        </div>

        <nav className="flex-1 px-3 mt-2 flex flex-col gap-1 overflow-y-auto">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <GridIcon />
            Dashboard
          </Link>

          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-3.5 mt-5 mb-1">
            Workspace
          </p>
          {workspaceItems.filter((item) => item.show).map(renderItem)}

          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-3.5 mt-5 mb-1">
            Reports
          </p>
          {reportItems.filter((item) => item.show).map(renderItem)}

          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-3.5 mt-5 mb-1">
            System
          </p>
          {systemItems.filter((item) => item.show).map(renderItem)}
        </nav>

        {currentUser && (
          <div className="px-4 py-3 mx-3 mb-2 bg-white/5 rounded-lg">
            <p className="text-[13px] font-medium text-white truncate">{currentUser.name}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">
              {isHeadCoach ? 'Head Coach' : 'Assistant Coach'}
            </p>
          </div>
        )}

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors w-full"
          >
            <LogoutIcon />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-[18px] font-semibold text-black">{title}</h1>
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}