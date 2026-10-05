import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddBranchModal from '@/components/AddBranchModal'
import BranchesView from '@/components/BranchesView'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone } from '@/utils/dates'

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  const params = await searchParams
  const view = params.view === 'reports' ? 'reports' : 'directory'
  const today = dateInTimeZone()

  const { data: branches, error } = await supabase
    .from('branch')
    .select('id, name, address, description, photo_url')
    .order('name')

  if (error) {
    return (
      <DashboardShell title="Branches" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  const branchRows = branches ?? []
  const [studentResult, scheduleResult] = view === 'directory' && branchRows.length
    ? await Promise.all([
      supabase.from('student').select('branch_id').eq('is_active', true),
      supabase.from('class_schedule').select('id, branch_id')
        .eq('date', today).neq('status', 'Draft').neq('status', 'Cancelled'),
    ])
    : [{ data: [] }, { data: [] }]

  if (studentResult.error || scheduleResult.error) {
    const loadError = studentResult.error?.message ?? scheduleResult.error?.message
    return <DashboardShell title="Branches" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load branch data: {loadError}</p></DashboardShell>
  }

  const classesByBranch = new Map<number, number>()
  for (const schedule of scheduleResult.data ?? []) {
    classesByBranch.set(Number(schedule.branch_id), (classesByBranch.get(Number(schedule.branch_id)) ?? 0) + 1)
  }
  const studentsByBranch = new Map<number, number>()
  for (const student of studentResult.data ?? []) {
    studentsByBranch.set(Number(student.branch_id), (studentsByBranch.get(Number(student.branch_id)) ?? 0) + 1)
  }
  const branchesWithStats = branchRows.map((branch) => ({
    ...branch,
    address: branch.address ?? '',
    studentCount: studentsByBranch.get(Number(branch.id)) ?? 0,
    todayClasses: classesByBranch.get(Number(branch.id)) ?? 0,
  }))
  return (
    <DashboardShell title="Branches" currentUser={currentUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1" aria-label="Branches views">
          <Link href="/branches" aria-current={view === 'directory' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'directory' ? 'bg-black text-white' : 'text-gray-600 hover:bg-white'}`}>Directory</Link>
          <Link href="/branches?view=reports" aria-current={view === 'reports' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'reports' ? 'bg-black text-white' : 'text-gray-600 hover:bg-white'}`}>Branch reports</Link>
        </div>
        {view === 'directory' && <AddBranchModal />}
      </div>

      {view === 'reports'
        ? <section className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Branch reports</h2>
          <p className="mt-2 text-sm text-gray-500">Branch reporting will be added here.</p>
        </section>
        : <>
          <div className="mb-5 mt-5">
            <h2 className="text-xl font-semibold text-black">All branches</h2>
            <p className="mt-1 text-sm text-gray-500">{branchRows.length} branch{branchRows.length === 1 ? '' : 'es'} · Manage branch details and view their students.</p>
          </div>
          <BranchesView branches={branchesWithStats} />
        </>}
    </DashboardShell>
  )
}
