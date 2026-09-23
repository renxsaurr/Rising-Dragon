import { createClient } from '@/utils/supabase/server'
import { hasSupabaseConfig } from '@/utils/supabase/config'
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  if (!hasSupabaseConfig) {
    return null
  }

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }
  if (authUser.banned_until && Date.parse(authUser.banned_until) > Date.now()) {
    return null
  }

  const { data: profile } = await supabase
    .from('user')
    .select('id, name, role, home_branch_id')
    .eq('auth_id', authUser.id)
    .single()

  return profile
}
