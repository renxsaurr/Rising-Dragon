import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddBranchModal from '@/components/AddBranchModal'
import { getCurrentUser } from '@/utils/getCurrentUser'

export default async function BranchesPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  const { data: branches, error } = await supabase
    .from('Branch')
    .select('*')

  if (error) {
    return (
      <DashboardShell title="Branches" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Branches" currentUser={currentUser}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-black">All Branches</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {branches?.length ?? 0} branch{branches?.length === 1 ? '' : 'es'}
          </p>
        </div>
        <AddBranchModal />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Address</th>
            </tr>
          </thead>
          <tbody>
            {branches?.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-[14px] text-gray-400">
                  No branches yet.
                </td>
              </tr>
            )}
            {branches?.map((branch) => (
              <tr key={branch.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-[14px] font-medium text-black">{branch.name}</td>
                <td className="px-5 py-3.5 text-[14px] text-gray-600">{branch.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}