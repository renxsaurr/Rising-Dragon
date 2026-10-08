import 'server-only'

import { addDays } from '@/utils/dates'
import { fetchAllRows } from '@/utils/fetch-all-rows'
import { createAdminClient } from '@/utils/supabase/admin'
import { coveredBillingDates, monthlyDueDate, monthlyDueOffset } from '@/utils/billing-cycle'

type Student = { id: number; enrollment_date: string | null; billing_plan: string | null }
type MonthlyPayment = {
  id: number
  student_id: number
  amount: number | string
  due_date: string
  status: 'Paid' | 'Unpaid'
  quantity: number | null
  coverage_start: string | null
}

export type MonthlyBillJobResult = { created: number; skipped: number; error?: string }

/** Create unpaid monthly bills up to 35 days ahead for students with an existing monthly plan. */
export async function ensureUpcomingMonthlyBills(today: string): Promise<MonthlyBillJobResult> {
  const admin = createAdminClient()
  try {
    const [studentResult, paymentRows, settingsResult] = await Promise.all([
      fetchAllRows<Student>((from, to) => admin.from('student')
        .select('id, enrollment_date, billing_plan')
        .eq('is_active', true)
        .eq('billing_plan', 'Monthly')
        .not('enrollment_date', 'is', null)
        .order('id')
        .range(from, to)),
      fetchAllRows<MonthlyPayment>((from, to) => admin.from('payment')
        .select('id, student_id, amount, due_date, status, quantity, coverage_start')
        .eq('payment_type', 'Monthly')
        .not('coverage_start', 'is', null)
        .order('due_date')
        .order('id')
        .range(from, to)),
      admin.from('payment_settings')
        .select('monthly_fee')
        .eq('singleton', true)
        .maybeSingle(),
    ])
    if (settingsResult.error) return { created: 0, skipped: 0, error: settingsResult.error.message }
    const monthlyFee = settingsResult.data?.monthly_fee == null ? null : Number(settingsResult.data.monthly_fee)
    if (!monthlyFee || !Number.isFinite(monthlyFee) || monthlyFee <= 0) return { created: 0, skipped: 0 }
    const students = new Map(studentResult.map((student) => [Number(student.id), student]))
    const byStudent = new Map<number, MonthlyPayment[]>()
    for (const row of paymentRows) {
      const id = Number(row.student_id)
      if (!students.has(id)) continue
      byStudent.set(id, [...(byStudent.get(id) ?? []), row])
    }

    let created = 0
    let skipped = 0
    const latestBillDate = addDays(today, 35)
    for (const [studentId, rows] of byStudent) {
      const student = students.get(studentId)!
      const anchor = student.enrollment_date
      if (!anchor || !rows.length) continue
      const existingDates = new Set<string>()
      let nextOffset = 0
      for (const row of rows) {
        const quantity = Number(row.quantity ?? 0)
        if (!row.coverage_start || !quantity) continue
        const firstOffset = monthlyDueOffset(anchor, row.coverage_start)
        if (firstOffset === null) continue
        for (const dueDate of coveredBillingDates(row.coverage_start, quantity, anchor)) existingDates.add(dueDate)
        nextOffset = Math.max(nextOffset, firstOffset + quantity)
      }
      if (!rows.length) continue

      let dueDate = monthlyDueDate(anchor, nextOffset)
      while (dueDate && dueDate <= latestBillDate) {
        if (dueDate < today || existingDates.has(dueDate)) {
          nextOffset += 1
          dueDate = monthlyDueDate(anchor, nextOffset)
          continue
        }
        const { error } = await admin.from('payment').insert({
          student_id: studentId,
          amount: Math.round(monthlyFee * 100) / 100,
          status: 'Unpaid',
          due_date: dueDate,
          paid_date: null,
          method: null,
          payment_type: 'Monthly',
          quantity: 1,
          coverage_start: dueDate,
          notes: null,
        })
        if (error?.code === '23505') {
          skipped += 1
          existingDates.add(dueDate)
        } else if (error) {
          return { created, skipped, error: error.message }
        } else {
          created += 1
          existingDates.add(dueDate)
        }
        nextOffset += 1
        dueDate = monthlyDueDate(anchor, nextOffset)
      }
    }
    return { created, skipped }
  } catch (error) {
    return { created: 0, skipped: 0, error: error instanceof Error ? error.message : 'Could not create monthly bills.' }
  }
}
