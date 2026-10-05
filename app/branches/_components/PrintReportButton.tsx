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
      className="btn-secondary group px-3 py-1.5 text-[13px] transition-colors duration-200 hover:border-red-200 hover:bg-red-600/5 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 print:hidden"
    >
      <Printer className="h-4 w-4 transition-colors duration-200 group-hover:text-red-600" aria-hidden />
      Print / Save PDF
    </button>
  )
}
