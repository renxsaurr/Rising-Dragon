import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import DashboardShell from '@/components/DashboardShell'
import StudentModal from '@/components/StudentModal'
import DeleteStudentButton from '@/components/DeleteStudentButton'
import { getCurrentUser } from '@/utils/getCurrentUser'

const BELT_LABELS: Record<string, string> = {
  practitioner: 'Practitioner',
  white_belt: 'White Belt',
  low_yellow: 'Low Yellow',
  high_yellow: 'High Yellow',
  low_blue: 'Low Blue',
  high_blue: 'High Blue',
  low_red: 'Low Red',
  high_red: 'High Red',
  low_brown: 'Low Brown',
  high_brown: 'High Brown',
  first_dan_black_belt: '1st Dan Black Belt',
  second_dan_black_belt: '2nd Dan Black Belt',
  third_dan_black_belt: '3rd Dan Black Belt',
  fourth_dan_black_belt: '4th Dan Black Belt',
}

const formatBeltLabel = (belt: string) => BELT_LABELS[belt] ?? belt

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

  const { data: students, error } = await supabase
    .from('Student')
    .select('*, Branch(name)')

  const { data: branches } = await supabase
    .from('Branch')
    .select('id, name')

  if (error) {
    return (
      <DashboardShell title="Students" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Students" currentUser={currentUser}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-black">All Students</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {students?.length ?? 0} student{students?.length === 1 ? '' : 's'} across all branches
          </p>
        </div>
        <StudentModal branches={branches ?? []} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Belt Level</th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Branch</th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Guardian</th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Enrolled</th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <p className="text-[14px] text-gray-400">No students yet.</p>
                  <p className="text-[13px] text-gray-300 mt-1">Click "Add Student" to create the first one.</p>
                </td>
              </tr>
            )}
            {students?.map((student, i) => {
              const fullName = [student.first_name, student.middle_name, student.last_name]
                .filter(Boolean)
                .join(' ')
              const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`.toUpperCase()
              const beltStyle = BELT_COLORS[student.belt_level] ?? 'bg-gray-100 text-gray-700'

              return (
                <tr
                  key={student.id}
                  className={`group border-b border-gray-50 last:border-0 hover:bg-red-50/30 transition-colors ${
                    i % 2 === 1 ? 'bg-gray-50/40' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center shrink-0 group-hover:bg-red-600 transition-colors">
                        <span className="text-white text-[12px] font-bold">{initials}</span>
                      </div>
                      <span className="text-[14px] font-semibold text-black">{fullName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${beltStyle}`}>
                      {formatBeltLabel(student.belt_level)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                      {student.Branch?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-medium text-gray-700">{student.guardian_name}</p>
                    <p className="text-[12px] text-gray-400">{student.guardian_contact}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] text-gray-500">
                      {new Date(student.enrollment_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <StudentModal
                        branches={branches ?? []}
                        student={student}
                        trigger={
                          <button className="text-[12px] font-semibold text-gray-500 hover:text-black transition-colors">
                            Edit
                          </button>
                        }
                      />
                      <DeleteStudentButton studentId={student.id} studentName={fullName} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}