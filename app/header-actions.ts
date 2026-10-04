'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { addDays, dateInTimeZone, formatTimeRange } from '@/utils/dates'

type StudentMatch = {
  id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  belt_level: string
  branch_id: number
  branch: { name: string } | { name: string }[] | null
}

type StaffMatch = {
  id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  role: string
}

type QueryRows<T> = { data: T[] | null }

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[%_*(),.\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

function fullName(person: { first_name: string | null; middle_name: string | null; last_name: string | null } | null) {
  return [person?.first_name, person?.middle_name, person?.last_name].filter(Boolean).join(' ')
}

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function searchDirectory(value: string) {
  const user = await getCurrentUser()
  if (!user) return []

  const term = cleanSearchTerm(value)
  if (term.length < 2) return []

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const pattern = `%${term}%`
  let allowedBranchIds: number[] | null = null

  if (user.role === 'assistant_coach') {
    try {
      allowedBranchIds = await getCoachBranchIdsForDate(user.id, dateInTimeZone())
    } catch {
      return []
    }
  }

  let studentResults: QueryRows<StudentMatch>[] = []
  if (allowedBranchIds === null || allowedBranchIds.length > 0) {
    studentResults = await Promise.all(['first_name', 'middle_name', 'last_name'].map((column) => {
      let query = supabase
        .from('student')
        .select('id, first_name, middle_name, last_name, belt_level, branch_id, branch:branch!student_branch_id_fkey(name)')
        .eq('is_active', true)
        .ilike(column, pattern)
      if (allowedBranchIds) query = query.in('branch_id', allowedBranchIds)
      return query.limit(5)
    }))
  }

  let staffResults: QueryRows<StaffMatch>[] = []
  if (user.role === 'head_coach') {
    staffResults = await Promise.all(['first_name', 'middle_name', 'last_name'].map((column) =>
      supabase
        .from('user')
        .select('id, first_name, middle_name, last_name, role')
        .ilike(column, pattern)
        .limit(5)
    ))
  }

  const students = [...new Map(studentResults.flatMap((result) => result.data ?? []).map((student) => [student.id, student])).values()]
    .slice(0, 6)
    .map((student) => ({
      id: student.id,
      type: 'student' as const,
      name: fullName(student) || 'Unnamed student',
      detail: `${firstRelation(student.branch)?.name ?? 'No branch'} · ${String(student.belt_level).replace(/_/g, ' ')}`,
      href: '/students',
    }))
  const staff = [...new Map(staffResults.flatMap((result) => result.data ?? []).map((member) => [member.id, member])).values()]
    .slice(0, 4)
    .map((member) => ({
      id: member.id,
      type: 'staff' as const,
      name: fullName(member) || 'Unnamed staff member',
      detail: member.role === 'head_coach' ? 'Head Coach' : 'Assistant Coach',
      href: '/users',
    }))

  return [...students, ...staff]
}

export async function getHeaderUpdates() {
  const user = await getCurrentUser()
  if (!user) return { updates: [], error: 'Please sign in to view updates.' }

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const today = dateInTimeZone()
  const throughDate = addDays(today, 7)

  if (user.role === 'head_coach') return { updates: [], error: null }

  const { data, error } = await supabase
    .from('class_schedule')
    .select('id, date, time_start, time_end, branch:branch!class_schedule_branch_id_fkey(name)')
    .eq('coach_id', user.id)
    .gte('date', today)
    .lte('date', throughDate)
    .neq('status', 'Cancelled')
    .neq('status', 'Draft')
    .order('date')
    .order('time_start')
    .limit(6)

  if (error) return { updates: [], error: 'Could not load upcoming class updates.' }
  return {
    updates: (data ?? []).map((schedule) => ({
      id: `schedule-${schedule.id}`,
      title: `${firstRelation(schedule.branch)?.name ?? 'Branch'} class assignment`,
      detail: `${new Date(`${schedule.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTimeRange(schedule.time_start, schedule.time_end)}`,
      href: `/attendance?date=${schedule.date}&scheduleId=${schedule.id}`,
    })),
    error: null,
  }
}
