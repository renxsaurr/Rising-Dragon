import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
<<<<<<< HEAD
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddUserModal'
import EditUserModal from '@/components/EditUserModal'
import DeleteUserButton from '@/components/DeleteUserButton'
=======

import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddUserModal'
import UsersTable from '@/components/UsersTable'

import { getCurrentUser } from '@/utils/getCurrentUser'
>>>>>>> 5fdc5c3fd17b6095824860e67ee2dd26ef9bfdb3

function getManilaDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

<<<<<<< HEAD
=======
  return formatter.format(new Date())
}

>>>>>>> 5fdc5c3fd17b6095824860e67ee2dd26ef9bfdb3
export default async function UsersPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (currentUser.role !== 'head_coach') redirect('/students')

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
<<<<<<< HEAD
  const [{ data: userData, error }, { data: branches }] = await Promise.all([
    supabase.from('user')
      .select('id, auth_id, name, contact, role, home_branch_id, branch:branch!user_home_branch_id_fkey(name)')
      .order('name'),
    supabase.from('branch').select('id, name').order('name'),
  ])

  const users = userData as unknown as { id: number; auth_id: string; name: string; contact: string | null; role: string; home_branch_id: number | null; branch: { name: string } | null }[] | null

  if (error) {
    return <DashboardShell title="Users & roles" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load users: {error.message}</p></DashboardShell>
=======

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
>>>>>>> 5fdc5c3fd17b6095824860e67ee2dd26ef9bfdb3
  }

  let authUsers: { id: string; email?: string; banned_until?: string | null }[] = []
  let authLoadError = false
  try {
    const admin = createAdminClient()
    const { data, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (authError) authLoadError = true
    else authUsers = data.users.map((user) => ({ id: user.id, email: user.email, banned_until: user.banned_until }))
  } catch {
    authLoadError = true
  }
  const authById = new Map(authUsers.map((user) => [user.id, user]))
  const total = users?.length ?? 0

  return (
<<<<<<< HEAD
    <DashboardShell title="Users & roles" currentUser={currentUser}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">Staff accounts</h2>
          <p className="mt-1 text-sm text-gray-500">Manage coach access and role assignments. {total} account{total === 1 ? '' : 's'}.</p>
        </div>
        <AddUserModal branches={branches ?? []} />
      </div>

      {authLoadError && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Login status could not be loaded. Confirm the server has SUPABASE_SERVICE_ROLE_KEY configured.</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
        {total === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-800">No staff accounts yet</p>
            <p className="mt-1 text-sm text-gray-500">Use Add user to create an Auth login and staff profile.</p>
          </div>
        ) : (
          <>
          <div className="hidden xl:block">
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-gray-200 bg-gray-50/70">
                <tr>
                  <th className="w-[19%] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Name</th>
                  <th className="w-[23%] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Login email</th>
                  <th className="w-[17%] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Role</th>
                  <th className="w-[17%] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Home branch</th>
                  <th className="w-[12%] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="w-[12%] px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.map((user) => {
                  const authUser = authById.get(user.auth_id)
                  const active = Boolean(authUser && (!authUser.banned_until || Date.parse(authUser.banned_until) <= Date.now()))
                  const isSelf = user.id === currentUser.id
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{user.name}{isSelf && <span className="ml-2 text-xs font-normal text-gray-400">You</span>}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{authUser?.email ?? '—'}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.role === 'head_coach' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{ROLE_LABELS[user.role] ?? user.role}</span></td>
                      <td className="px-5 py-4 text-sm text-gray-600">{user.branch?.name ?? '—'}</td>
                      <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-700' : 'text-gray-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />{authUser ? active ? 'Active' : 'Inactive' : 'Unavailable'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditUserModal user={user} isSelf={isSelf} branches={branches ?? []} />
                          <DeleteUserButton userId={user.id} userName={user.name} active={active} disabled={isSelf || !authUser} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 xl:hidden">
            {users?.map((user) => {
              const authUser = authById.get(user.auth_id)
              const active = Boolean(authUser && (!authUser.banned_until || Date.parse(authUser.banned_until) <= Date.now()))
              const isSelf = user.id === currentUser.id
              return (
                <article key={user.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-gray-900">{user.name}{isSelf && <span className="ml-2 text-xs font-normal text-gray-400">You</span>}</h3>
                      <p className="mt-1 break-all text-xs text-gray-500">{authUser?.email ?? 'Login email unavailable'}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-700' : 'text-gray-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />{authUser ? active ? 'Active' : 'Inactive' : 'Unavailable'}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Role</dt><dd className="mt-1 text-sm text-gray-700">{ROLE_LABELS[user.role] ?? user.role}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Home branch</dt><dd className="mt-1 break-words text-sm text-gray-700">{user.branch?.name ?? '—'}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contact</dt><dd className="mt-1 break-words text-sm text-gray-700">{user.contact || '—'}</dd></div>
                  </dl>
                  <div className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-2">
                    <EditUserModal user={user} isSelf={isSelf} branches={branches ?? []} />
                    <DeleteUserButton userId={user.id} userName={user.name} active={active} disabled={isSelf || !authUser} />
                  </div>
                </article>
              )
            })}
          </div>
          </>
        )}
        <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Staff records remain available for schedule and attendance history when login access is deactivated.</div>
      </div>
=======
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

>>>>>>> 5fdc5c3fd17b6095824860e67ee2dd26ef9bfdb3
    </DashboardShell>
  )
}
