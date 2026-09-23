'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { uploadBranchPhoto } from '@/utils/uploadBranchPhoto'

export default function AddBranchModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')

  // -- photo upload state --
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // -- upload photo first if one was picked --
    let photoUrl: string | null = null
    if (photoFile) {
      try {
        photoUrl = await uploadBranchPhoto(photoFile)
      } catch (uploadErr: any) {
        setLoading(false)
        setError('Photo upload failed: ' + uploadErr.message)
        return
      }
    }

    const { error } = await supabase.from('branch').insert({
      name,
      address,
      description: description || null,
      photo_url: photoUrl,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setAddress('')
    setDescription('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        + Add Branch
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

            <h2 className="text-[20px] font-semibold text-black mb-1">Add Branch</h2>
            <p className="text-[13px] text-gray-500 mb-6">Enter the new branch's details.</p>

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

              {/* --- photo upload field --- */}
              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Photo <span className="text-gray-400">(optional)</span>
                </label>

                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg mb-2 border border-gray-200"
                  />
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full text-[13px] text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[13px] file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              {/* --- end photo upload field --- */}

              {error && (
                <p className="text-[13px] text-red-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[14px] font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Adding…' : 'Add Branch'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
