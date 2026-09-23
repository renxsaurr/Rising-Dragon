import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'
import EditBranchModal from '@/components/EditBranchModal'

// [id] in the folder name makes this a dynamic route —
// visiting /branches/3 makes params.id === "3" automatically
export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  // same role gate as the list page — Head Coach only
  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  // fetch just this one branch by the id from the URL
  const { data: branch } = await supabase
    .from('Branch')
    .select('*')
    .eq('id', id)
    .single()

  // if someone visits /branches/999 and it doesn't exist, show Next.js's built-in 404 page
  if (!branch) notFound()

  // student count for this specific branch
  const { data: students, count: studentCount } = await supabase
    .from('Student')
    .select('id', { count: 'exact' })
    .eq('branch_id', branch.id)

  // today's schedule for this branch, including the assigned coach's name
  // User:coach_id(name) is a Supabase join — pulls the coach's name from the User table
  // via the coach_id foreign key on ClassSchedule
  const { data: todaySchedule } = await supabase
    .from('ClassSchedule')
    .select('time_start, time_end, coach_id, User:coach_id(name)')
    .eq('branch_id', branch.id)
    .eq('date', new Date().toISOString().split('T')[0])
    .order('time_start')

  return (
    <DashboardShell title={branch.name} currentUser={currentUser}>
            {/* back link + edit button row */}
      <div className="flex items-center justify-between">
        <Link href="/branches" className="text-[13px] text-gray-500 hover:text-black">
          ← Back to Branches
        </Link>
        <EditBranchModal branch={branch} />
      </div>

      {/* header banner — same gradient style as the card, just bigger */}
      <div className="mt-4 mb-6 bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">{branch.name}</h1>
        <p className="text-white/80 text-[13px] mt-1">{branch.address}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* stat card 1 — total students at this branch */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-[13px] text-gray-500">Students Enrolled</p>
          <p className="text-2xl font-bold mt-1">{studentCount ?? 0}</p>
        </div>

        {/* stat card 2 — how many classes run today at this branch */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-[13px] text-gray-500">Classes Today</p>
          <p className="text-2xl font-bold mt-1">{todaySchedule?.length ?? 0}</p>
        </div>

        {/* today's schedule list — spans both columns */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-[14px] mb-3">Today's Schedule</h3>
          {todaySchedule && todaySchedule.length > 0 ? (
            <ul className="space-y-2">
              {todaySchedule.map((slot, i) => (
                <li key={i} className="flex justify-between text-[13px] border-b border-gray-50 pb-2 last:border-0">
                  <span>{slot.time_start} – {slot.time_end}</span>
                  {/* (slot as any) is a quick type workaround for the joined User data —
                      not the cleanest TypeScript but fine for tonight */}
                  <span className="text-gray-500">{(slot as any).User?.name ?? 'Unassigned'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-gray-400">No classes scheduled today.</p>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}