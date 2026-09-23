import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddUserModal'
import UsersTable from '@/components/UsersTable'

import { getCurrentUser } from '@/utils/getCurrentUser'

function getManilaDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

export default async function UsersPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const currentUser = await getCurrentUser()

  // Only Head Coach can access Users
  if (
    !currentUser ||
    currentUser.role !== 'head_coach'
  ) {
    redirect('/students')
  }

  /*
   * Get all users
   */
  const {
    data: users,
    error: usersError,
  } = await supabase
    .from('User')
    .select('id, name, contact, role')
    .order('name')

  if (usersError) {
    return (
      <DashboardShell
        title="Users"
        currentUser={currentUser}
      >
        <p className="text-red-600 text-sm">
          Something went wrong:{' '}
          {usersError.message}
        </p>
      </DashboardShell>
    )
  }

  /*
   * Get today's classes.
   *
   * We only need today's schedules because
   * Active means the coach is teaching a
   * class RIGHT NOW.
   */
  const today = getManilaDate()

  const {
    data: schedules,
    error: schedulesError,
  } = await supabase
    .from('ClassSchedule')
    .select(
      'id, date, time_start, time_end, coach_id'
    )
    .eq('date', today)

  if (schedulesError) {
    return (
      <DashboardShell
        title="Users"
        currentUser={currentUser}
      >
        <p className="text-red-600 text-sm">
          Unable to load class schedules:{' '}
          {schedulesError.message}
        </p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      title="Users"
      currentUser={currentUser}
    >

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">

        <div>
          <h2 className="text-[20px] font-semibold text-black">
            All Users
          </h2>

          <p className="text-[13px] text-gray-500 mt-0.5">
            {users?.length ?? 0} user
            {users?.length === 1 ? '' : 's'}
          </p>
        </div>

        <AddUserModal />

      </div>

      {/* Users Table */}
      <UsersTable
        users={users ?? []}
        schedules={schedules ?? []}
        currentUserId={currentUser.id}
      />

    </DashboardShell>
  )
}