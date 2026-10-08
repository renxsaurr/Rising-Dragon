import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { DEFAULT_REMINDER_SCHEDULE, type ReminderSchedule } from '@/utils/reminder-timing'

/** Loads the academy's reminder offsets; defaults preserve the original 3-days-before/on/3-days-after schedule. */
export async function loadReminderSchedule(): Promise<ReminderSchedule> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payment_settings')
    .select('reminder_before_due_days, reminder_after_due_days')
    .eq('singleton', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    beforeDueDays: Number(data?.reminder_before_due_days ?? DEFAULT_REMINDER_SCHEDULE.beforeDueDays),
    afterDueDays: Number(data?.reminder_after_due_days ?? DEFAULT_REMINDER_SCHEDULE.afterDueDays),
  }
}
