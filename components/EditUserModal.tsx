'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { updateUser } from '@/app/users/actions'

type User = {
  id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  contact: string | null
  role: string
  primary_branch_id: number | null
}

type EditUserModalProps = {
  user: User
  branches: { id: number; name: string }[]
  trigger?: ReactNode
}

export default function EditUserModal({
  user,
  branches,
  trigger,
}: EditUserModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [middleName, setMiddleName] = useState(user.middle_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [contact, setContact] = useState(user.contact ?? '')
  const [branchId, setBranchId] = useState(user.primary_branch_id ? String(user.primary_branch_id) : '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const inputClass = 'w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 disabled:bg-gray-50'

  const resetForm = () => {
    setFirstName(user.first_name ?? '')
    setMiddleName(user.middle_name ?? '')
    setLastName(user.last_name ?? '')
    setContact(user.contact ?? '')
    setBranchId(user.primary_branch_id ? String(user.primary_branch_id) : '')
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
      first_name: firstName.trim(),
      middle_name: middleName.trim(),
      last_name: lastName.trim(),
      contact: contact.trim(),
      primary_branch_id: branchId ? Number(branchId) : null,
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
      {trigger ? <div onClick={openModal}>{trigger}</div> : <button
        type="button"
        onClick={openModal}
        title="Edit user"
        aria-label={`Edit ${[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || 'user'}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-50"
      >
        <Pencil size={14} strokeWidth={2} />
        Edit
      </button>}

      {/* EDIT MODAL */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby={`edit-user-title-${user.id}`} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <button type="button" onClick={closeModal} disabled={loading} aria-label="Close" className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50">×</button>
            <h2 id={`edit-user-title-${user.id}`} className="mb-5 text-lg font-semibold text-gray-950">Edit staff account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block text-xs font-medium text-gray-700"><span className="flex h-8 items-center">First Name</span>
                  <input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" required disabled={loading} autoComplete="given-name" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block text-xs font-medium text-gray-700"><span className="flex h-8 items-center whitespace-nowrap text-[11px]">Middle Name</span>
                  <input type="text" value={middleName} onChange={(event) => setMiddleName(event.target.value)} placeholder="Optional" disabled={loading} autoComplete="additional-name" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block text-xs font-medium text-gray-700"><span className="flex h-8 items-center">Last Name</span>
                  <input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" required disabled={loading} autoComplete="family-name" className={`${inputClass} mt-1.5`} />
                </label>
              </div>

              <label className="block text-xs font-medium text-gray-700">Contact number
                <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Enter contact number" required disabled={loading} autoComplete="tel" className={`${inputClass} mt-1.5`} />
              </label>

              <label className="block text-xs font-medium text-gray-700">Primary branch
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={loading} className={`${inputClass} mt-1.5 bg-white`}>
                  <option value="">No primary branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>

              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-xs font-medium text-gray-700">Role</p>
                <p className="mt-1.5 text-sm font-medium text-gray-950">{user.role === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}</p>
                <p className="mt-0.5 text-xs text-gray-500">The system uses one Head Coach role; other staff accounts are Assistant Coaches.</p>
              </div>

              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={loading} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{loading ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
