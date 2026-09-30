'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/utils/getCurrentUser'

async function requireHeadCoach() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Please sign in to manage users.' as const }
  if (currentUser.role !== 'head_coach') return { error: 'Only the Head Coach can manage users.' as const }
  return { currentUser }
}

function generateTemporaryPassword() {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*_-',
  ]
  const allCharacters = groups.join('')
  const characters = groups.map((group) => group[randomInt(group.length)])
  while (characters.length < 16) characters.push(allCharacters[randomInt(allCharacters.length)])
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]]
  }
  return characters.join('')
}

export async function createUser(input: {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  contact: string
  primary_branch_id: number | null
}) {
  const access = await requireHeadCoach()
  if ('error' in access) return access

  const first_name = input.first_name.trim()
  const middle_name = input.middle_name.trim() || null
  const last_name = input.last_name.trim()
  const name = [first_name, middle_name, last_name].filter(Boolean).join(' ')
  const email = input.email.trim().toLowerCase()
  const contact = input.contact.trim()
  if (!first_name || !last_name || !contact || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: 'Enter first and last name, a contact number, and a valid email address.' }
  }
  if (input.primary_branch_id !== null && !Number.isInteger(input.primary_branch_id)) return { error: 'Select a valid primary branch.' }

  const temporaryPassword = generateTemporaryPassword()
  const admin = createAdminClient()
  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { name, first_name, middle_name, last_name },
  })
  if (authError || !authResult.user) return { error: authError?.message ?? 'Could not create the login account.' }

  const { error: profileError } = await admin.from('user').insert({
    first_name,
    middle_name,
    last_name,
    contact,
    role: 'assistant_coach',
    primary_branch_id: input.primary_branch_id,
    auth_id: authResult.user.id,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authResult.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/users')
  return { success: true, temporaryPassword }
}

export async function updateUser(userId: number, data: {
  first_name: string
  middle_name: string
  last_name: string
  contact: string
  primary_branch_id: number | null
}) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  const first_name = data.first_name.trim()
  const middle_name = data.middle_name.trim() || null
  const last_name = data.last_name.trim()
  const contact = data.contact.trim()
  if (!Number.isInteger(userId) || !first_name || !last_name || !contact) {
    return { error: 'Enter first and last name and a contact number.' }
  }
  if (data.primary_branch_id !== null && !Number.isInteger(data.primary_branch_id)) return { error: 'Select a valid primary branch.' }

  const admin = createAdminClient()
  const { data: updatedUser, error } = await admin.from('user').update({
    first_name,
    middle_name,
    last_name,
    contact,
    primary_branch_id: data.primary_branch_id,
  }).eq('id', userId).select('id').maybeSingle()
  if (error) return { error: error.message }
  if (!updatedUser) return { error: 'User profile not found.' }

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
