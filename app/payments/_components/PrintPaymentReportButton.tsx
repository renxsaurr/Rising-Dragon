'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { FOCUS_RING } from './ModalShell'
import './payment-report-print.css'

// Same idea as Branch Reports: the browser's print dialog also offers "Save as PDF".
export default function PrintPaymentReportButton({ documentTitle }: { documentTitle: string }) {
  useEffect(() => {
    // The saved PDF is named after document.title, so use the report title only while printing.
    // Ctrl+P works too, because these run for every print, not just the button.
    let previous = document.title
    const useReportTitle = () => {
      previous = document.title
      document.title = documentTitle
    }
    const restoreTitle = () => {
      document.title = previous
    }
    window.addEventListener('beforeprint', useReportTitle)
    window.addEventListener('afterprint', restoreTitle)
    return () => {
      window.removeEventListener('beforeprint', useReportTitle)
      window.removeEventListener('afterprint', restoreTitle)
    }
  }, [documentTitle])

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-black print:hidden ${FOCUS_RING}`}
    >
      <Printer className="h-4 w-4" aria-hidden />
      Print / Save PDF
    </button>
  )
}
