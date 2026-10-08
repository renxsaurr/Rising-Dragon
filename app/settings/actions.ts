'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createAdminClient } from '@/utils/supabase/admin'

export async function updateOwnProfile(input: {
  firstName: string
  middleName: string
  lastName: string
  contact: string
}): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentUser()
  if (!profile) return { error: 'Please sign in again to update your account.' }
  if (!input || typeof input !== 'object') return { error: 'Enter your account details.' }

  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : ''
  const middleName = typeof input.middleName === 'string' ? input.middleName.trim() || null : null
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : ''
  const contact = typeof input.contact === 'string' ? input.contact.trim() : ''
  if (!firstName || !lastName || firstName.length > 80 || (middleName?.length ?? 0) > 80 || lastName.length > 80) {
    return { error: 'Enter a first and last name, each no longer than 80 characters.' }
  }
  if (!contact || contact.length > 30 || !/^[+\d(][\d\s().-]{5,29}$/.test(contact)) {
    return { error: 'Enter a valid phone number, up to 30 characters.' }
  }
  const admin = createAdminClient()
  const { data: updated, error } = await admin.from('user').update({
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    contact,
  }).eq('id', profile.id).select('id').maybeSingle()
  if (error) return { error: error.message }
  if (!updated) return { error: 'Your account profile could not be found.' }
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function changeOwnPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentUser()
  if (!profile) return { error: 'Please sign in again to change your password.' }
  if (typeof input?.currentPassword !== 'string' || typeof input?.newPassword !== 'string') {
    return { error: 'Enter your current and new passwords.' }
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 72) {
    return { error: 'Your new password must be between 8 and 72 characters.' }
  }
  if (input.currentPassword === input.newPassword) {
    return { error: 'Choose a new password that differs from your current password.' }
  }

  const supabase = await createClient(await cookies())
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) return { error: 'Could not verify your signed-in account. Please sign in again.' }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  })
  if (verifyError) return { error: 'Your current password is incorrect.' }

  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword })
  if (updateError) return { error: updateError.message }
  return { ok: true }
}
