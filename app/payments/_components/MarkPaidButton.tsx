'use client'

import { useCallback, useState } from 'react'
import MarkPaidModal, { type PaymentToMark } from './MarkPaidModal'
import { FOCUS_RING } from './ModalShell'

export default function MarkPaidButton({ payment, today }: { payment: PaymentToMark; today: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 ${FOCUS_RING}`}
      >
        Mark as paid
      </button>
      {open && <MarkPaidModal payment={payment} today={today} onClose={close} />}
    </>
  )
}
