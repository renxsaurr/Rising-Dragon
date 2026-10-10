import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'
import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddUserModal'
import EditUserModal from '@/components/EditUserModal'
import DeleteUserButton from '@/components/DeleteUserButton'
import RowActionsMenu from '@/components/RowActionsMenu'
import RowActionItem, { ROW_ACTION_CLASS } from '@/components/RowActionItem'
import PaginatedTableRows from '@/components/PaginatedTableRows'
import PaginatedListItems from '@/components/PaginatedListItems'

const ROLE_LABELS: Record<string, string> = {
  head_coach: 'Head Coach',
  assistant_coach: 'Assistant Coach',
}

type StaffUser = {
  id: number
  auth_id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  contact: string | null
  role: string
  primary_branch_id: number | null
}

function displayName(user: Pick<StaffUser, 'first_name' | 'middle_name' | 'last_name'>) {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user'
}

function isAuthUserActive(user: { banned_until?: string | null } | undefined) {
  return Boolean(user && (!user.banned_until || Date.parse(user.banned_until) <= Date.now()))
}

export default async function UsersPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (currentUser.role !== 'head_coach') redirect('/students')

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const [{ data: userData, error }, { data: allBranches }] = await Promise.all([
    supabase.from('user')
      .select('id, auth_id, first_name, middle_name, last_name, contact, role, primary_branch_id')
      .order('first_name'),
    supabase.from('branch').select('id, name, is_active').order('name'),
  ])

  const users = userData as unknown as StaffUser[] | null
  const branchNameById = new Map((allBranches ?? []).map((branch) => [Number(branch.id), branch.name]))
  const branches = (allBranches ?? []).filter((branch) => branch.is_active)

  if (error) {
    return <DashboardShell title="Users & roles" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load users: {error.message}</p></DashboardShell>
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
    <DashboardShell title="Users & roles" currentUser={currentUser}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-gray-950">Staff accounts</h2>
          </div>
        </div>
        <AddUserModal branches={branches ?? []} />
      </div>

      {authLoadError && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Login status could not be loaded. Confirm the server has SUPABASE_SERVICE_ROLE_KEY configured.</p>}

      <div className="overflow-hidden border-y border-gray-200 bg-white">
        {total === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-800">No staff accounts yet</p>
            <p className="mt-1 text-sm text-gray-500">Use Add user to create an Auth login and staff profile.</p>
          </div>
        ) : (
          <>
          <div className="hidden xl:block">
            <div className="overflow-x-auto">
            <table aria-label="Staff accounts" className="w-full min-w-[1040px] table-fixed border-collapse bg-white text-left text-sm text-gray-950">
              <thead className="border-b border-gray-200">
                <tr>
                  <th scope="col" className="w-[6%] px-4 py-4 text-xs font-medium text-gray-500">#</th>
                  <th scope="col" className="w-[25%] px-4 py-4 text-xs font-medium text-gray-500">Staff member</th>
                  <th scope="col" className="w-[22%] px-4 py-4 text-xs font-medium text-gray-500">Login email</th>
                  <th scope="col" className="w-[14%] px-4 py-4 text-xs font-medium text-gray-500">Role</th>
                  <th scope="col" className="w-[16%] px-4 py-4 text-xs font-medium text-gray-500">Primary branch</th>
                  <th scope="col" className="w-[10%] px-4 py-4 text-xs font-medium text-gray-500">Status</th>
                  <th scope="col" className="w-[7%] px-4 py-4 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="staff accounts" colSpan={7}>
                {users?.map((user, index) => {
                  const authUser = authById.get(user.auth_id)
                  const active = isAuthUserActive(authUser)
                  const isSelf = user.id === currentUser.id
                  const name = displayName(user)
                  return (
                    <tr id={`user-${user.id}-desktop`} key={user.id} className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50/60">
                      <td className="px-4 py-5 text-sm font-medium tabular-nums text-gray-700">{index + 1}</td>
                      <td className="px-4 py-5">
                        <span className="break-words text-sm font-medium text-gray-950">{name}{isSelf && <span className="ml-2 text-xs font-normal text-gray-700">You</span>}</span>
                      </td>
                      <td className="break-all px-4 py-5 text-sm font-medium text-gray-950">{authUser?.email ?? '—'}</td>
                      <td className="whitespace-normal px-4 py-5 text-sm font-medium text-gray-950">{ROLE_LABELS[user.role] ?? user.role}</td>
                      <td className="break-words px-4 py-5 text-sm font-medium text-gray-950">{branchNameById.get(Number(user.primary_branch_id)) ?? '—'}</td>
                      <td className="px-4 py-5"><span className="inline-flex items-center gap-2 text-sm font-medium text-gray-950"><span className={`h-2 w-2 rounded-full ${authUser && active ? 'bg-emerald-500' : 'bg-gray-300'}`} />{authUser ? active ? 'Active' : 'Inactive' : 'Unavailable'}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end"><RowActionsMenu>
                          <EditUserModal user={user} branches={branches ?? []} trigger={<RowActionItem>Edit staff account</RowActionItem>} />
                          <DeleteUserButton userId={user.id} userName={name} active={active} disabled={isSelf || !authUser} trigger={<RowActionItem disabled={isSelf || !authUser} className={`${ROW_ACTION_CLASS} text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40`}>{active ? 'Deactivate account' : 'Reactivate account'}</RowActionItem>} />
                        </RowActionsMenu></div>
                      </td>
                    </tr>
                  )
                })}
              </PaginatedTableRows>
            </table>
            </div>
          </div>
          <div className="divide-y divide-gray-100 xl:hidden">
            <PaginatedListItems itemLabel="staff accounts">
            {users?.map((user) => {
              const authUser = authById.get(user.auth_id)
              const active = isAuthUserActive(authUser)
              const isSelf = user.id === currentUser.id
              const name = displayName(user)
              return (
                <article id={`user-${user.id}-mobile`} key={user.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-gray-900">{name}{isSelf && <span className="ml-2 text-xs font-normal text-gray-400">You</span>}</h3>
                      <p className="mt-1 break-all text-xs font-medium text-gray-950">{authUser?.email ?? 'Login email unavailable'}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-950"><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />{authUser ? active ? 'Active' : 'Inactive' : 'Unavailable'}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Role</dt><dd className="mt-1"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium text-gray-950 ring-1 ring-inset ${user.role === 'head_coach' ? 'bg-red-50 ring-red-200' : 'bg-blue-50 ring-blue-200'}`}>{ROLE_LABELS[user.role] ?? user.role}</span></dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Primary branch</dt><dd className="mt-1 break-words text-sm font-medium text-gray-950">{branchNameById.get(Number(user.primary_branch_id)) ?? '—'}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contact</dt><dd className="mt-1 break-words text-sm font-medium text-gray-950">{user.contact || '—'}</dd></div>
                  </dl>
                  <div className="mt-3 flex justify-end border-t border-gray-100 pt-2">
                    <RowActionsMenu>
                      <EditUserModal user={user} branches={branches ?? []} trigger={<RowActionItem>Edit staff account</RowActionItem>} />
                      <DeleteUserButton userId={user.id} userName={name} active={active} disabled={isSelf || !authUser} trigger={<RowActionItem disabled={isSelf || !authUser} className={`${ROW_ACTION_CLASS} text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40`}>{active ? 'Deactivate account' : 'Reactivate account'}</RowActionItem>} />
                    </RowActionsMenu>
                  </div>
                </article>
              )
            })}
            </PaginatedListItems>
          </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
