'use client'

export async function uploadBranchPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.set('file', file)
  const response = await fetch('/api/branches/photos', { method: 'POST', body: form })
  const result = await response.json() as { photoUrl?: string; error?: string }
  if (!response.ok || !result.photoUrl) throw new Error(result.error ?? 'Photo upload failed.')
  return result.photoUrl
}
