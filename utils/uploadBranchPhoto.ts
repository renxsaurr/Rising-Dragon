import { createClient } from '@/utils/supabase/client'

// uploads a branch photo file to Supabase Storage and returns its public URL
export async function uploadBranchPhoto(file: File): Promise<string> {
  const supabase = createClient()

  // build a unique file path so photos don't overwrite each other by accident
  // e.g. "1695450000000-my-photo.jpg"
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('branch-photos')
    .upload(fileName, file)

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  // get the public URL for the file we just uploaded
  const { data } = supabase.storage
    .from('branch-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}