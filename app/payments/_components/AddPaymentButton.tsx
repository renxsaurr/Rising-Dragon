'use client'

import { useCallback, useState } from 'react'
import AddPaymentModal from './AddPaymentModal'
import { FOCUS_RING } from './ModalShell'
import type { StudentChoice } from './StudentCombobox'

export default function AddPaymentButton({
  students,
  branchName,
  month,
  today,
  monthlyFee,
  perSessionFee,
  initialStudent,
  label = '+ Add payment',
  compact = false,
}: {
  students: StudentChoice[]
  /** Set when a branch card is selected, so the popup can say whose students it lists. */
  branchName?: string
  month: string
  today: string
  monthlyFee: number | null
  perSessionFee: number
  /** Opens the popup with this student already picked ("Record payment"). */
  initialStudent?: StudentChoice
  label?: string
  /** Small row button instead of the header button. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // The preset student is always pickable, even if the list was filtered to another branch.
  const choices =
    initialStudent && !students.some((student) => student.id === initialStudent.id)
      ? [initialStudent, ...students]
      : students

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`whitespace-nowrap rounded-lg bg-black font-semibold text-white hover:bg-gray-800 ${FOCUS_RING} ${
          compact ? 'px-3 py-2 text-xs' : 'h-9 px-3.5 text-sm'
        }`}
      >
        {label}
      </button>
      {open && (
        <AddPaymentModal
          students={choices}
          branchName={branchName}
          month={month}
          today={today}
          monthlyFee={monthlyFee}
          perSessionFee={perSessionFee}
          initialStudentId={initialStudent?.id}
          onClose={close}
        />
      )}
    </>
  )
}
