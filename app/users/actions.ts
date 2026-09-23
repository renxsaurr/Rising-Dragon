'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'

type CoachRole = 'head_coach' | 'assistant_coach'

async function requireHeadCoach() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage users.' as const }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage users.' as const }
  return { currentUser }
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  contact: string
  role: CoachRole
  home_branch_id: number | null
}) {
  const access = await requireHeadCoach()
  if ('error' in access) return access

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const contact = input.contact.trim()
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a name and valid email address.' }
  if (input.password.length < 8) return { error: 'Use a temporary password with at least 8 characters.' }
  if (!['head_coach', 'assistant_coach'].includes(input.role)) return { error: 'Select a valid role.' }
  if (input.home_branch_id !== null && !Number.isInteger(input.home_branch_id)) return { error: 'Select a valid home branch.' }

  const admin = createAdminClient()
  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (authError || !authResult.user) return { error: authError?.message ?? 'Could not create the login account.' }

  const { error: profileError } = await admin.from('user').insert({
    name,
    contact: contact || null,
    role: input.role,
    home_branch_id: input.home_branch_id,
    auth_id: authResult.user.id,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authResult.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/users')
  return { success: true }
}

export async function updateUser(userId: number, data: {
  name: string
  contact: string
  role: CoachRole
  home_branch_id: number | null
}) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isInteger(userId) || !data.name.trim()) return { error: 'Enter a valid user name.' }
  if (!['head_coach', 'assistant_coach'].includes(data.role)) return { error: 'Select a valid role.' }
  if (data.home_branch_id !== null && !Number.isInteger(data.home_branch_id)) return { error: 'Select a valid home branch.' }

  const admin = createAdminClient()
  const { data: target, error: lookupError } = await admin
    .from('user')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  if (lookupError || !target) return { error: 'User profile not found.' }
  if (target.id === access.currentUser.id && data.role !== 'head_coach') {
    return { error: 'You cannot change your own role.' }
  }

  if (target.role === 'head_coach' && data.role !== 'head_coach') {
    const { count, error } = await admin.from('user').select('id', { count: 'exact', head: true }).eq('role', 'head_coach')
    if (error) return { error: error.message }
    if ((count ?? 0) <= 1) return { error: 'Keep at least one Head Coach account active.' }
  }

  const { error } = await admin.from('user').update({
    name: data.name.trim(),
    contact: data.contact.trim() || null,
    role: data.role,
    home_branch_id: data.home_branch_id,
  }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true }
}

export async function setUserActive(userId: number, active: boolean) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isInteger(userId)) return { error: 'User profile not found.' }
  if (userId === access.currentUser.id) return { error: 'You cannot deactivate your own account.' }

  const admin = createAdminClient()
  const { data: target, error: lookupError } = await admin
    .from('user')
    .select('id, auth_id, role')
    .eq('id', userId)
    .maybeSingle()
  if (lookupError || !target) return { error: 'User profile not found.' }

  if (!active && target.role === 'head_coach') {
    const { count, error } = await admin.from('user').select('id', { count: 'exact', head: true }).eq('role', 'head_coach')
    if (error) return { error: error.message }
    if ((count ?? 0) <= 1) return { error: 'Keep at least one Head Coach account active.' }
  }

  const { error } = await admin.auth.admin.updateUserById(target.auth_id, {
    ban_duration: active ? 'none' : '876000h',
  })
  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true }
}
