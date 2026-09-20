'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Branch = {
  id: number
  name: string
}

export default function AddStudentModal({ branches }: { branches: Branch[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [guardianContact, setGuardianContact] = useState('')
  const [beltLevel, setBeltLevel] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState('')
  const [branchId, setBranchId] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const resetForm = () => {
    setName('')
    setGuardianContact('')
    setBeltLevel('')
    setEnrollmentDate('')
    setBranchId('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.from('Student').insert({
      name,
      guardian_contact: guardianContact,
      belt_level: beltLevel,
      enrollment_date: enrollmentDate,
      branch_id: Number(branchId),
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    resetForm()
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-black hover:bg-red-600 text-white text-[14px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        + Add Student
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-7 relative">

            <button
              onClick={() => {
                setIsOpen(false)
                resetForm()
              }}
              className="absolute top-5 right-5 text-gray-400 hover:text-black text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-[20px] font-semibold text-black mb-1">Add Student</h2>
            <p className="text-[13px] text-gray-500 mb-6">Enter the student's details below.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Full Name
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
                  Guardian Contact
                </label>
                <input
                  type="text"
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                    Belt Level
                  </label>
                  <input
                    type="text"
                    value={beltLevel}
                    onChange={(e) => setBeltLevel(e.target.value)}
                    placeholder="e.g. Yellow Belt"
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                    Enrollment Date
                  </label>
                  <input
                    type="date"
                    value={enrollmentDate}
                    onChange={(e) => setEnrollmentDate(e.target.value)}
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">
                  Branch
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all bg-white"
                >
                  <option value="" disabled>Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

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
                {loading ? 'Adding…' : 'Add Student'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}