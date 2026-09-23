'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUser } from '@/app/users/actions'

type User = {
  id: number
  name: string
  contact: string | null
  role: string
  home_branch_id: number | null
}

type EditUserModalProps = {
  user: User
  isSelf?: boolean
  branches: { id: number; name: string }[]
}

export default function EditUserModal({
  user,
  isSelf = false,
  branches,
}: EditUserModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [name, setName] = useState(user.name)
  const [contact, setContact] = useState(user.contact ?? '')
  const [role, setRole] = useState(user.role)
  const [branchId, setBranchId] = useState(user.home_branch_id ? String(user.home_branch_id) : '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const resetForm = () => {
    setName(user.name)
    setContact(user.contact ?? '')
    setRole(user.role)
    setBranchId(user.home_branch_id ? String(user.home_branch_id) : '')
    setError('')
  }

  const closeModal = () => {
    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    const result = await updateUser(user.id, {
      name,
      contact,
      role: role as 'head_coach' | 'assistant_coach',
      home_branch_id: branchId ? Number(branchId) : null,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    closeModal()
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 text-[12px] font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
      >
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-7">

            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-5 right-5 text-gray-400 hover:text-black text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>

            {/* Title */}
            <h2 className="text-[17px] font-semibold text-black mb-5">
              Edit User
            </h2>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >

              {/* Full Name */}
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  required
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Home branch</label>
                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black bg-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                >
                  <option value="">No home branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Contact
                </label>

                <input
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Enter contact number"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Role
                </label>

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  disabled={isSelf}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black bg-white outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="head_coach">
                    Head Coach
                  </option>

                  <option value="assistant_coach">
                    Assistant Coach
                  </option>
                </select>

                {isSelf && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    You cannot change your own role.
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-[13px] text-red-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  {error}
                </p>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 mt-2">

                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 px-5 border border-gray-200 hover:bg-gray-50 text-[13px] font-semibold text-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}
