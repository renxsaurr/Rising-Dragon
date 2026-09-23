'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { uploadBranchPhoto } from '@/utils/uploadBranchPhoto'

type Branch = {
  id: number
  name: string
  address: string
  description?: string | null
  photo_url?: string | null
}

export default function EditBranchModal({ branch }: { branch: Branch }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(branch.name)
  const [address, setAddress] = useState(branch.address)
  const [description, setDescription] = useState(branch.description ?? '')

  // -- photo state --
  // currentPhotoUrl: what's saved in the DB right now (or null if removed)
  // photoFile: a NEW file the user picked (not uploaded yet)
  // photoPreview: local preview — either the new file, or the existing photo
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(branch.photo_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(branch.photo_url ?? null)

   const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    setError('')
    setDeleting(true)

    // safety check — block delete if students or schedules still reference this branch
    const { count: studentCount } = await supabase
      .from('Student')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branch.id)

    const { count: scheduleCount } = await supabase
      .from('ClassSchedule')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branch.id)

    if ((studentCount ?? 0) > 0 || (scheduleCount ?? 0) > 0) {
      setDeleting(false)
      setError(
        `Can't delete: this branch still has ${studentCount ?? 0} student(s) and ${scheduleCount ?? 0} schedule(s). Move or remove them first.`
      )
      return
    }

    const { error: deleteError } = await supabase
      .from('Branch')
      .delete()
      .eq('id', branch.id)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    router.push('/branches')
    router.refresh()
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setCurrentPhotoUrl(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // decide the final photo_url to save:
    // - if a new file was picked, upload it and use that URL
    // - else if photo was removed, save null
    // - else keep the existing photo_url unchanged
    let finalPhotoUrl: string | null = currentPhotoUrl

    if (photoFile) {
      try {
        finalPhotoUrl = await uploadBranchPhoto(photoFile)
      } catch (uploadErr: any) {
        setLoading(false)
        setError('Photo upload failed: ' + uploadErr.message)
        return
      }
    }

    const { error } = await supabase
      .from('Branch')
      .update({
        name,
        address,
        description: description || null,
        photo_url: finalPhotoUrl,
      })
      .eq('id', branch.id)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white hover:bg-gray-100 text-black border border-gray-200 text-[14px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        Edit Branch
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-7 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-black text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-[20px] font-semibold text-black mb-1">Edit Branch</h2>
            <p className="text-[13px] text-gray-500 mb-6">Update this branch's details.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all resize-none"
                  placeholder="A short note about this branch..."
                />
              </div>

              {/* --- photo field --- */}
              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Photo <span className="text-gray-400">(optional)</span>
                </label>

                {photoPreview && (
                  <div className="relative mb-2">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white text-[11px] px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                )}

                                <label className="flex items-center gap-3 w-full h-11 px-4 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                  <span className="bg-black text-white text-[12px] font-semibold px-3 py-1.5 rounded-md shrink-0">
                    Choose File
                  </span>
                  <span className="text-[13px] text-gray-500 truncate">
                    {photoFile ? photoFile.name : 'No file chosen'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>
              {/* --- end photo field --- */}

              {error && (
                <p className="text-[13px] text-red-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  {error}
                </p>
              )}

                            <button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full bg-black hover:bg-red-600 disabled:opacity-60 text-white text-[14px] font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </form>

                         {/* --- delete button (opens confirm popup) --- */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setConfirmDelete(true)}
                className="h-9 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-[13px] font-semibold transition-colors"
              >
                Delete this branch
              </button>
            </div>
            {/* --- end delete button --- */}

            {/* --- delete confirmation popup --- */}
            {confirmDelete && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                  <p className="text-[12px] font-bold text-red-700 uppercase tracking-wide mb-1">
                    Danger Zone
                  </p>
                  <h3 className="text-[17px] font-semibold text-black mb-2">
                    Delete "{branch.name}"?
                  </h3>
                  <p className="text-[13px] text-gray-500 mb-5">
                    This is permanent and can't be undone. Branches with students or schedules attached can't be deleted.
                  </p>

                  {error && (
                    <p className="text-[13px] text-red-600 mb-4">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirmDelete(false)
                        setError('')
                      }}
                      className="flex-1 h-10 border border-gray-200 rounded-lg text-[13px] font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-[13px] font-semibold"
                    >
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* --- end delete confirmation popup --- */}

          </div>
        </div>
      )}
    </>
  )
}