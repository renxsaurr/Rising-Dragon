import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/utils/getCurrentUser'

export default async function RootPage() {
  const currentUser = await getCurrentUser()

  if (currentUser) {
      redirect('/students')
  } else {
    redirect('/login')
  }
}