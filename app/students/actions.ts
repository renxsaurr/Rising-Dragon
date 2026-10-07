'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { isValidEmail, normalizeEmail } from '@/utils/email'

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

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export async function saveStudent(studentId: number | null, input: StudentFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage student records.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can add or edit student profiles.' }
  if (!input || typeof input !== 'object') return { error: 'Student details are invalid.' }

  const payload: StudentFormData = {
    first_name: typeof input.first_name === 'string' ? input.first_name.trim() : '',
    middle_name: typeof input.middle_name === 'string' ? input.middle_name.trim() || null : null,
    last_name: typeof input.last_name === 'string' ? input.last_name.trim() : '',
    guardian_name: typeof input.guardian_name === 'string' ? input.guardian_name.trim() : '',
    guardian_contact: typeof input.guardian_contact === 'string' ? input.guardian_contact.trim() || null : null,
    guardian_email: normalizeEmail(input.guardian_email),
    belt_level: typeof input.belt_level === 'string' ? input.belt_level : '',
    enrollment_date: typeof input.enrollment_date === 'string' ? input.enrollment_date : '',
    branch_id: Number(input.branch_id),
  }

  if (!payload.first_name || !payload.last_name || !payload.guardian_name) {
    return { error: 'Student and guardian names are required.' }
  }
  if ([payload.first_name, payload.middle_name, payload.last_name, payload.guardian_name].some((value) => value && value.length > 100)) {
    return { error: 'Names must be 100 characters or fewer.' }
  }
  if (!isValidEmail(payload.guardian_email)) {
    return { error: 'Enter a valid guardian email address.' }
  }
  if (payload.guardian_email.length > 254) return { error: 'Guardian email must be 254 characters or fewer.' }
  if (!ALLOWED_BELTS.has(payload.belt_level)) return { error: 'Select a valid belt level.' }
  if (!Number.isSafeInteger(payload.branch_id) || payload.branch_id <= 0 || !isValidDate(payload.enrollment_date)) {
    return { error: 'Select a branch and enrollment date.' }
  }
  if (studentId !== null && (!Number.isSafeInteger(studentId) || studentId <= 0)) {
    return { error: 'Student record not found.' }
  }

  const admin = createAdminClient()

  const { data: branch, error: branchError } = await admin
    .from('branch')
    .select('id')
    .eq('id', payload.branch_id)
    .eq('is_active', true)
    .maybeSingle()
  if (branchError || !branch) return { error: 'Select an active branch.' }

  if (studentId !== null) {
    const { data: existingStudent, error: existingError } = await admin
      .from('student')
      .select('id, branch_id, is_active')
      .eq('id', studentId)
      .maybeSingle()

    if (existingError || !existingStudent) return { error: 'Student record not found.' }
    if (!existingStudent.is_active) return { error: 'Restore this student before editing their record.' }

    const { error } = await admin.from('student').update(payload).eq('id', studentId)
    if (error) return { error: error.message }
    return { success: true }
  }

  const { error } = await admin.from('student').insert(payload)
  if (error) return { error: error.message }
  return { success: true }
}

export async function setStudentActive(studentId: number, isActive: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage student records.' }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can archive or restore students.' }
  if (!Number.isSafeInteger(studentId) || studentId <= 0) return { error: 'Student record not found.' }
  if (typeof isActive !== 'boolean') return { error: 'Student status is invalid.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('student')
    .update({ is_active: isActive })
    .eq('id', studentId)
    .eq('is_active', !isActive)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Student was not found or already has that status.' }

  revalidatePath('/students')
  revalidatePath('/attendance')
  revalidatePath('/dashboard')
  revalidatePath('/branches')
  revalidatePath('/branches/[id]', 'page')
  return { success: true }
}
