'use client'

import { useCallback, useState } from 'react'
import { Toast } from '@/components/Toast'
import AddPaymentButton from './AddPaymentButton'
import CreateBillModal from './CreateBillModal'
import { FOCUS_RING } from './ModalShell'
import ReminderReviewModal from './ReminderReviewModal'
import SendReminderButton from './SendReminderButton'
import type { StudentChoice } from './StudentCombobox'
import { sendButtonState } from './reminder-button-state'
import { formatBeltLabel } from '@/utils/belts'
import { isValidEmail } from '@/utils/email'
import { formatPeso } from '@/utils/payment-fees'
import type { NotPaidStudent } from '@/utils/payment-records'
import type { ReminderSchedule, ReminderWindow } from '@/utils/reminder-timing'

const FIRST_ROWS = 10

// Same outline look as SendReminderButton.
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-red-600/5 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:hover:bg-gray-50'

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const emailProblem = (email: string) =>
  !email ? 'No guardian email' : !isValidEmail(email) ? 'Invalid guardian email' : null

/** Active students with nothing paid for the shown month. Each row can send a reminder or record a payment. */
export default function NotPaidSection({
  students,
  showBranch,
  studentChoices,
  branchName,
  month,
  today,
  monthlyFee,
  perSessionFee,
  reminderSchedule,
}: {
  students: NotPaidStudent[]
  showBranch: boolean
  /** The Add payment popup's student list. */
  studentChoices: StudentChoice[]
  branchName?: string
  month: string
  today: string
  monthlyFee: number | null
  perSessionFee: number
  reminderSchedule: ReminderSchedule
}) {
  const [showAll, setShowAll] = useState(false)
  // The popups live here, not in the rows: creating a bill changes the row's button
  // when the list refreshes, and that must not close the popup that follows.
  const [billStudent, setBillStudent] = useState<NotPaidStudent | null>(null)
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const closeBill = useCallback(() => setBillStudent(null), [])
  const closeReview = useCallback(() => setReviewId(null), [])
  const clearNotice = useCallback(() => setNotice(''), [])
  const visible = showAll ? students : students.slice(0, FIRST_ROWS)

  const handleCreated = (paymentId: number, timing: ReminderWindow) => {
    setBillStudent(null)
    if (timing.open) setReviewId(paymentId)
    else setNotice(`Bill created. The ${timing.nextType} reminder opens on ${formatDate(timing.opensOn)}.`)
  }

  return (
    // The tab and the panel heading around it name the list, so no border or header here.
    <div>
      <ul className="divide-y divide-gray-100">
        {visible.map((student) => {
          const choice: StudentChoice = {
            id: student.id,
            name: student.name,
            belt: formatBeltLabel(student.beltLevel),
            branch: student.branchName,
            billingPlan: 'Monthly',
          }
          const bill = student.existingUnpaid
          const problem = emailProblem(student.guardianEmail)
          return (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-900">{student.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[
                    choice.belt,
                    showBranch ? student.branchName : null,
                    student.enrollmentDate ? `Enrolled ${formatDate(student.enrollmentDate)}` : null,
                    bill ? `Unpaid bill ${formatPeso(bill.amount)} due ${formatDate(bill.dueDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-2">
                {bill ? (
                  // (a) A bill already exists: the normal reminder flow for that payment.
                  <SendReminderButton
                    paymentId={bill.id}
                    {...sendButtonState(
                      { dueDate: bill.dueDate, guardianEmail: student.guardianEmail, isActive: true, reminders: bill.reminders },
                      today,
                      reminderSchedule,
                    )}
                  />
                ) : (
                  // (b) No bill yet: create one first, then send.
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setBillStudent(student)}
                      disabled={Boolean(problem)}
                      className={OUTLINE_BUTTON}
                    >
                      Send reminder
                    </button>
                    <span className={`max-w-[200px] text-right text-xs ${problem ? 'text-amber-700' : 'text-gray-500'}`}>
                      {problem ?? 'Creates the bill first'}
                    </span>
                  </div>
                )}
                <AddPaymentButton
                  students={studentChoices}
                  branchName={branchName}
                  month={month}
                  today={today}
                  monthlyFee={monthlyFee}
                  perSessionFee={perSessionFee}
                  initialStudent={choice}
                  label="Record payment"
                  compact
                />
              </div>
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

      {billStudent && (
        <CreateBillModal student={billStudent} month={month} today={today} monthlyFee={monthlyFee} reminderSchedule={reminderSchedule} onCreated={handleCreated} onClose={closeBill} />
      )}
      {reviewId !== null && <ReminderReviewModal target={{ kind: 'payment', id: reviewId }} onClose={closeReview} />}
      {notice && <Toast message={notice} onDismiss={clearNotice} />}
    </div>
  )
}
