'use server'

import { getCurrentUser } from '@/utils/getCurrentUser'
import { loadNotifications } from '@/utils/notifications'

export async function getHeaderNotifications() {
  const user = await getCurrentUser()
  if (!user) return { notifications: [], error: 'You must be signed in to view notifications.' }

  return loadNotifications({ id: user.id, role: user.role })
}
