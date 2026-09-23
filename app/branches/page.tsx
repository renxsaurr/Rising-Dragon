import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddBranchModal from '@/components/AddBranchModal'
import BranchesView from '@/components/BranchesView'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone } from '@/utils/dates'

export default async function BranchesPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  const { data: branches, error } = await supabase
    .from('branch')
    .select('*')
    .order('name')

  if (error) {
    return (
      <DashboardShell title="Branches" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  const branchesWithStats = await Promise.all(
    (branches ?? []).map(async (branch) => {
      const { count: studentCount } = await supabase
        .from('student')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branch.id)

      const { count: todayClasses } = await supabase
        .from('class_schedule')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branch.id)
        .eq('date', dateInTimeZone())

      return { ...branch, studentCount: studentCount ?? 0, todayClasses: todayClasses ?? 0 }
    })
  )

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

      <BranchesView branches={branchesWithStats} />
    </DashboardShell>
  )
}
