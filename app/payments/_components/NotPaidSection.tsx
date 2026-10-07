'use client'

import { useState } from 'react'
import AddPaymentButton from './AddPaymentButton'
import { FOCUS_RING } from './ModalShell'
import type { StudentChoice } from './StudentCombobox'
import { formatBeltLabel } from '@/utils/belts'
import type { NotPaidStudent } from '@/utils/payment-records'

const FIRST_ROWS = 10

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

/** Active students with nothing paid for the shown month. Each row can record a payment directly. */
export default function NotPaidSection({
  students,
  monthLabel,
  showBranch,
  studentChoices,
  branchName,
  month,
  today,
}: {
  students: NotPaidStudent[]
  /** e.g. "October 2026" */
  monthLabel: string
  showBranch: boolean
  /** The Add payment popup's student list. */
  studentChoices: StudentChoice[]
  branchName?: string
  month: string
  today: string
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? students : students.slice(0, FIRST_ROWS)

  return (
    <section className="mb-5 w-full min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-amber-900">Not paid yet — {monthLabel}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
          {students.length} student{students.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="divide-y divide-gray-100">
        {visible.map((student) => {
          const choice: StudentChoice = {
            id: student.id,
            name: student.name,
            belt: formatBeltLabel(student.beltLevel),
            branch: student.branchName,
          }
          return (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-900">{student.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[
                    choice.belt,
                    showBranch ? student.branchName : null,
                    student.enrollmentDate ? `Enrolled ${formatDate(student.enrollmentDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <AddPaymentButton
                students={studentChoices}
                branchName={branchName}
                month={month}
                today={today}
                initialStudent={choice}
                label="Record payment"
                compact
              />
            </li>
          )
        })}
      </ul>

      {students.length > FIRST_ROWS && (
        <div className="border-t border-gray-100 px-5 py-2.5">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
            className={`rounded text-xs font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-black ${FOCUS_RING}`}
          >
            {showAll ? 'Show less' : `Show all (${students.length})`}
          </button>
        </div>
      )}
    </section>
  )
}
