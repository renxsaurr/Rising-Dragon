'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import './branch-report-print.css'

// the browser's print dialog also offers "Save as PDF"
export default function PrintReportButton() {
  useEffect(() => {
    // <details> can't be opened from CSS, so open them for the print and close them again after
    let opened: HTMLDetailsElement[] = []
    const openAll = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>('[data-report-print] details:not([open])')]
      for (const details of opened) details.open = true
    }
    const restore = () => {
      for (const details of opened) details.open = false
      opened = []
    }
    window.addEventListener('beforeprint', openAll)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', openAll)
      window.removeEventListener('afterprint', restore)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Print / Save PDF
    </button>
  )
}
