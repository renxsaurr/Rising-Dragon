'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useActionFeedback } from '@/components/ActionFeedback'

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

export default function LogoutButton({ sidebarOpen }: { sidebarOpen: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const { confirmAction } = useActionFeedback()

  const logout = async () => {
    const confirmed = await confirmAction({
      title: 'Log out?',
      description: 'Are you sure you want to end your session?',
      confirmLabel: 'Log out',
    })
    if (!confirmed) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={logout}
      title={!sidebarOpen ? 'Logout' : undefined}
      aria-label="Logout"
      className={`flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white py-2.5 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 ${sidebarOpen ? 'gap-2.5 px-4' : 'px-2'}`}
    >
      <LogoutIcon />
      {sidebarOpen && 'Logout'}
    </button>
  )
}
