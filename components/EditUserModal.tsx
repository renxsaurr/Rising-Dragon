'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'

import { updateUser } from '@/app/users/actions'

type User = {
  id: number
  name: string
  contact: string | null
  role: string
}

type EditUserModalProps = {
  user: User
  isSelf?: boolean
}

export default function EditUserModal({
  user,
  isSelf = false,
}: EditUserModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [name, setName] = useState(user.name)
  const [contact, setContact] = useState(user.contact ?? '')
  const [role, setRole] = useState(user.role)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()

  const resetForm = () => {
    setName(user.name)
    setContact(user.contact ?? '')
    setRole(user.role)
    setError('')
  }

  const openModal = () => {
    resetForm()
    setIsOpen(true)
  }

  const closeModal = () => {
    if (loading) return

    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    const result = await updateUser(user.id, {
      name: name.trim(),
      contact: contact.trim(),
      role,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    setIsOpen(false)

    router.refresh()
  }

  return (
    <>
      {/* EDIT ICON */}
      <button
        type="button"
        onClick={openModal}
        title="Edit user"
        aria-label={`Edit ${user.name}`}
        className="p-2 text-black hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Pencil
          size={20}
          strokeWidth={2}
        />
      </button>

      {/* EDIT MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">

            {/* Close */}
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              aria-label="Close"
              className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="px-7 pt-7 pb-4">
              <h2 className="text-[18px] font-semibold text-black">
                Edit User
              </h2>

              <p className="mt-1 text-[12px] text-gray-500">
                Update the user's information below.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="px-7 pb-7"
            >

              {/* Name */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Enter full name"
                  required
                  disabled={loading}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black outline-none focus:border-black transition-colors disabled:bg-gray-50"
                />
              </div>

              {/* Contact */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Contact
                </label>

                <input
                  type="text"
                  value={contact}
                  onChange={(e) =>
                    setContact(e.target.value)
                  }
                  placeholder="Enter contact number"
                  disabled={loading}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black outline-none focus:border-black transition-colors disabled:bg-gray-50"
                />
              </div>

              {/* Role */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Role
                </label>

                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value)
                  }
                  required
                  disabled={loading || isSelf}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg bg-white text-[13px] text-black outline-none focus:border-black transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="head_coach">
                    Head Coach
                  </option>

                  <option value="assistant_coach">
                    Assistant Coach
                  </option>
                </select>

                {isSelf && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    You cannot change your own role.
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                  <p className="text-[12px] text-red-600">
                    {error}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="h-10 px-5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 bg-black text-white rounded-lg text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}