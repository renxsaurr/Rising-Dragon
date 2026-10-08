import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { addDays } from '@/utils/dates'
import { TRACKING_START_MONTH } from '@/utils/academy-settings'
import { normalizeEmail } from '@/utils/email'
import { fetchAllRows } from '@/utils/fetch-all-rows'
import { MAX_MONTHS, coveredMonths, type MonthlyCoverage, type PaymentType } from '@/utils/payment-fees'
import type { ReminderStatus, ReminderType } from '@/utils/payment-reminders'

type Admin = ReturnType<typeof createAdminClient>

// .in() lists go into the request URL, so reminders are loaded 200 payments at a time.
const REMINDER_CHUNK_SIZE = 200
// "Due soon" = due today or within the next 7 days.
const DUE_SOON_DAYS = 7

export type PaymentKind = 'paid' | 'overdue' | 'soon' | 'unpaid'
export type PaymentStatus = 'Paid' | 'Unpaid'

export type ReminderSummary = {
  reminderType: ReminderType
  status: ReminderStatus
  sentAt: string | null
}

export type PaymentRecord = {
  id: number
  studentId: number | null
  studentName: string
  beltLevel: string
  branchId: number | null
  branchName: string
  /** Already trimmed and lowercased. '' when missing. */
  guardianEmail: string
  isActive: boolean
  amount: number
  dueDate: string
  /** Negative when overdue. */
  daysUntilDue: number
  paidDate: string | null
  method: string | null
  status: PaymentStatus
  kind: PaymentKind
  /** These four are null for older records saved before payment details existed. */
  paymentType: PaymentType | null
  quantity: number | null
  coverageStart: string | null
  enrollmentDate: string | null
  notes: string | null
  reminders: ReminderSummary[]
}

export type BranchPaymentStats = {
  /** 'all' or the branch id: the same value as ?branch= */
  key: string
  name: string
  expected: number
  collected: number
  paidCount: number
  /** Every Unpaid payment, overdue ones included. */
  unpaidCount: number
  overdueCount: number
}

export type OlderOverdue = {
  count: number
  total: number
  /** 'YYYY-MM' of the earliest due date in the group, null when count is 0. */
  oldestMonth: string | null
}

export type ActiveStudent = {
  id: number
  name: string
  branchId: number | null
  beltLevel: string
  enrollmentDate: string | null
  /** Trimmed and lowercased. '' when missing. */
  guardianEmail: string
}

/** This month's Unpaid bill for a student. Reminders go out for it instead of a new bill. */
export type ExistingBill = {
  id: number
  dueDate: string
  amount: number
  reminders: ReminderSummary[]
}

export type NotPaidStudent = {
  id: number
  name: string
  beltLevel: string
  branchName: string
  enrollmentDate: string | null
  guardianEmail: string
  existingUnpaid: ExistingBill | null
}

export type NotPaidGroup = {
  /** Active students enrolled on or before the month's last day. */
  activeCount: number
  notPaidCount: number
  /** Sorted by last name, then first name. */
  students: NotPaidStudent[]
}

export type MissedStudent = {
  studentId: number
  name: string
  /** belt_level as stored, e.g. 'low_yellow'. */
  belt: string
  branchName: string
  /** 'YYYY-MM' months with no Paid record, oldest first. */
  months: string[]
}

export type PaymentMonth = {
  rows: PaymentRecord[]
  /** "All branches" first, then every branch by name, even branches with no payments. */
  branches: BranchPaymentStats[]
  /** Keyed like branches: 'all' and each branch id. */
  olderOverdue: Record<string, OlderOverdue>
  /** Active students, for the Add payment form. */
  activeStudents: ActiveStudent[]
  /** Keyed like branches: 'all' and each branch id. */
  notPaid: Record<string, NotPaidGroup>
  /** Past months with no payment, keyed like branches. Most missed months first, then by last name. */
  missedMonths: Record<string, MissedStudent[]>
  /** First month the missed-months check looked at, or null when there were no past months to check. */
  missedSince: string | null
}

export type PaymentMonthResult = { data: PaymentMonth; error: null } | { data: null; error: string }

type RawStudent = {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  belt_level: string | null
  branch_id: number | null
  guardian_email: string | null
  is_active: boolean
  enrollment_date: string | null
}

