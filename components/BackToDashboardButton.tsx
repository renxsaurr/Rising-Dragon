'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackToDashboardButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard')}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back to dashboard
    </button>
  )
}
