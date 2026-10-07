'use server'

import { revalidatePath } from 'next/cache'
import { dateInTimeZone } from '@/utils/dates'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createAdminClient } from '@/utils/supabase/admin'

const BUCKET = 'branch-photos'

async function requireHeadCoach() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Please sign in to manage branches.' as const }
  if (user.role !== 'head_coach') return { error: 'Only the Head Coach can manage branches.' as const }
  return { user }
}

function cleanBranchInput(input: { name: unknown; address: unknown; description?: unknown }) {
  const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  const address = typeof input?.address === 'string' ? input.address.trim().replace(/\s+/g, ' ') : ''
  const description = typeof input?.description === 'string' ? input.description.trim() || null : null
  if (!name || !address) return { error: 'Branch name and address are required.' as const }
  if (name.length > 120 || address.length > 250 || (description?.length ?? 0) > 1000) {
    return { error: 'Branch name, address, or description is too long.' as const }
  }
  return { value: { name, address, description } }
}

function photoPathFromUrl(url: string | null) {
  if (!url) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const parsed = new URL(url)
    const expected = new URL(base)
    const prefix = `/storage/v1/object/public/${BUCKET}/`
    if (parsed.origin !== expected.origin || !parsed.pathname.startsWith(prefix)) return null
    return decodeURIComponent(parsed.pathname.slice(prefix.length)) || null
  } catch {
    return null
  }
}

async function removePhoto(url: string | null) {
  const path = photoPathFromUrl(url)
  if (!path) return
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path])
  if (error) console.error('Could not remove old branch photo:', error.message)
}

async function rollbackPhoto(url: string | null) {
  const path = photoPathFromUrl(url)
  if (!path) return
  await createAdminClient().storage.from(BUCKET).remove([path])
}

function photoUrlIsAllowed(url: string | null) {
  return url === null || photoPathFromUrl(url) !== null
}

function refreshBranchViews() {
  revalidatePath('/branches')
  revalidatePath('/branches/[id]', 'page')
  revalidatePath('/students')
  revalidatePath('/scheduling')
  revalidatePath('/users')
  revalidatePath('/dashboard')
}

export async function createBranch(input: { name: string; address: string; description: string | null; photoUrl: string | null }) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!input || typeof input !== 'object') return { error: 'Branch details are invalid.' }
  const cleaned = cleanBranchInput(input)
  if ('error' in cleaned) {
    await rollbackPhoto(input.photoUrl)
    return cleaned
  }
  if (!photoUrlIsAllowed(input.photoUrl)) {
    await rollbackPhoto(input.photoUrl)
    return { error: 'The branch photo is invalid.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('branch').insert({ ...cleaned.value, photo_url: input.photoUrl })
  if (error) {
    await rollbackPhoto(input.photoUrl)
    return { error: error.code === '23505' ? 'An active branch already uses that name.' : error.message }
  }
  refreshBranchViews()
  return { success: true }
}

export async function updateBranch(branchId: number, input: { name: string; address: string; description: string | null; photoUrl: string | null }) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isSafeInteger(branchId) || branchId <= 0) return { error: 'Branch not found.' }
  if (!input || typeof input !== 'object') return { error: 'Branch details are invalid.' }
  const admin = createAdminClient()
  const { data: existing, error: lookupError } = await admin.from('branch').select('id, photo_url').eq('id', branchId).maybeSingle()
  if (lookupError || !existing) {
    if (input.photoUrl !== existing?.photo_url) await rollbackPhoto(input.photoUrl)
    return { error: lookupError?.message ?? 'Branch not found.' }
  }
  const cleaned = cleanBranchInput(input)
  if ('error' in cleaned) {
    if (input.photoUrl !== existing.photo_url) await rollbackPhoto(input.photoUrl)
    return cleaned
  }
  if (input.photoUrl !== existing.photo_url && !photoUrlIsAllowed(input.photoUrl)) {
    if (input.photoUrl !== existing.photo_url) await rollbackPhoto(input.photoUrl)
    return { error: 'The branch photo is invalid.' }
  }
  const { data, error } = await admin.from('branch').update({ ...cleaned.value, photo_url: input.photoUrl }).eq('id', branchId).select('id').maybeSingle()
  if (error || !data) {
    if (input.photoUrl !== existing.photo_url) await rollbackPhoto(input.photoUrl)
    return { error: error?.code === '23505' ? 'An active branch already uses that name.' : error?.message ?? 'Branch could not be updated.' }
  }
  if (existing.photo_url !== input.photoUrl) await removePhoto(existing.photo_url)
  refreshBranchViews()
  return { success: true }
}

