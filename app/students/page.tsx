import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import DashboardShell from '@/components/DashboardShell'
import StudentModal from '@/components/StudentModal'
import DeleteStudentButton from '@/components/DeleteStudentButton'
import RowActionsMenu from '@/components/RowActionsMenu'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { getCoachBranchIdsForDate } from '@/utils/coach-access'
import { dateInTimeZone } from '@/utils/dates'
import { redirect } from 'next/navigation'
import { formatBeltLabel } from '@/utils/belts'

const BELT_COLORS: Record<string, string> = {
  practitioner: 'bg-gray-100 text-gray-600',
  white_belt: 'bg-gray-100 text-gray-700',
  low_yellow: 'bg-yellow-50 text-yellow-600',
  high_yellow: 'bg-yellow-100 text-yellow-800',
  low_blue: 'bg-blue-50 text-blue-600',
  high_blue: 'bg-blue-100 text-blue-800',
  low_red: 'bg-red-50 text-red-600',
  high_red: 'bg-red-100 text-red-800',
  low_brown: 'bg-amber-50 text-amber-700',
  high_brown: 'bg-amber-100 text-amber-900',
  first_dan_black_belt: 'bg-gray-900 text-white',
  second_dan_black_belt: 'bg-gray-900 text-white',
  third_dan_black_belt: 'bg-gray-900 text-white',
  fourth_dan_black_belt: 'bg-gray-900 text-white',
}

export default async function StudentsPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!['head_coach', 'assistant_coach'].includes(currentUser.role)) redirect('/scheduling')

  let assignedBranchIds: number[] | null = null
  if (currentUser?.role === 'assistant_coach') {
    try {
      assignedBranchIds = await getCoachBranchIdsForDate(currentUser.id, dateInTimeZone())
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : 'Unable to verify your branch assignments.'
      return <DashboardShell title="Students" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">{message}</p></DashboardShell>
    }
  }

  let studentQuery = supabase
    .from('student')
    .select('*, branch:branch!student_branch_id_fkey(name)')
    .order('last_name')
    .order('first_name')
  if (assignedBranchIds) studentQuery = studentQuery.in('branch_id', assignedBranchIds)
  const { data: students, error } = await studentQuery


  let branchQuery = supabase.from('branch').select('id, name').order('name')
  if (assignedBranchIds) branchQuery = branchQuery.in('id', assignedBranchIds)
  const { data: branches } = await branchQuery

  if (error) {
    return (
      <DashboardShell title="Students" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  const total = students?.length ?? 0

  return (
    <DashboardShell title="Students" currentUser={currentUser}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-black">All Students</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {currentUser?.role === 'assistant_coach'
              ? `${total} student${total === 1 ? '' : 's'} at your assigned branches today`
              : `${total} student${total === 1 ? '' : 's'} across all branches`}
          </p>
        </div>
        {(currentUser.role === 'head_coach' || (branches?.length ?? 0) > 0) && <StudentModal branches={branches ?? []} />}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
        {total === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">No students yet</p>
            <p className="mt-1 text-[13px] text-gray-500">Enroll a student to see them listed here.</p>
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[17%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70">
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Student</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Belt Level</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Branch</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Guardian Name</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Guardian Contact</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Enrolled</th>
                <th className="px-2 py-3.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students?.map((student) => {
                  const fullName = [student.first_name, student.middle_name, student.last_name]
                    .filter(Boolean)
                    .join(' ')
                  const beltStyle = BELT_COLORS[student.belt_level] ?? 'bg-gray-100 text-gray-700'

                  return (
                    <tr key={student.id} className="group transition-colors hover:bg-gray-50">
                      <td className="break-words px-4 py-4 text-sm font-medium text-gray-900">
                        {fullName}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${beltStyle}`}>
                          {formatBeltLabel(student.belt_level)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-[13px] text-gray-600">{student.branch?.name}</td>
                      <td className="truncate px-3 py-4 text-[13px] text-gray-700">
                        {student.guardian_name || '—'}
                      </td>
                      <td className="px-3 py-4 text-[12px] text-gray-500">
                        <span className="block whitespace-nowrap">{student.guardian_contact || '—'}</span>
                        <span className="block truncate text-gray-400" title={student.guardian_email}>{student.guardian_email}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-[13px] text-gray-600">
                        {new Date(student.enrollment_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end">
                          <RowActionsMenu>
                            <StudentModal
                              branches={branches ?? []}
                              student={student}
                              trigger={
                                <button className="w-full px-4 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50">
                                  Edit
                                </button>
                              }
                            />
                            {currentUser?.role === 'head_coach' && <DeleteStudentButton
                              studentId={student.id}
                              studentName={fullName}
                              className="w-full px-4 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                            />}
                          </RowActionsMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
            </div>

            <div className="divide-y divide-gray-100 xl:hidden">
              {students?.map((student) => {
                const fullName = [student.first_name, student.middle_name, student.last_name]
                  .filter(Boolean)
                  .join(' ')
                const beltStyle = BELT_COLORS[student.belt_level] ?? 'bg-gray-100 text-gray-700'

                return (
                  <div key={student.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{fullName}</p>
                      <RowActionsMenu>
                        <StudentModal
                          branches={branches ?? []}
                          student={student}
                          trigger={
                            <button className="w-full px-4 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50">
                              Edit
                            </button>
                          }
                        />
                        {currentUser?.role === 'head_coach' && <DeleteStudentButton
                          studentId={student.id}
                          studentName={fullName}
                          className="w-full px-4 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                        />}
                      </RowActionsMenu>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Belt Level</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-xs font-medium ${beltStyle}`}>
                            {formatBeltLabel(student.belt_level)}
                          </span>
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Branch</dt>
                        <dd className="mt-1 break-words text-[13px] text-gray-700">{student.branch?.name || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Guardian Name</dt>
                        <dd className="mt-1 break-words text-[13px] text-gray-700">{student.guardian_name || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Guardian Contact</dt>
                        <dd className="mt-1 break-all text-[13px] text-gray-700">{student.guardian_contact || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Guardian Email</dt>
                        <dd className="mt-1 break-all text-[13px] text-gray-700">{student.guardian_email}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Enrolled</dt>
                        <dd className="mt-1 text-[13px] text-gray-700">
                          {new Date(student.enrollment_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
          <p className="text-[13px] text-gray-500">
            Showing <span className="font-medium text-gray-700">{total}</span> of{' '}
            <span className="font-medium text-gray-700">{total}</span> results
          </p>
        </div>
      </div>
    </DashboardShell>
  )
}
