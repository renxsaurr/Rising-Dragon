'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUser } from '@/app/users/actions'

type Branch = { id: number; name: string }

export default function AddUserModal({ branches }: { branches: Branch[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<'head_coach' | 'assistant_coach'>('assistant_coach')
  const [branchId, setBranchId] = useState('')
  const router = useRouter()

  const resetForm = () => {
    setName('')
    setEmail('')
    setPassword('')
    setContact('')
    setRole('assistant_coach')
    setBranchId('')
    setError('')
  }

  const closeModal = () => {
    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await createUser({
      name,
      email,
      password,
      contact,
      role,
      home_branch_id: branchId ? Number(branchId) : null,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    closeModal()
    router.refresh()
  }

  const inputClass = 'w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10'

  return (
    <>
<<<<<<< HEAD
      <button onClick={() => setIsOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">
        <span aria-hidden="true">+</span> Add user
=======
      <button
        onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-2 bg-black hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v8M8 12h8" />
        </svg>
        Add User
>>>>>>> 5fdc5c3fd17b6095824860e67ee2dd26ef9bfdb3
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-user-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <button type="button" onClick={closeModal} aria-label="Close" className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black">×</button>
            <h2 id="add-user-title" className="text-lg font-semibold text-gray-950">Create staff account</h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">The coach can sign in with this email and temporary password.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-medium text-gray-700">Full name
                <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-medium text-gray-700">Login email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-medium text-gray-700">Temporary password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" className={`${inputClass} mt-1.5`} />
                <span className="mt-1 block font-normal text-gray-400">At least 8 characters. Share it with the coach securely.</span>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-700">Contact
                  <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block text-xs font-medium text-gray-700">Role
                  <select value={role} onChange={(event) => setRole(event.target.value as 'head_coach' | 'assistant_coach')} className={`${inputClass} mt-1.5 bg-white`}>
                    <option value="assistant_coach">Assistant Coach</option>
                    <option value="head_coach">Head Coach</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-700">Home branch <span className="font-normal text-gray-400">(optional)</span>
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className={`${inputClass} mt-1.5 bg-white`}>
                  <option value="">No home branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>

              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{loading ? 'Creating…' : 'Create account'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