export async function archiveBranch(branchId: number) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isSafeInteger(branchId) || branchId <= 0) return { error: 'Branch not found.' }

  const admin = createAdminClient()
  const today = dateInTimeZone()
  const checks = await Promise.all([
    admin.from('student').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('is_active', true),
    admin.from('class_schedule').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).gte('date', today).not('status', 'in', '(Cancelled,Draft)'),
    admin.from('weekly_class_template').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('is_active', true).or(`active_until.is.null,active_until.gte.${today}`),
  ])
  const failedCheck = checks.find((result) => result.error)
  if (failedCheck?.error) return { error: `Could not verify branch dependencies: ${failedCheck.error.message}` }
  const [students, schedules, templates] = checks.map((result) => result.count ?? 0)
  if (students || schedules || templates) {
    const blockers = [
      students ? `${students} active student${students === 1 ? '' : 's'}: move or archive them` : '',
      schedules ? `${schedules} upcoming class${schedules === 1 ? '' : 'es'}: cancel or reassign them` : '',
      templates ? `${templates} active weekly schedule${templates === 1 ? '' : 's'}: end or reassign them` : '',
    ].filter(Boolean)
    return { error: `This branch still has ${blockers.join('; ')} before it can be archived.` }
  }

  const { data, error } = await admin.from('branch').update({ is_active: false }).eq('id', branchId).eq('is_active', true).select('id').maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Branch not found or already archived.' }
  refreshBranchViews()
  return { success: true }
}

export async function reactivateBranch(branchId: number) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isSafeInteger(branchId) || branchId <= 0) return { error: 'Branch not found.' }
  const admin = createAdminClient()
  const { data, error } = await admin.from('branch').update({ is_active: true }).eq('id', branchId).eq('is_active', false).select('id').maybeSingle()
  if (error) return { error: error.code === '23505' ? 'Another active branch already uses this name.' : error.message }
  if (!data) return { error: 'Branch not found or already active.' }
  refreshBranchViews()
  return { success: true }
}

export async function deleteUnusedBranch(branchId: number) {
  const access = await requireHeadCoach()
  if ('error' in access) return access
  if (!Number.isSafeInteger(branchId) || branchId <= 0) return { error: 'Branch not found.' }
  const admin = createAdminClient()
  const { data: branch, error: branchError } = await admin.from('branch').select('id, photo_url').eq('id', branchId).maybeSingle()
  if (branchError || !branch) return { error: branchError?.message ?? 'Branch not found.' }

  const checks = await Promise.all([
    admin.from('student').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    admin.from('class_schedule').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    admin.from('weekly_class_template').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    admin.from('user').select('id', { count: 'exact', head: true }).eq('primary_branch_id', branchId),
  ])
  const failedCheck = checks.find((result) => result.error)
  if (failedCheck?.error) return { error: `Could not verify branch history: ${failedCheck.error.message}` }
  if (checks.some((result) => (result.count ?? 0) > 0)) {
    return { error: 'This branch has records or staff assignments. Archive it to preserve its history.' }
  }

  const { error } = await admin.from('branch').delete().eq('id', branchId)
  if (error) return { error: error.message }
  await removePhoto(branch.photo_url)
  refreshBranchViews()
  return { success: true }
}
