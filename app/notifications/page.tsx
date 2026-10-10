import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { loadNotifications } from '@/utils/notifications'

export const dynamic = 'force-dynamic'

const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value))

const statusClass = {
  'Action needed': 'bg-red-50 text-red-800',
  Upcoming: 'bg-gray-100 text-gray-800',
  Update: 'bg-blue-50 text-blue-800',
} as const

export default async function NotificationsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const result = await loadNotifications({ id: currentUser.id, role: currentUser.role })

  return (
    <DashboardShell title="Notifications" currentUser={currentUser}>
      <div className="w-full space-y-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">Latest notifications</h2>
          <p className="mt-1 text-sm text-gray-700">
            {currentUser.role === 'head_coach'
              ? 'Payment issues, attendance gaps, schedule coverage requests, and recent student progress updates.'
              : 'Your upcoming classes, attendance tasks, and time-away report updates.'}
          </p>
        </header>

        {result.error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load notifications: {result.error}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse bg-white text-left text-sm text-gray-950">
              <thead className="border-b border-gray-200 bg-white">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-800">Notification</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-800">Type</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-800">Status</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-800">Date</th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-800">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {result.notifications.map((notification) => (
                  <tr key={notification.id} className="bg-white transition-none hover:bg-white">
                    <td className="max-w-[520px] px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-950">{notification.title}</p>
                      <p className="mt-0.5 text-[13px] text-gray-700">{notification.detail}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-800">{notification.category}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[notification.status]}`}>
                        {notification.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-700">{dateTime(notification.date)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={notification.href} className="text-sm font-semibold text-gray-950 underline underline-offset-4">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {result.notifications.length === 0 && (
                  <tr className="bg-white transition-none hover:bg-white">
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-700">You’re all caught up. New notifications will appear here when there is something to review.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
