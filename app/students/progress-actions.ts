'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { dateInTimeZone } from '@/utils/dates'

export type StudentProgressInput = {
  assessedOn: string
  focusArea: string
  progressLevel: string
  assessmentReadiness: string
  observation: string
  nextSteps: string
}

const FOCUS_AREAS = new Set(['technique', 'forms', 'sparring', 'conditioning', 'discipline'])
const PROGRESS_LEVELS = new Set(['needs_practice', 'developing', 'consistent'])
const READINESS = new Set(['not_assessed', 'not_ready', 'ready_for_assessment'])

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function recordStudentProgress(studentId: number, input: StudentProgressInput) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Please sign in to record student progress.' }
  if (!['head_coach', 'assistant_coach'].includes(user.role)) return { error: 'You cannot record student progress.' }
  if (!Number.isSafeInteger(studentId) || studentId <= 0 || !input || typeof input !== 'object') {
    return { error: 'Student progress details are invalid.' }
  }

  const assessedOn = typeof input.assessedOn === 'string' ? input.assessedOn : ''
  const focusArea = typeof input.focusArea === 'string' ? input.focusArea : ''
  const progressLevel = typeof input.progressLevel === 'string' ? input.progressLevel : ''
  const assessmentReadiness = typeof input.assessmentReadiness === 'string' ? input.assessmentReadiness : ''
  const observation = typeof input.observation === 'string' ? input.observation.trim() : ''
  const nextSteps = typeof input.nextSteps === 'string' ? input.nextSteps.trim() : ''
  const today = dateInTimeZone()

  if (!validDate(assessedOn) || assessedOn > today) return { error: 'Choose a valid date that is not in the future.' }
  if (!FOCUS_AREAS.has(focusArea) || !PROGRESS_LEVELS.has(progressLevel) || !READINESS.has(assessmentReadiness)) {
    return { error: 'Choose valid progress values.' }
  }
  if (!observation || observation.length > 1000 || nextSteps.length > 500) {
    return { error: 'Add an observation (up to 1,000 characters) and keep next steps under 500 characters.' }
  }

  const admin = createAdminClient()
  const { data: student, error: studentError } = await admin.from('student')
    .select('id, branch_id, enrollment_date, is_active')
    .eq('id', studentId)
    .maybeSingle()
  if (studentError || !student) return { error: 'Student record not found.' }
  if (!student.is_active) return { error: 'Progress can only be recorded for an active student.' }
  if (assessedOn < student.enrollment_date) return { error: 'The assessment date cannot be before the student enrolled.' }

  if (user.role === 'assistant_coach') {
    let assignedBranchIds: number[]
    try {
      assignedBranchIds = await getCoachBranchIdsForDate(user.id, assessedOn)
    } catch {
      return { error: 'Could not verify your class assignment. Please try again.' }
    }
    if (!assignedBranchIds.includes(Number(student.branch_id))) {
      return { error: 'You can record progress only for a student at a branch where you were assigned to teach on that date.' }
    }
  }

  const { error } = await admin.from('student_progress').insert({
    student_id: studentId,
    branch_id: student.branch_id,
    coach_id: user.id,
    assessed_on: assessedOn,
    focus_area: focusArea,
    progress_level: progressLevel,
    assessment_readiness: assessmentReadiness,
    observation,
    next_steps: nextSteps || null,
  })
  if (error) return { error: 'Progress could not be saved. Please try again.' }

  revalidatePath(`/students/${studentId}/progress`)
  revalidatePath('/branches')
  revalidatePath('/branches/[id]', 'page')
  return { success: true }
}
