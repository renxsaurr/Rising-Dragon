'use client'

import { useCallback, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AddPaymentButton from './AddPaymentButton'
import AdvancePaymentButton from './AdvancePaymentButton'
import CreateBillModal from './CreateBillModal'
import MarkPaidButton from './MarkPaidButton'
import ReminderReviewModal from './ReminderReviewModal'
import RowActionItem, { ROW_ACTION_CLASS } from '@/components/RowActionItem'
import RowActionsMenu from '@/components/RowActionsMenu'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import PaginatedListItems from '@/components/PaginatedListItems'
import { Toast } from '@/components/Toast'
import { formatBeltLabel } from '@/utils/belts'
import { formatAmount } from '@/utils/payment-display'
import { formatPeso } from '@/utils/payment-fees'
import type { NotPaidStudent, PaymentRecord, ReminderSummary } from '@/utils/payment-records'
import type { ReminderSchedule, ReminderWindow } from '@/utils/reminder-timing'
import type { StudentChoice } from './StudentCombobox'
import SendReminderButton from './SendReminderButton'
import SessionChargesPaymentButton from './SessionChargesPaymentButton'
import { sendButtonState } from './reminder-button-state'

const TH = 'px-4 py-4 text-left text-xs font-medium text-gray-500'
const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
})
const daysUntil = (today: string, date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)

type BranchChoice = { key: string; name: string }
type UnpaidRow = {
  key: string
  studentId: number
  studentName: string
  beltLevel: string
  branchName: string
  guardianEmail: string
  billingPlan: 'Monthly' | 'Per session'
  amount: number
  dueDate: string | null
  isActive: boolean
  monthlyStudent?: NotPaidStudent
  sessionCharges: PaymentRecord[]
  reminders: ReminderSummary[]
}

function latestReminder(reminders: ReminderSummary[]) {
  const order = ['Before due', 'Due today', 'After due']
  return [...reminders].sort((a, b) => order.indexOf(b.reminderType) - order.indexOf(a.reminderType))[0]
}

function reminderLabel(row: UnpaidRow) {
  if (row.billingPlan === 'Per session') return 'Not available for session charges'
  if (!row.dueDate) return 'Bill needed'
  const latest = latestReminder(row.reminders)
  if (!latest) return 'Not sent'
  if (latest.status === 'Sent' && latest.sentAt) return `Sent ${formatDate(latest.sentAt.slice(0, 10))}`
  if (latest.status === 'Scheduled') return 'Sending'
  return latest.status
}