type RawPayment = {
  id: number
  amount: number | string
  due_date: string
  paid_date: string | null
  method: string | null
  status: PaymentStatus
  payment_type: PaymentType | null
  quantity: number | null
  coverage_start: string | null
  notes: string | null
  student: RawStudent | RawStudent[] | null
}

type RawReminder = {
  payment_id: number
  reminder_type: ReminderType
  status: ReminderStatus
  sent_at: string | null
}

type RawOlderPayment = {
  amount: number | string
  due_date: string
  student: { branch_id: number | null } | { branch_id: number | null }[] | null
}

// payment has only one link to student, so no foreign key hint is needed.
const PAYMENT_SELECT =
  'id, amount, due_date, paid_date, method, status, payment_type, quantity, coverage_start, notes, student:student(id, first_name, middle_name, last_name, belt_level, branch_id, guardian_email, is_active, enrollment_date)'

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null))

/** True for 'YYYY-MM' with a real month number (years 1900–2099). */
export const isMonthKey = (value: unknown): value is string =>
  typeof value === 'string' && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(value)

/** Move a 'YYYY-MM' month forward (+1) or back (-1). */
export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** '2026-10' → "October 2026" */
export const formatMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

const fullName = (student: Pick<RawStudent, 'first_name' | 'middle_name' | 'last_name'> | null) =>
  student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') : 'Unknown student'

function paymentKind(status: PaymentStatus, daysUntilDue: number): PaymentKind {
  if (status === 'Paid') return 'paid'
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= DUE_SOON_DAYS) return 'soon'
  return 'unpaid'
}

// numeric amounts can add up to 0.30000000000000004, so round the totals to centavos
const roundMoney = (value: number) => Math.round(value * 100) / 100

const emptyStats = (key: string, name: string): BranchPaymentStats => ({
  key, name, expected: 0, collected: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0,
})

const emptyOlderOverdue = (): OlderOverdue => ({ count: 0, total: 0, oldestMonth: null })

type RawActiveStudent = {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  branch_id: number | null
  belt_level: string | null
  enrollment_date: string | null
  guardian_email: string | null
}

type RawNearbyMonthly = {
  id: number
  student_id: number
  coverage_start: string
  quantity: number
  status: PaymentStatus
  due_date: string
  amount: number | string
}

const emptyNotPaid = (): NotPaidGroup => ({ activeCount: 0, notPaidCount: 0, students: [] })

// '2026-10' → '2026-10-31'
const monthEnd = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1)

/** Every 'YYYY-MM' from first to last, both included. Empty when first is after last. */
function monthsFrom(first: string, last: string) {
  const months: string[] = []
  for (let month = first; month <= last; month = shiftMonth(month, 1)) months.push(month)
  return months
}

const laterMonth = (a: string, b: string) => (a > b ? a : b)
const earlierMonth = (a: string, b: string) => (a < b ? a : b)

type PaidDue = { studentId: number; dueDate: string }
type PaidCoverage = { studentId: number; coverageStart: string; quantity: number; enrollmentDate: string | null }

/**
 * The one "paid for the month" rule, used by "Not paid yet" and by the missed-months box:
 * a Paid Monthly payment whose months include the month, or any Paid payment due inside it
 * (Per session and older records). Unpaid records never count.
 * Returns month → ids of the students who paid for it, for the given months only.
 */
function paidStudentsByMonth(months: string[], paidDue: PaidDue[], paidCoverage: PaidCoverage[]) {
  const paid = new Map(months.map((month) => [month, new Set<number>()]))
  for (const payment of paidDue) paid.get(payment.dueDate.slice(0, 7))?.add(payment.studentId)
  for (const payment of paidCoverage) {
    for (const month of coveredMonths(payment.coverageStart, payment.quantity, payment.enrollmentDate ?? payment.coverageStart)) paid.get(month)?.add(payment.studentId)
  }
  return paid
}

