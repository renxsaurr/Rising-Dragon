'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone, timeInTimeZone } from '@/utils/dates'

export async function saveAttendance(scheduleId: number, records: { student_id: number; status: 'Present' | 'Absent' }[]) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to record attendance.' }
  if (!['head_coach', 'assistant_coach'].includes(currentUser.role)) return { error: 'You do not have permission to record attendance.' }
  if (!Number.isInteger(scheduleId) || !Array.isArray(records) || records.length === 0) return { error: 'Select a class and at least one student.' }
  if (records.length > 200) return { error: 'Save attendance in groups of 200 students or fewer.' }
  if (records.some((record) => !record || !Number.isInteger(record.student_id) || !['Present', 'Absent'].includes(record.status))) {
    return { error: 'Attendance values are invalid.' }
  }

  const admin = createAdminClient()
  const { data: schedule, error: scheduleError } = await admin.from('class_schedule')
    .select('id, date, branch_id, coach_id, status')
    .eq('id', scheduleId)
    .maybeSingle()
  if (scheduleError || !schedule) return { error: 'Class session not found.' }
  if (schedule.status === 'Cancelled') return { error: 'Attendance cannot be recorded for a cancelled class.' }
  if (schedule.status === 'Draft') return { error: 'This class session is still a draft. The Head Coach must publish it before attendance can be recorded.' }
  const today = dateInTimeZone()
  if (schedule.date > today) return { error: 'Attendance can only be recorded for a class that has started.' }
  if (schedule.date === today && schedule.time_start > timeInTimeZone()) {
    return { error: 'Attendance can only be recorded once the class has started.' }
  }
  if (currentUser.role === 'assistant_coach' && Number(schedule.coach_id) !== currentUser.id) {
    return { error: 'You can only mark attendance for your assigned classes.' }
  }

  const studentIds = [...new Set(records.map((record) => record.student_id))]
  if (studentIds.length !== records.length) return { error: 'A student can only be included once per save.' }
  const { data: activeStudents, error: studentsError } = await admin.from('student')
    .select('id')
    .eq('is_active', true)
    .eq('branch_id', schedule.branch_id)
    .lte('enrollment_date', schedule.date)
    .in('id', studentIds)
  if (studentsError) return { error: 'Could not verify the class roster. Please try again.' }
  const { data: existingMarks, error: marksError } = await admin.from('attendance')
    .select('student_id')
    .eq('schedule_id', scheduleId)
    .in('student_id', studentIds)
  if (marksError) return { error: 'Could not verify existing attendance. Please try again.' }
  const allowedStudentIds = new Set([
    ...(activeStudents ?? []).map((student) => Number(student.id)),
    ...(existingMarks ?? []).map((mark) => Number(mark.student_id)),
  ])
  if (studentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    return { error: 'One or more students do not belong to this class roster.' }
  }

  const payload = records.map((record) => ({
    student_id: record.student_id,
    schedule_id: scheduleId,
    date: schedule.date,
    status: record.status,
  }))
  const { error } = await admin.from('attendance').upsert(payload, { onConflict: 'student_id,schedule_id' })
  if (error) return { error: 'Attendance could not be saved. Please try again.' }

  revalidatePath('/attendance')
  revalidatePath('/attendance/history')
  revalidatePath('/dashboard')
  revalidatePath('/branches')
  revalidatePath('/branches/[id]', 'page')
  return { success: true }
}
