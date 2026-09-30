'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUser } from '@/app/users/actions'

type Branch = { id: number; name: string }

export default function AddUserModal({ branches }: { branches: Branch[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState('')
  const [branchId, setBranchId] = useState('')
  const router = useRouter()

  const resetForm = () => {
    setFirstName('')
    setMiddleName('')
    setLastName('')
    setEmail('')
    setContact('')
    setBranchId('')
    setError('')
    setTemporaryPassword('')
    setCopied(false)
  }

  const closeModal = () => {
    if (loading) return
    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setTemporaryPassword('')
    setCopied(false)
    const result = await createUser({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email,
      contact,
      primary_branch_id: branchId ? Number(branchId) : null,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if ('temporaryPassword' in result && result.temporaryPassword) {
      setTemporaryPassword(result.temporaryPassword)
    }
    router.refresh()
  }

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
    } catch {
      setError('Could not copy automatically. Select and copy the password manually.')
    }
  }

  const inputClass = 'w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10'

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">
        <span aria-hidden="true">+</span> Add user
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="add-user-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <button type="button" onClick={closeModal} disabled={loading} aria-label="Close" className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50">×</button>
            <h2 id="add-user-title" className="text-lg font-semibold text-gray-950">{temporaryPassword ? 'Assistant Coach account created' : 'Create staff account'}</h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">{temporaryPassword ? 'Copy this temporary password now and share it directly with the coach.' : 'Create an Assistant Coach login. The Head Coach account is managed separately.'}</p>

            {temporaryPassword ? (
              <div className="space-y-4">
                <label className="block text-xs font-medium text-gray-700">Temporary password
                  <input readOnly value={temporaryPassword} type="text" className={`${inputClass} mt-1.5 font-mono`} onFocus={(event) => event.currentTarget.select()} />
                </label>
                <p className="text-xs text-gray-500">This password is displayed only in this confirmation. Give it to the Assistant Coach through a private channel.</p>
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Done</button>
                  <button type="button" onClick={copyTemporaryPassword} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">{copied ? 'Copied' : 'Copy password'}</button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block text-xs font-medium text-gray-700">First name
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoComplete="given-name" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block text-xs font-medium text-gray-700">Middle name <span className="font-normal text-gray-400">(optional)</span>
                  <input value={middleName} onChange={(event) => setMiddleName(event.target.value)} autoComplete="additional-name" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block text-xs font-medium text-gray-700">Last name
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} required autoComplete="family-name" className={`${inputClass} mt-1.5`} />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-700">Login email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-medium text-gray-700">Contact number
                <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} required autoComplete="tel" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-medium text-gray-700">Primary branch <span className="font-normal text-gray-400">(optional)</span>
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className={`${inputClass} mt-1.5 bg-white`}>
                  <option value="">No primary branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>

              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={loading} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{loading ? 'Creating…' : 'Create account'}</button>
              </div>
            </form>
            )}
          </section>
        </div>
      )}
    </>
  )
}
