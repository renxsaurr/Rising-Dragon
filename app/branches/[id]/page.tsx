import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'
import EditBranchModal from '@/components/EditBranchModal'

export const dynamic = 'force-dynamic'


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

          // students for this specific branch
  const { data: students } = await supabase
    .from('Student')
    .select('id, first_name, middle_name, last_name, belt_level', { count: 'exact' })
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
                <Link
          href="/branches"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 hover:text-black transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Branches
        </Link>
        <EditBranchModal branch={branch} />
      </div>

      {/* header banner — same gradient style as the card, just bigger */}
      <div className="mt-4 mb-6 bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">{branch.name}</h1>
        <p className="text-white/80 text-[13px] mt-1">{branch.address}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* stat card 1 — students */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] text-gray-500">Students Enrolled</p>
            <p className="text-2xl font-bold mt-0.5">{students?.length ?? 0}</p>
          </div>
        </div>

        {/* stat card 2 — classes today */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] text-gray-500">Classes Today</p>
            <p className="text-2xl font-bold mt-0.5">{todaySchedule?.length ?? 0}</p>
          </div>
        </div>
                {/* enrolled students list — spans both columns, mirrors Today's Schedule styling */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-[14px] mb-3">Enrolled Students</h3>
          {students && students.length > 0 ? (
            <ul className="space-y-2">
                            {students.map((s) => {
                const fullName = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')
                return (
                  <li key={s.id} className="flex justify-between text-[13px] border-b border-gray-50 pb-2 last:border-0">
                    <span>{fullName}</span>
                    <span className="text-gray-500">{s.belt_level ?? '—'}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-gray-400">No students enrolled yet.</p>
          )}
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