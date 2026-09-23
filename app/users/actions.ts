'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '../../utils/supabase/admin'
/**
 * Update an existing user
 */
export async function updateUser(
  userId: string,
  data: {
    name: string
    contact: string
    role: string
  }
) {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    // Check the currently logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        error: 'You must be logged in.',
      }
    }

    // Get the current user's profile
    const { data: currentUser, error: currentUserError } =
      await supabase
        .from('User')
        .select('id, role')
        .eq('auth_id', user.id)
        .single()

    if (currentUserError || !currentUser) {
      return {
        error: 'Unable to verify your account.',
      }
    }

    // Only Head Coaches can manage users
    if (currentUser.role !== 'head_coach') {
      return {
        error: 'Only Head Coaches can update users.',
      }
    }

    // Prevent invalid roles
    if (!['head_coach', 'assistant_coach'].includes(data.role)) {
      return {
        error: 'Invalid user role.',
      }
    }

    // Update the user
    const { error } = await supabase
      .from('User')
      .update({
        name: data.name.trim(),
        contact: data.contact.trim(),
        role: data.role,
      })
      .eq('id', userId)

    if (error) {
      return {
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('updateUser error:', error)

    return {
      error: 'Something went wrong while updating the user.',
    }
  }
}


/**
 * Delete an existing user
 */
export async function deleteUser(userId: string) {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    // Check logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        error: 'You must be logged in.',
      }
    }

    // Get current user's profile
    const { data: currentUser, error: currentUserError } =
      await supabase
        .from('User')
        .select('id, role')
        .eq('auth_id', user.id)
        .single()

    if (currentUserError || !currentUser) {
      return {
        error: 'Unable to verify your account.',
      }
    }

    // Only Head Coaches can delete users
    if (currentUser.role !== 'head_coach') {
      return {
        error: 'Only Head Coaches can delete users.',
      }
    }

    // Prevent deleting yourself
    if (currentUser.id === userId) {
      return {
        error: 'You cannot delete your own account.',
      }
    }

    // Get the user being deleted
    const { data: profile, error: profileError } =
      await supabase
        .from('User')
        .select('id, auth_id')
        .eq('id', userId)
        .single()

    if (profileError || !profile) {
      return {
        error: 'User not found.',
      }
    }

    // Delete the User table record first
    const { error: deleteError } = await supabase
      .from('User')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      return {
        error: deleteError.message,
      }
    }

    // If the user has a Supabase Auth account,
    // remove that account as well.
    if (profile.auth_id) {
      const admin = createAdminClient()

      const { error: authError } =
        await admin.auth.admin.deleteUser(profile.auth_id)

      if (authError) {
        console.error('Auth deletion error:', authError)

        return {
          error:
            'The user profile was deleted, but the login account could not be deleted.',
        }
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('deleteUser error:', error)

    return {
      error: 'Something went wrong while deleting the user.',
    }
  }
}