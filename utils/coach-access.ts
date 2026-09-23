import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

export async function getCoachBranchIdsForDate(coachId: number, date: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('class_schedule')
    .select('branch_id')
    .eq('coach_id', coachId)
    .eq('date', date)
    .neq('status', 'Cancelled')

  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((schedule) => Number(schedule.branch_id)))]
}
