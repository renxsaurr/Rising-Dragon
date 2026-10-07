import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import DashboardShell from '@/components/DashboardShell'
import StudentProgressForm from '@/app/students/_components/StudentProgressForm'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createAdminClient } from '@/utils/supabase/admin'
import { dateInTimeZone } from '@/utils/dates'
import { formatBeltLabel } from '@/utils/belts'

const focusLabels: Record<string, string> = {
  technique: 'Technique', forms: 'Forms / patterns', sparring: 'Sparring',
  conditioning: 'Conditioning', discipline: 'Discipline and control',
}
const levelLabels: Record<string, string> = {
  needs_practice: 'Needs more practice', developing: 'Developing', consistent: 'Consistent',
}
const readinessLabels: Record<string, string> = {
  not_assessed: 'Not assessed', not_ready: 'Not ready yet', ready_for_assessment: 'Ready for coach assessment',
}
const fullName = (person: { first_name: string; middle_name: string | null; last_name: string }) =>
  [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')

type ProgressRow = {
  id: number
  assessed_on: string
  focus_area: string
  progress_level: string
  assessment_readiness: string
  observation: string
  next_steps: string | null
  coach_id: number
}

export default async function StudentProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!['head_coach', 'assistant_coach'].includes(currentUser.role)) redirect('/scheduling')

  const { id } = await params
  const studentId = /^\d+$/.test(id) ? Number(id) : NaN
  if (!Number.isSafeInteger(studentId) || studentId <= 0) notFound()

  const admin = createAdminClient()
  const { data: student, error: studentError } = await admin.from('student')
    .select('id, first_name, middle_name, last_name, belt_level, branch_id, is_active, enrollment_date, branch:branch!student_branch_id_fkey(name)')
    .eq('id', studentId)
    .maybeSingle()
  if (studentError) return <DashboardShell title="Student progress" currentUser={currentUser}><p role="alert" className="text-sm text-red-700">Could not load student: {studentError.message}</p></DashboardShell>
  if (!student) notFound()

  if (currentUser.role === 'assistant_coach') {
    const { data: assignment, error } = await admin.from('class_schedule').select('id')
      .eq('coach_id', currentUser.id).eq('branch_id', student.branch_id)
      .neq('status', 'Cancelled').neq('status', 'Draft').limit(1)
    if (error || !assignment?.length) redirect('/students')
  }

  const { data: progressData, error: progressError } = await admin.from('student_progress')
    .select('id, assessed_on, focus_area, progress_level, assessment_readiness, observation, next_steps, coach_id')
    .eq('student_id', studentId)
    .order('assessed_on', { ascending: false }).order('id', { ascending: false }).limit(100)
  const progress = (progressData ?? []) as ProgressRow[]
  const coachIds = [...new Set(progress.map((row) => Number(row.coach_id)))]
  const coachNames = new Map<number, string>()
  if (coachIds.length) {
    const { data: coaches } = await admin.from('user').select('id, first_name, middle_name, last_name').in('id', coachIds)
    for (const coach of coaches ?? []) coachNames.set(Number(coach.id), fullName(coach))
  }
  const branch = student.branch as unknown as { name: string } | null
  const studentName = fullName(student)

  return (
    <DashboardShell title="Student progress" currentUser={currentUser}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/students" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-black"><ChevronLeft className="h-4 w-4" aria-hidden />Students</Link>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{studentName}</h1>
            <p className="mt-1 text-sm text-gray-600">{branch?.name ?? 'Branch'} · Belt: {student.belt_level ? formatBeltLabel(student.belt_level) : 'Not set'}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{student.is_active ? 'Active student' : 'Archived student'}</span>
        </div>

        {student.is_active
          ? <StudentProgressForm studentId={studentId} today={dateInTimeZone()} />
          : <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">This student is archived. Existing progress history is available below; new records are disabled.</p>}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div><h2 className="font-semibold text-gray-950">Progress history</h2><p className="mt-0.5 text-sm text-gray-600">Most recent 100 coach observations.</p></div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{progress.length} record{progress.length === 1 ? '' : 's'}</span>
          </header>
          {progressError
            ? <p role="alert" className="p-5 text-sm text-red-700">Could not load progress history: {progressError.message}</p>
            : progress.length === 0
              ? <p className="px-5 py-12 text-center text-sm text-gray-600">No progress checks have been recorded for this student.</p>
              : <ol className="divide-y divide-gray-100">
                {progress.map((row) => <li key={row.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-gray-950">{focusLabels[row.focus_area] ?? row.focus_area} <span className="font-normal text-gray-600">· {levelLabels[row.progress_level] ?? row.progress_level}</span></p>
                    <time className="text-sm text-gray-600" dateTime={row.assessed_on}>{new Date(`${row.assessed_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                  </div>
                  <p className="text-sm text-gray-800">{row.observation}</p>
                  {row.next_steps && <p className="text-sm text-gray-700"><span className="font-medium">Next step:</span> {row.next_steps}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span>{readinessLabels[row.assessment_readiness] ?? row.assessment_readiness}</span>
                    <span>Recorded by {coachNames.get(Number(row.coach_id)) ?? 'Coach'}</span>
                  </div>
                </li>)}
              </ol>}
        </section>
      </div>
    </DashboardShell>
  )
}
