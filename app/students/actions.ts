'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { dateInTimeZone } from '@/utils/dates'

export type StudentFormData = {
  first_name: string
  middle_name: string | null
  last_name: string
  guardian_name: string
  guardian_contact: string | null
  guardian_email: string
  belt_level: string
  enrollment_date: string
  branch_id: number
}

const ALLOWED_BELTS = new Set([
  'practitioner',
  'white_belt',
  'low_yellow',
  'high_yellow',
  'low_blue',
  'high_blue',
  'low_red',
  'high_red',
  'low_brown',
  'high_brown',
  'first_dan_black_belt',
  'second_dan_black_belt',
  'third_dan_black_belt',
  'fourth_dan_black_belt',
])

export async function saveStudent(studentId: number | null, input: StudentFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage student records.' }

  const payload: StudentFormData = {
    first_name: input.first_name.trim(),
    middle_name: input.middle_name?.trim() || null,
    last_name: input.last_name.trim(),
    guardian_name: input.guardian_name.trim(),
    guardian_contact: input.guardian_contact?.trim() || null,
    guardian_email: input.guardian_email.trim().toLowerCase(),
    belt_level: input.belt_level,
    enrollment_date: input.enrollment_date,
    branch_id: Number(input.branch_id),
  }

  if (!payload.first_name || !payload.last_name || !payload.guardian_name) {
    return { error: 'Student and guardian names are required.' }
  }
  if (!/^\S+@\S+\.\S+$/.test(payload.guardian_email)) {
    return { error: 'Enter a valid guardian email address.' }
  }
  if (!ALLOWED_BELTS.has(payload.belt_level)) return { error: 'Select a valid belt level.' }
  if (!Number.isFinite(payload.branch_id) || !payload.enrollment_date) {
    return { error: 'Select a branch and enrollment date.' }
  }

  let allowedBranchIds: number[] | null = null
  if (currentUser.role === 'assistant_coach') {
    try {
      allowedBranchIds = await getCoachBranchIdsForDate(currentUser.id, dateInTimeZone())
    } catch {
      return { error: 'Unable to verify your class assignment right now.' }
    }
    if (!allowedBranchIds.includes(payload.branch_id)) {
      return { error: 'You can only add or edit students in a branch where you are scheduled today.' }
    }
  } else if (currentUser.role !== 'head_coach') {
    return { error: 'You do not have permission to manage student records.' }
  }

  const admin = createAdminClient()

  if (studentId !== null) {
    const { data: existingStudent, error: existingError } = await admin
      .from('student')
      .select('id, branch_id')
      .eq('id', studentId)
      .maybeSingle()

    if (existingError || !existingStudent) return { error: 'Student record not found.' }
    if (allowedBranchIds && !allowedBranchIds.includes(Number(existingStudent.branch_id))) {
      return { error: 'You can only edit students in a branch where you are scheduled today.' }
    }

    const { error } = await admin.from('student').update(payload).eq('id', studentId)
    if (error) return { error: error.message }
    return { success: true }
  }

  const { error } = await admin.from('student').insert(payload)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStudent(studentId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage student records.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can remove student records.' }

  const admin = createAdminClient()
  const { error } = await admin.from('student').delete().eq('id', studentId)
  if (error) return { error: error.message }
  return { success: true }
}