function RowActions({ row, studentChoices, month, today, monthlyFee, perSessionFee, reminderSchedule }: {
  row: UnpaidRow
  studentChoices: StudentChoice[]
  month: string
  today: string
  monthlyFee: number | null
  perSessionFee: number
  reminderSchedule: ReminderSchedule
}) {
  const router = useRouter()
  const [billOpen, setBillOpen] = useState(false)
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const choice: StudentChoice = {
    id: row.studentId,
    name: row.studentName,
    belt: formatBeltLabel(row.beltLevel),
    branch: row.branchName,
    billingPlan: row.billingPlan,
  }
  const scopedChoices = studentChoices.some((student) => student.id === choice.id) ? studentChoices : [choice, ...studentChoices]
  const reminderState = row.dueDate
    ? sendButtonState({ dueDate: row.dueDate, guardianEmail: row.guardianEmail, isActive: row.isActive, reminders: row.reminders }, today, reminderSchedule)
    : null

  const onBillCreated = (paymentId: number, timing: ReminderWindow) => {
    setBillOpen(false)
    router.refresh()
    if (timing.open) setReviewId(paymentId)
    else setNotice(`Bill created. The ${timing.nextType} reminder opens on ${formatDate(timing.opensOn)}.`)
  }

  return (
    <>
      <RowActionsMenu>
        {row.billingPlan === 'Monthly' ? (
          <>
            {row.monthlyStudent?.existingUnpaid ? (
              <MarkPaidButton
                payment={{
                  id: row.monthlyStudent.existingUnpaid.id,
                  studentName: row.studentName,
                  amount: formatAmount(row.monthlyStudent.existingUnpaid.amount),
                  dueDate: formatDate(row.monthlyStudent.existingUnpaid.dueDate),
                }}
                today={today}
                trigger={<RowActionItem>Record payment</RowActionItem>}
              />
            ) : (
              <AddPaymentButton
                students={scopedChoices}
                branchName={row.branchName}
                month={month}
                today={today}
                monthlyFee={monthlyFee}
                perSessionFee={perSessionFee}
                initialStudent={choice}
                label="Add payment or bill"
                trigger={<RowActionItem>Add payment</RowActionItem>}
              />
            )}
            {row.monthlyStudent?.existingUnpaid && (
              <AdvancePaymentButton
                students={[choice]}
                today={today}
                initialStudent={choice}
                trigger={<RowActionItem>Record advance payment</RowActionItem>}
              />
            )}
            {row.monthlyStudent?.existingUnpaid && reminderState && (
              <SendReminderButton
                paymentId={row.monthlyStudent.existingUnpaid.id}
                {...reminderState}
                compact
                trigger={<RowActionItem disabled={Boolean(reminderState.disabledLabel || reminderState.disabledReason)} title={reminderState.disabledReason} className={`${ROW_ACTION_CLASS} disabled:cursor-not-allowed disabled:text-gray-400`}>{reminderState.disabledLabel ?? 'Send reminder'}</RowActionItem>}
              />
            )}
            {!row.monthlyStudent?.existingUnpaid && (
              <RowActionItem onClick={() => setBillOpen(true)}>Create bill and send reminder</RowActionItem>
            )}
          </>
        ) : (
          <SessionChargesPaymentButton
            studentId={row.studentId}
            studentName={row.studentName}
            charges={row.sessionCharges}
            today={today}
            trigger={<RowActionItem>Record selected session payments</RowActionItem>}
          />
        )}
      </RowActionsMenu>
      {billOpen && row.monthlyStudent && (
        <CreateBillModal
          student={row.monthlyStudent}
          month={month}
          today={today}
          monthlyFee={monthlyFee}
          reminderSchedule={reminderSchedule}
          onCreated={onBillCreated}
          onClose={() => setBillOpen(false)}
        />
      )}
      {reviewId !== null && <ReminderReviewModal target={{ kind: 'payment', id: reviewId }} onClose={() => setReviewId(null)} />}
      {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

export default function UnpaidStudentsTable({
  monthlyStudents,
  sessionPayments,
  branches,
  selectedBranch,
  studentChoices,
  month,
  today,
  monthlyFee,
  perSessionFee,
  reminderSchedule,
}: {
  monthlyStudents: NotPaidStudent[]
  sessionPayments: PaymentRecord[]
  branches: BranchChoice[]
  selectedBranch: string
  studentChoices: StudentChoice[]
  month: string
  today: string
  monthlyFee: number | null
  perSessionFee: number
  reminderSchedule: ReminderSchedule
}) {
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'Monthly' | 'Per session'>('all')
  const [branchFilter, setBranchFilter] = useState(selectedBranch)
  const [statusFilter, setStatusFilter] = useState('all')

  const rows = useMemo<UnpaidRow[]>(() => {
    const monthly: UnpaidRow[] = monthlyStudents.map((student) => ({
      key: `monthly-${student.id}`,
      studentId: student.id,
      studentName: student.name,
      beltLevel: student.beltLevel,
      branchName: student.branchName,
      guardianEmail: student.guardianEmail,
      billingPlan: 'Monthly',
      amount: student.existingUnpaid?.amount ?? monthlyFee ?? 0,
      dueDate: student.existingUnpaid?.dueDate ?? null,
      isActive: true,
      monthlyStudent: student,
      sessionCharges: [],
      reminders: student.existingUnpaid?.reminders ?? [],
    }))
    const byStudent = new Map<number, PaymentRecord[]>()
    for (const charge of sessionPayments) {
      if (charge.studentId === null) continue
      byStudent.set(charge.studentId, [...(byStudent.get(charge.studentId) ?? []), charge])
    }
    const sessions: UnpaidRow[] = [...byStudent.entries()].map(([studentId, charges]) => {
      const first = charges[0]
      const dueDate = charges.reduce((earliest, charge) => charge.dueDate < earliest ? charge.dueDate : earliest, first.dueDate)
      return {
        key: `session-${studentId}`,
        studentId,
        studentName: first.studentName,
        beltLevel: first.beltLevel,
        branchName: first.branchName,
        guardianEmail: first.guardianEmail,
        billingPlan: 'Per session',
        amount: charges.reduce((total, charge) => total + charge.amount, 0),
        dueDate,
        isActive: first.isActive,
        sessionCharges: charges,
        reminders: [],
      }
    })
    return [...monthly, ...sessions].sort((a, b) => {
      if (!a.dueDate) return b.dueDate ? 1 : a.studentName.localeCompare(b.studentName)
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate) || a.studentName.localeCompare(b.studentName)
    })
  }, [monthlyStudents, sessionPayments, monthlyFee])

  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visibleRows = rows.filter((row) => {
    if (planFilter !== 'all' && row.billingPlan !== planFilter) return false
    if (branchFilter !== 'all' && row.branchName !== branches.find((branch) => branch.key === branchFilter)?.name) return false
    const days = row.dueDate ? daysUntil(today, row.dueDate) : null
    if (statusFilter === 'overdue' && !(days !== null && days < 0)) return false
    if (statusFilter === 'due-soon' && !(days !== null && days >= 0 && days <= 7)) return false
    if (statusFilter === 'unpaid' && !(days !== null && days > 7)) return false
    if (statusFilter === 'bill-needed' && !(row.billingPlan === 'Monthly' && !row.dueDate)) return false
    if (searchTerms.length === 0) return true
    const searchable = [
      row.studentName, row.branchName, row.billingPlan,
      formatAmount(row.amount), String(row.amount), row.dueDate ? formatDate(row.dueDate) : 'bill needed',
      `${row.sessionCharges.length} sessions`,
    ].join(' ').toLowerCase()
    return searchTerms.every((term) => searchable.includes(term))
  })

  const clearSearch = useCallback(() => setSearch(''), [])

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-100 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="unpaid-student-search" className="sr-only">Search unpaid students</label>
            <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="unpaid-student-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or branch" className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm font-medium text-gray-950 placeholder:font-medium placeholder:text-gray-500 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            {search && <button type="button" aria-label="Clear search" onClick={clearSearch} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100"><X size={15} aria-hidden="true" /></button>}
          </div>
          <label className="sr-only" htmlFor="unpaid-branch-filter">Branch</label>
          <select id="unpaid-branch-filter" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-950">
            <option value="all">All branches</option>
            {branches.filter((branch) => branch.key !== 'all').map((branch) => <option key={branch.key} value={branch.key}>{branch.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="unpaid-plan-filter">Billing plan</label>
          <select id="unpaid-plan-filter" value={planFilter} onChange={(event) => setPlanFilter(event.target.value as typeof planFilter)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-950">
            <option value="all">All billing plans</option>
            <option value="Monthly">Monthly</option>
            <option value="Per session">Per session</option>
          </select>
          <label className="sr-only" htmlFor="unpaid-status-filter">Payment status</label>
          <select id="unpaid-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-950">
            <option value="all">All unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="due-soon">Due soon</option>
            <option value="unpaid">Not due soon</option>
            <option value="bill-needed">Bill needed</option>
          </select>
        </div>
        <p className="text-sm font-medium text-gray-950" aria-live="polite">{visibleRows.length} of {rows.length} students need payment</p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm font-medium text-gray-800">
          {rows.length === 0 ? 'No unpaid students for these billing periods.' : 'No students match these search and filter options.'}
        </div>
      ) : (
        <>
          <div className="hidden xl:block">
            <div className="overflow-x-auto">
              <table aria-label="Unpaid students" className="w-full min-w-[1120px] table-fixed border-collapse bg-white text-left text-sm text-gray-950">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th scope="col" className={`${TH} w-[19%]`}>Student</th>
                    <th scope="col" className={`${TH} w-[14%]`}>Branch</th>
                    <th scope="col" className={`${TH} w-[10%]`}>Billing plan</th>
                    <th scope="col" className={`${TH} w-[12%]`}>Amount due</th>
                    <th scope="col" className={`${TH} w-[14%]`}>Due / sessions</th>
                    <th scope="col" className={`${TH} w-[10%]`}>Status</th>
                    <th scope="col" className={`${TH} w-[13%]`}>Reminder</th>
                    <th scope="col" className={`${TH} w-[8%] text-right`}>Actions</th>
                  </tr>
                </thead>
                <PaginatedTableRows itemLabel="unpaid students" colSpan={8}>
                  {visibleRows.map((row) => {
                    const days = row.dueDate ? daysUntil(today, row.dueDate) : null
                    const status = !row.dueDate ? 'Bill needed' : days! < 0 ? 'Overdue' : days! <= 7 ? 'Due soon' : 'Unpaid'
                    const statusClass = status === 'Overdue' ? 'bg-red-50 text-red-700' : status === 'Due soon' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'
                    return (
                      <tr key={row.key} className="border-b border-gray-100 align-middle transition-colors last:border-b-0 hover:bg-gray-50/60">
                        <td className="break-words px-4 py-5">
                          <span className="text-sm font-medium text-gray-950">{row.studentName}</span>
                        </td>
                        <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{row.branchName}</td>
                        <td className="whitespace-normal px-4 py-5 text-sm font-medium text-gray-950">{row.billingPlan}</td>
                        <td className="px-4 py-5 text-sm font-medium text-gray-950">
                          {row.billingPlan === 'Monthly' && !row.monthlyStudent?.existingUnpaid && monthlyFee === null ? 'Fee not set' : formatPeso(row.amount)}
                        </td>
                        <td className="px-4 py-5 text-sm font-medium text-gray-950">
                          {row.billingPlan === 'Per session' ? (
                            <><span className="block">{row.sessionCharges.length} unpaid session{row.sessionCharges.length === 1 ? '' : 's'}</span><span className="mt-0.5 block text-xs font-normal text-gray-700">Oldest: {row.dueDate ? formatDate(row.dueDate) : '—'}</span></>
                          ) : row.dueDate ? formatDate(row.dueDate) : <span className="font-normal text-gray-700">Bill not created</span>}
                        </td>
                        <td className="px-4 py-5"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{status}</span></td>
                        <td className={`break-words px-4 py-5 text-sm font-medium ${row.billingPlan === 'Monthly' && latestReminder(row.reminders)?.status === 'Failed' ? 'text-red-700' : 'text-gray-950'}`}>{reminderLabel(row)}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex w-full justify-end">
                            <RowActions row={row} studentChoices={studentChoices} month={month} today={today} monthlyFee={monthlyFee} perSessionFee={perSessionFee} reminderSchedule={reminderSchedule} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </PaginatedTableRows>
              </table>
            </div>
          </div>
          <div className="divide-y divide-gray-100 xl:hidden">
            <PaginatedListItems itemLabel="unpaid students">
              {visibleRows.map((row) => {
                const days = row.dueDate ? daysUntil(today, row.dueDate) : null
                const status = !row.dueDate ? 'Bill needed' : days! < 0 ? 'Overdue' : days! <= 7 ? 'Due soon' : 'Unpaid'
                const statusClass = status === 'Overdue' ? 'bg-red-50 text-red-700' : status === 'Due soon' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'
                return (
                  <article key={row.key} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium text-gray-950">{row.studentName}</h3>
                        <p className="mt-1 text-xs font-medium text-gray-700">{row.branchName}</p>
                      </div>
                      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{status}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Billing plan</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.billingPlan}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount due</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.billingPlan === 'Monthly' && !row.monthlyStudent?.existingUnpaid && monthlyFee === null ? 'Fee not set' : formatPeso(row.amount)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Due / sessions</dt><dd className="mt-1 text-sm font-medium text-gray-950">{row.billingPlan === 'Per session' ? `${row.sessionCharges.length} unpaid session${row.sessionCharges.length === 1 ? '' : 's'} · Oldest: ${row.dueDate ? formatDate(row.dueDate) : '—'}` : row.dueDate ? formatDate(row.dueDate) : 'Bill not created'}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reminder</dt><dd className={`mt-1 text-sm font-medium ${row.billingPlan === 'Monthly' && latestReminder(row.reminders)?.status === 'Failed' ? 'text-red-700' : 'text-gray-950'}`}>{reminderLabel(row)}</dd></div>
                    </dl>
                    <div className="mt-3 flex justify-end border-t border-gray-100 pt-2">
                      <RowActions row={row} studentChoices={studentChoices} month={month} today={today} monthlyFee={monthlyFee} perSessionFee={perSessionFee} reminderSchedule={reminderSchedule} />
                    </div>
                  </article>
                )
              })}
            </PaginatedListItems>
          </div>
        </>
      )}
    </div>
  )
}
