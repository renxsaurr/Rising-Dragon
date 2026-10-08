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

  const { data: profile, error } = await supabase
    .from('user')
    .select('id, first_name, middle_name, last_name, contact, role, primary_branch_id')
    .eq('auth_id', authUser.id)
    .maybeSingle()

  if (error || !profile) {
    return null
  }

  // Keep the application's supported roles explicit. Pages and Server Actions
  // use this helper as their authorization boundary, so an unknown role must
  // never be treated as a signed-in staff member.
  if (profile.role !== 'head_coach' && profile.role !== 'assistant_coach') {
    return null
  }

  const name = [
    profile.first_name,
    profile.middle_name,
    profile.last_name,
  ].filter(Boolean).join(' ')

  return {
    ...profile,
    name,
  }
}
