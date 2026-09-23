'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AddUserModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const resetForm = () => {
    setName('')
    setContact('')
    setRole('')
    setError('')
  }

  const closeModal = () => {
    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.from('User').insert({ name, contact, role })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    closeModal()
    router.refresh()
  }

  const inputClass =
    'w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-black placeholder:text-gray-400 outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all'

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v8M8 12h8" />
        </svg>
        Add User
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-7 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-5 right-5 text-gray-400 hover:text-black text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-[17px] font-semibold text-black mb-5">Add New User</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-medium text-gray-700 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter full name"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-gray-700 mb-1.5 block">Contact</label>
                  <input
                    type="tel"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    placeholder="Enter contact number"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-medium text-gray-700 mb-1.5 block">Role</label>
                  <div className="relative">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                      className={`${inputClass} appearance-none bg-white pr-9 ${role === '' ? 'text-gray-400' : ''}`}
                    >
                      <option value="" disabled>Select role</option>
                      <option value="assistant_coach">Assistant Coach</option>
                      <option value="head_coach">Head Coach</option>
                    </select>
                    <svg
                      className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-[13px] text-red-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  {loading ? 'Creating…' : 'Create User'}
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