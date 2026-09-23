'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveStudent } from '@/app/students/actions'

type Branch = {
  id: number
  name: string
}

type Student = {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  guardian_name: string
  guardian_contact: string | null
  guardian_email: string
  belt_level: string
  enrollment_date: string
  branch_id: number
}

const BELT_LABELS: Record<string, string> = {
  practitioner: 'Practitioner',
  white_belt: 'White Belt',
  low_yellow: 'Low Yellow',
  high_yellow: 'High Yellow',
  low_blue: 'Low Blue',
  high_blue: 'High Blue',
  low_red: 'Low Red',
  high_red: 'High Red',
  low_brown: 'Low Brown',
  high_brown: 'High Brown',
  first_dan_black_belt: '1st Dan Black Belt',
  second_dan_black_belt: '2nd Dan Black Belt',
  third_dan_black_belt: '3rd Dan Black Belt',
  fourth_dan_black_belt: '4th Dan Black Belt',
}

const BELT_LEVELS = Object.entries(BELT_LABELS)

const formatBeltLabel = (belt: string) => BELT_LABELS[belt] ?? belt

export default function StudentModal({
  branches,
  student,
  trigger,
}: {
  branches: Branch[]
  student?: Student
  trigger?: React.ReactNode
}) {
  const isEditMode = Boolean(student)

  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState(student?.first_name ?? '')
  const [middleName, setMiddleName] = useState(student?.middle_name ?? '')
  const [lastName, setLastName] = useState(student?.last_name ?? '')
  const [guardianName, setGuardianName] = useState(student?.guardian_name ?? '')
  const [guardianContact, setGuardianContact] = useState(student?.guardian_contact ?? '')
  const [guardianEmail, setGuardianEmail] = useState(student?.guardian_email ?? '')
  const [beltLevel, setBeltLevel] = useState(student?.belt_level ?? '')
  const [enrollmentDate, setEnrollmentDate] = useState(student?.enrollment_date ?? '')
  const [branchId, setBranchId] = useState(student?.branch_id ? String(student.branch_id) : '')

  const router = useRouter()

  const resetForm = () => {
    if (!isEditMode) {
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setGuardianName('')
      setGuardianContact('')
      setGuardianEmail('')
      setBeltLevel('')
      setEnrollmentDate('')
      setBranchId('')
    }
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      guardian_name: guardianName,
      guardian_contact: guardianContact,
      guardian_email: guardianEmail,
      belt_level: beltLevel,
      enrollment_date: enrollmentDate,
      branch_id: Number(branchId),
    }

    const result = await saveStudent(student?.id ?? null, payload)

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    resetForm()
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          + Enroll Student
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-7 relative max-h-[90vh] overflow-y-auto">

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

            <h2 className="text-[20px] font-semibold text-black mb-1">
              {isEditMode ? 'Edit Student' : 'Add Student'}
            </h2>
            <p className="text-[13px] text-gray-500 mb-6">
              {isEditMode ? "Update the student's details below." : "Enter the student's details below."}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Optional"
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Guardian Name</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Guardian Contact</label>
                  <input
                    type="text"
                    value={guardianContact}
                    onChange={(e) => setGuardianContact(e.target.value)}
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Guardian Email</label>
                  <input
                    type="email"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Belt Level</label>
                  <select
                    value={beltLevel}
                    onChange={(e) => setBeltLevel(e.target.value)}
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all bg-white"
                  >
                    <option value="" disabled>Select belt</option>
                    {BELT_LEVELS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Enrollment Date</label>
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
                <label className="text-[13px] font-medium text-gray-700 mb-1.5 block">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all bg-white"
                >
                  <option value="" disabled>Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
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
                className="mt-2 h-11 w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[14px] font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Student'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
