import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddUserModal'
import EditUserModal from '@/components/EditUserModal'
import DeleteUserButton from '@/components/DeleteUserButton'
import { getCurrentUser } from '@/utils/getCurrentUser'

const ROLE_LABELS: Record<string, string> = {
  head_coach: 'Head Coach',
  assistant_coach: 'Assistant Coach',
}

const ROLE_STYLES: Record<string, string> = {
  head_coach: 'bg-red-50 text-red-700',
  assistant_coach: 'bg-gray-100 text-gray-600',
}

export default async function UsersPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  // same gate as Branches: Head Coach only
  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  const { data: users, error } = await supabase
    .from('User')
    .select('id, name, contact, role')
    .order('name')

  if (error) {
    return (
      <DashboardShell title="Users" currentUser={currentUser}>
        <p className="text-red-600 text-sm">Something went wrong: {error.message}</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Users" currentUser={currentUser}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-black">All Users</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {users?.length ?? 0} user{users?.length === 1 ? '' : 's'}
          </p>
        </div>
        <AddUserModal />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">Name</th>
              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">Contact</th>
              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">Role</th>
              <th className="px-6 py-4 text-[12px] font-medium text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <p className="text-[14px] text-gray-400">No users yet.</p>
                  <p className="text-[13px] text-gray-300 mt-1">Click "Add User" to create the first one.</p>
                </td>
              </tr>
            )}
            {users?.map((user) => {
              const initials = user.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part: string) => part[0])
                .join('')
                .toUpperCase()
              const isSelf = user.id === currentUser.id

              return (
                <tr
                  key={user.id}
                  className="group border-b border-gray-50 last:border-0 hover:bg-red-50/40 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0 group-hover:bg-red-600 transition-colors">
                        <span className="text-white text-[12px] font-bold">{initials}</span>
                      </div>
                      <span className="text-[14px] font-semibold text-black">
                        {user.name}
                        {isSelf && <span className="ml-2 text-[11px] font-medium text-gray-400">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.contact ? (
                      <span className="text-[13px] text-gray-600">{user.contact}</span>
                    ) : (
                      <span className="text-[13px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${
                        ROLE_STYLES[user.role] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <EditUserModal user={user} isSelf={isSelf} />
                      <DeleteUserButton userId={user.id} userName={user.name} disabled={isSelf} />
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