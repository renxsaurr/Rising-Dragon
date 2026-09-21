import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'

export default async function AttendancePage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  const today = new Date().toISOString().split('T') [0]

  const {data: sessions, error} = await supabase 
  .from('ClassSchedule')
  .select('id, date, time_start, time_end, Branch(name), User(name)')
  .eq('date', today)
  .order('time_start', {ascending: true})

  if(error) {
    return (
      <DashboardShell title= "Attendance" currentUser={currentUser}>
        <p className = "text-red-600 text-sm">
            Something went wrong: {error.message}
        </p>
      </DashboardShell>
    )
  }
}