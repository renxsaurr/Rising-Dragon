import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import DashboardShell from '@/components/DashboardShell'
import AddStudentModal from '@/components/AddStudentModal'
import { getCurrentUser } from '@/utils/getCurrentUser'

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
        <AddStudentModal branches={branches ?? []} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Belt Level</th>
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Branch</th>
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Guardian Contact</th>
            </tr>
          </thead>
          <tbody>
            {students?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[14px] text-gray-400">
                  No students yet. Click "Add Student" to create the first one.
                </td>
              </tr>
            )}
            {students?.map((student) => (
              <tr key={student.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-[14px] font-medium text-black">{student.name}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-red-50 text-red-700">
                    {student.belt_level}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[14px] text-gray-600">{student.Branch?.name}</td>
                <td className="px-5 py-3.5 text-[14px] text-gray-600">{student.guardian_contact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}