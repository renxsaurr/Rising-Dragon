'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

// ---------- Icons (consistent 20px, 1.75 stroke) ----------
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
const CreditCardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M2 10h20" />
  </svg>
)
const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21h18M6 21V7l6-4 6 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
  </svg>
)
const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

type CurrentUser = {
  id: number
  name: string
  role: string
  home_branch_id: number | null
} | null

type NavItem = {
  label: string
  href: string
  icon: () => ReactNode
  show: boolean
}

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

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: GridIcon, show: true },
    { label: 'Students', href: '/students', icon: UsersIcon, show: true },
    { label: 'Attendance', href: '/attendance', icon: CheckSquareIcon, show: true },
    { label: 'Schedule', href: '/scheduling', icon: CalendarIcon, show: true },
    { label: 'Payments', href: '/payments', icon: CreditCardIcon, show: true },
    { label: 'Branches', href: '/branches', icon: BuildingIcon, show: isHeadCoach },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Generate initials for the avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen w-full flex bg-gray-50/50">
      {/* ==================== SIDEBAR ==================== */}
      <aside className="w-[260px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-20 flex items-center gap-3.5 px-6 border-b border-gray-100">
          <div className="relative w-10 h-10 shrink-0 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
            <Image src="/logo.png" alt="Rising Dragon" fill className="object-contain" />
          </div>
          <span className="text-[17px] font-bold text-gray-900 tracking-tight">
            Rising Dragon
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1 overflow-y-auto">
          {navItems.filter((item) => item.show).map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-red-600 text-white shadow-[0_4px_14px_rgba(220,38,38,0.25)]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}>
                  <Icon />
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout (Moved to the very bottom since user profile is gone) */}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
          >
            <LogoutIcon />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ==================== MAIN ==================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Now contains the User Profile on the right */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* User Profile */}
          {currentUser && (
            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
              <div className="hidden sm:block text-right">
                <p className="text-[13.5px] font-semibold text-gray-900 leading-tight">
                  {currentUser.name}
                </p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">
                  {isHeadCoach ? 'Head Coach' : 'Assistant Coach'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 text-[14px] font-semibold shrink-0">
                {getInitials(currentUser.name)}
              </div>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-8 overflow-auto bg-gray-50/50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}