async function loadReminders(admin: Admin, paymentIds: number[]) {
  const chunks: number[][] = []
  for (let index = 0; index < paymentIds.length; index += REMINDER_CHUNK_SIZE) {
    chunks.push(paymentIds.slice(index, index + REMINDER_CHUNK_SIZE))
  }
  const pages = await Promise.all(chunks.map((chunk) =>
    fetchAllRows<RawReminder>((from, to) => admin.from('payment_reminder')
      .select('payment_id, reminder_type, status, sent_at')
      .in('payment_id', chunk)
      .order('id')
      .range(from, to)),
  ))

  const byPayment = new Map<number, ReminderSummary[]>()
  for (const reminder of pages.flat()) {
    const paymentId = Number(reminder.payment_id)
    byPayment.set(paymentId, [
      ...(byPayment.get(paymentId) ?? []),
      { reminderType: reminder.reminder_type, status: reminder.status, sentAt: reminder.sent_at },
    ])
  }
  return byPayment
}

/** Every payment due in the month, with its reminders, the branch totals and older overdue payments. */
export async function loadPaymentMonth(admin: Admin, month: string, today: string): Promise<PaymentMonthResult> {
  if (!isMonthKey(month)) return { data: null, error: 'The month is invalid.' }
  const start = `${month}-01`
  const end = addDays(`${shiftMonth(month, 1)}-01`, -1)
  // Earlier unpaid payments that are already past due. When a future month is shown,
  // payments between today and that month are not overdue yet, so stop at today.
  const olderBefore = start < today ? start : today
  // Missed months depend on today, not on the shown month, so the box is the same on every page:
  // from the later of TRACKING_START_MONTH and 12 months before today's month, up to the month
  // before today's month. The current and future months are never checked.
  const todayMonth = today.slice(0, 7)
  const missedFirst = TRACKING_START_MONTH
    ? laterMonth(TRACKING_START_MONTH, shiftMonth(todayMonth, -12))
    : shiftMonth(todayMonth, -12)
  const missedMonthKeys = monthsFrom(missedFirst, shiftMonth(todayMonth, -1))
  const missedLast = missedMonthKeys.at(-1)
  // One Monthly query for the shown month and the whole missed range. A payment covers at most
  // MAX_MONTHS months, so anything starting earlier than that can't reach the first month.
  const coverageFrom = shiftMonth(missedMonthKeys.length ? earlierMonth(missedMonthKeys[0], month) : month, -(MAX_MONTHS - 1))
  const coverageTo = missedLast && monthEnd(missedLast) > end ? monthEnd(missedLast) : end

  try {
    const [branchResult, payments, olderOverdue, students, nearbyMonthly, paidInRange] = await Promise.all([
      admin.from('branch').select('id, name').order('name'),
      fetchAllRows<RawPayment>((from, to) => admin.from('payment')
        .select(PAYMENT_SELECT)
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date')
        .order('id')
        .range(from, to)),
      fetchAllRows<RawOlderPayment>((from, to) => admin.from('payment')
        .select('amount, due_date, student:student(branch_id)')
        .eq('status', 'Unpaid')
        .lt('due_date', olderBefore)
        .order('id')
        .range(from, to)),
      fetchAllRows<RawActiveStudent>((from, to) => admin.from('student')
        .select('id, first_name, middle_name, last_name, branch_id, belt_level, enrollment_date, guardian_email')
        .eq('is_active', true)
        .order('last_name')
        .order('first_name')
        .order('id')
        .range(from, to)),
      // Monthly payments (Paid or Unpaid) that could cover the shown month or a missed month.
      fetchAllRows<RawNearbyMonthly>((from, to) => admin.from('payment')
        .select('id, student_id, coverage_start, quantity, status, due_date, amount')
        .eq('payment_type', 'Monthly')
        .gte('coverage_start', `${coverageFrom}-01`)
        .lte('coverage_start', coverageTo)
        .order('id')
        .range(from, to)),
      // Paid payments due anywhere in the missed range (one query, not one per month).
      missedLast
        ? fetchAllRows<{ student_id: number; due_date: string }>((from, to) => admin.from('payment')
            .select('student_id, due_date')
            .eq('status', 'Paid')
            .gte('due_date', `${missedMonthKeys[0]}-01`)
            .lte('due_date', monthEnd(missedLast))
            .order('id')
            .range(from, to))
        : Promise.resolve([]),
    ])
    if (branchResult.error) throw new Error(branchResult.error.message)

    const branchList = (branchResult.data ?? []) as { id: number; name: string }[]
    const branchNames = new Map(branchList.map((branch) => [Number(branch.id), branch.name]))
    const reminders = await loadReminders(admin, payments.map((payment) => Number(payment.id)))

    const rows = payments.map((payment): PaymentRecord => {
      const student = one(payment.student)
      const branchId = student?.branch_id == null ? null : Number(student.branch_id)
      const daysUntilDue = daysBetween(today, payment.due_date)
      return {
        id: Number(payment.id),
        studentId: student ? Number(student.id) : null,
        studentName: fullName(student),
        beltLevel: student?.belt_level ?? '',
        branchId,
        branchName: (branchId !== null && branchNames.get(branchId)) || 'No branch',
        guardianEmail: normalizeEmail(student?.guardian_email),
        isActive: student?.is_active ?? false,
        amount: Number(payment.amount),
        dueDate: payment.due_date,
        daysUntilDue,
        paidDate: payment.paid_date,
        method: payment.method?.trim() || null,
        status: payment.status,
        kind: paymentKind(payment.status, daysUntilDue),
        paymentType: payment.payment_type,
        quantity: payment.quantity == null ? null : Number(payment.quantity),
        coverageStart: payment.coverage_start,
        enrollmentDate: student?.enrollment_date ?? null,
        notes: payment.notes?.trim() || null,
        reminders: reminders.get(Number(payment.id)) ?? [],
      }
    })

    const all = emptyStats('all', 'All branches')
    const byBranch = new Map(branchList.map((branch) => [Number(branch.id), emptyStats(String(branch.id), branch.name)]))
    for (const row of rows) {
      const branchStats = row.branchId === null ? undefined : byBranch.get(row.branchId)
      for (const stats of branchStats ? [all, branchStats] : [all]) {
        stats.expected += row.amount
        if (row.status === 'Paid') {
          stats.collected += row.amount
          stats.paidCount += 1
        } else {
          stats.unpaidCount += 1
          if (row.kind === 'overdue') stats.overdueCount += 1
        }
      }
    }

    // Same grouping as the cards: every payment counts in "all", and in its branch when it has one.
    const olderByBranch: Record<string, OlderOverdue> = { all: emptyOlderOverdue() }
    for (const branch of branchList) olderByBranch[String(branch.id)] = emptyOlderOverdue()
    for (const payment of olderOverdue) {
      const branchId = one(payment.student)?.branch_id
      const branchGroup = branchId == null ? undefined : olderByBranch[String(branchId)]
      const paymentMonth = payment.due_date.slice(0, 7)
      for (const group of branchGroup ? [olderByBranch.all, branchGroup] : [olderByBranch.all]) {
        group.count += 1
        group.total += Number(payment.amount)
        if (!group.oldestMonth || paymentMonth < group.oldestMonth) group.oldestMonth = paymentMonth
      }
    }
    for (const group of Object.values(olderByBranch)) group.total = roundMoney(group.total)

    const activeStudents = students.map((student): ActiveStudent => ({
      id: Number(student.id),
      name: fullName(student),
      branchId: student.branch_id == null ? null : Number(student.branch_id),
      beltLevel: student.belt_level ?? '',
      enrollmentDate: student.enrollment_date,
      guardianEmail: normalizeEmail(student.guardian_email),
    }))

    const paidCoverage: PaidCoverage[] = nearbyMonthly
      .filter((payment) => payment.status === 'Paid')
      .map((payment) => ({
        studentId: Number(payment.student_id),
        coverageStart: payment.coverage_start,
        quantity: Number(payment.quantity),
        enrollmentDate: students.find((student) => Number(student.id) === Number(payment.student_id))?.enrollment_date ?? null,
      }))
    const paidThisMonth: PaidDue[] = rows
      .filter((row) => row.status === 'Paid' && row.studentId !== null)
      .map((row) => ({ studentId: row.studentId as number, dueDate: row.dueDate }))
    const paidStudentIds = paidStudentsByMonth([month], paidThisMonth, paidCoverage).get(month) ?? new Set<number>()

    // The same two rules with Unpaid give the student's existing bill for this month.
    const unpaidBills = new Map<number, { id: number; dueDate: string; amount: number }>()
    const keepEarliest = (studentId: number, bill: { id: number; dueDate: string; amount: number }) => {
      const current = unpaidBills.get(studentId)
      if (!current || bill.dueDate < current.dueDate) unpaidBills.set(studentId, bill)
    }
    for (const row of rows) {
      if (row.studentId !== null && row.status === 'Unpaid') {
        keepEarliest(row.studentId, { id: row.id, dueDate: row.dueDate, amount: row.amount })
      }
    }
    for (const payment of nearbyMonthly) {
      if (payment.status !== 'Unpaid') continue
      const enrollmentDate = students.find((student) => Number(student.id) === Number(payment.student_id))?.enrollment_date ?? payment.coverage_start
      if (!coveredMonths(payment.coverage_start, Number(payment.quantity), enrollmentDate).includes(month)) continue
      keepEarliest(Number(payment.student_id), { id: Number(payment.id), dueDate: payment.due_date, amount: Number(payment.amount) })
    }

    // Reminders for bills that aren't in this month's rows (a Monthly bill due in an earlier month).
    const rowReminders = new Map(rows.map((row) => [row.id, row.reminders]))
    const missingIds = [...unpaidBills.entries()]
      .filter(([studentId, bill]) => !paidStudentIds.has(studentId) && !rowReminders.has(bill.id))
      .map(([, bill]) => bill.id)
    const extraReminders = missingIds.length ? await loadReminders(admin, missingIds) : new Map<number, ReminderSummary[]>()
    const existingBill = (studentId: number): ExistingBill | null => {
      const bill = unpaidBills.get(studentId)
      if (!bill) return null
      return { ...bill, reminders: rowReminders.get(bill.id) ?? extraReminders.get(bill.id) ?? [] }
    }

    // Same grouping as the cards. Students enrolled after the month ends don't count yet.
    const notPaid: Record<string, NotPaidGroup> = { all: emptyNotPaid() }
    for (const branch of branchList) notPaid[String(branch.id)] = emptyNotPaid()
    for (const student of activeStudents) {
      if (student.enrollmentDate && student.enrollmentDate > end) continue
      const branchGroup = student.branchId === null ? undefined : notPaid[String(student.branchId)]
      const paid = paidStudentIds.has(student.id)
      for (const group of branchGroup ? [notPaid.all, branchGroup] : [notPaid.all]) {
        group.activeCount += 1
        if (paid) continue
        group.notPaidCount += 1
        group.students.push({
          id: student.id,
          name: student.name,
          beltLevel: student.beltLevel,
          branchName: (student.branchId !== null && branchNames.get(student.branchId)) || 'No branch',
          enrollmentDate: student.enrollmentDate,
          guardianEmail: student.guardianEmail,
          existingUnpaid: existingBill(student.id),
        })
      }
    }

    // A missed month = the student is active now, was enrolled by that month's last day,
    // and has no Paid record for it under the same rule.
    const paidByMonth = paidStudentsByMonth(
      missedMonthKeys,
      paidInRange.map((payment) => ({ studentId: Number(payment.student_id), dueDate: payment.due_date })),
      paidCoverage,
    )
    const missedMonths: Record<string, MissedStudent[]> = { all: [] }
    for (const branch of branchList) missedMonths[String(branch.id)] = []
    for (const student of activeStudents) {
      const months = missedMonthKeys.filter(
        (key) =>
          (!student.enrollmentDate || student.enrollmentDate <= monthEnd(key)) &&
          !paidByMonth.get(key)?.has(student.id),
      )
      if (months.length === 0) continue
      const missed: MissedStudent = {
        studentId: student.id,
        name: student.name,
        belt: student.beltLevel,
        branchName: (student.branchId !== null && branchNames.get(student.branchId)) || 'No branch',
        months,
      }
      missedMonths.all.push(missed)
      if (student.branchId !== null) missedMonths[String(student.branchId)]?.push(missed)
    }
    // Most missed months first. Ties keep the student order (last name, then first name);
    // Array.sort is stable, so the order from the query stays.
    for (const list of Object.values(missedMonths)) list.sort((a, b) => b.months.length - a.months.length)

    return {
      data: {
        rows,
        branches: [all, ...byBranch.values()].map((stats) => ({
          ...stats,
          expected: roundMoney(stats.expected),
          collected: roundMoney(stats.collected),
        })),
        olderOverdue: olderByBranch,
        activeStudents,
        notPaid,
        missedMonths,
        missedSince: missedMonthKeys[0] ?? null,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Could not load payments.' }
  }
}

export type StudentPayment = {
  id: number
  dueDate: string
  paidDate: string | null
  amount: number
  status: PaymentStatus
  paymentType: PaymentType | null
  quantity: number | null
  coverageStart: string | null
  enrollmentDate: string | null
  method: string | null
}

export type StudentPaymentSummary = {
  guardianName: string | null
  enrollmentDate: string | null
  /** Newest due date first, at most 5. */
  payments: StudentPayment[]
  /** amount ÷ months of the latest Monthly payment, to prefill the Monthly fee. */
  lastMonthlyFee: number | null
  /** Every Monthly payment with details, for the live overlap warning. */
  monthlyCoverage: MonthlyCoverage[]
}

type RawStudentPayment = {
  id: number
  amount: number | string
  due_date: string
  paid_date: string | null
  method: string | null
  status: PaymentStatus
  payment_type: PaymentType | null
  quantity: number | null
  coverage_start: string | null
}

type RawMonthlyCoverage = {
  amount: number | string
  quantity: number | null
  coverage_start: string | null
  status: PaymentStatus
}

/** Every Monthly payment with details for one student, newest due date first. */
export async function loadMonthlyCoverage(
  admin: Admin,
  studentId: number,
): Promise<{ data: MonthlyCoverage[]; error: null } | { data: null; error: string }> {
  const [studentResult, paymentResult] = await Promise.all([
    admin.from('student').select('enrollment_date').eq('id', studentId).maybeSingle(),
    admin.from('payment')
      .select('amount, quantity, coverage_start, status')
      .eq('student_id', studentId)
      .eq('payment_type', 'Monthly')
      .not('coverage_start', 'is', null)
      .order('due_date', { ascending: false })
      .order('id', { ascending: false }),
  ])
  if (studentResult.error) return { data: null, error: studentResult.error.message }
  if (paymentResult.error) return { data: null, error: paymentResult.error.message }
  const enrollmentDate = (studentResult.data?.enrollment_date as string | null) ?? null
  return {
    data: ((paymentResult.data ?? []) as RawMonthlyCoverage[])
      .filter((row) => row.coverage_start && row.quantity)
      .map((row) => ({
        coverageStart: row.coverage_start as string,
        quantity: Number(row.quantity),
        status: row.status,
        amount: Number(row.amount),
        enrollmentDate,
      })),
    error: null,
  }
}

/** Guardian name, last 5 payments and the latest monthly fee, for the Add payment info card. */
export async function loadStudentPaymentSummary(
  admin: Admin,
  studentId: number,
): Promise<{ data: StudentPaymentSummary; error: null } | { data: null; error: string }> {
  const [studentResult, recentResult, coverageResult] = await Promise.all([
    admin.from('student').select('guardian_name, enrollment_date').eq('id', studentId).maybeSingle(),
    admin.from('payment')
      .select('id, amount, due_date, paid_date, method, status, payment_type, quantity, coverage_start')
      .eq('student_id', studentId)
      .order('due_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(5),
    loadMonthlyCoverage(admin, studentId),
  ])
  const error = studentResult.error?.message ?? recentResult.error?.message ?? coverageResult.error
  if (error) return { data: null, error }
  if (!studentResult.data) return { data: null, error: 'Student not found.' }
  const student = studentResult.data

  const monthlyCoverage = coverageResult.data ?? []
  // The list is newest first, so the first one is the latest Monthly payment.
  const latestMonthly = monthlyCoverage[0]
  return {
    data: {
      guardianName: (student.guardian_name as string | null)?.trim() || null,
      enrollmentDate: (student.enrollment_date as string | null) ?? null,
      payments: ((recentResult.data ?? []) as RawStudentPayment[]).map((payment) => ({
        id: Number(payment.id),
        dueDate: payment.due_date,
        paidDate: payment.paid_date,
        amount: Number(payment.amount),
        status: payment.status,
        paymentType: payment.payment_type,
        quantity: payment.quantity == null ? null : Number(payment.quantity),
        coverageStart: payment.coverage_start,
        enrollmentDate: (student.enrollment_date as string | null) ?? null,
        method: payment.method,
      })),
      lastMonthlyFee: latestMonthly ? roundMoney(latestMonthly.amount / latestMonthly.quantity) : null,
      monthlyCoverage,
    },
    error: null,
  }
}
