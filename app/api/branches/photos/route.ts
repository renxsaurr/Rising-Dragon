import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createAdminClient } from '@/utils/supabase/admin'

const BUCKET = 'branch-photos'
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Cross-site upload requests are not allowed.' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to upload a branch photo.' }, { status: 401 })
  if (user.role !== 'head_coach') return NextResponse.json({ error: 'Only the Head Coach can upload branch photos.' }, { status: 403 })

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get('file')
  } catch {
    return NextResponse.json({ error: 'Choose a valid image file.' }, { status: 400 })
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a valid image file.' }, { status: 400 })
  const extension = IMAGE_TYPES.get(file.type)
  if (!extension || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Choose a JPG, PNG, or WebP image up to 5 MB.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const path = `branches/${crypto.randomUUID()}.${extension}`
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return NextResponse.json({ error: `Photo upload failed: ${error.message}` }, { status: 500 })

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ photoUrl: data.publicUrl })
}
