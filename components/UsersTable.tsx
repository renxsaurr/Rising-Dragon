'use client'

import { useEffect, useMemo, useState } from 'react'

import EditUserModal from '@/components/EditUserModal'
import DeleteUserButton from '@/components/DeleteUserButton'

type User = {
  id: number
  name: string
  contact: string | null
  role: string
}

type Schedule = {
  id: number
  date: string
  time_start: string
  time_end: string
  coach_id: number
}

type UserStatus =
  | 'active'
  | 'deactive'

type UsersTableProps = {
  users: User[]
  schedules: Schedule[]
  currentUserId: number
}

const ROLE_LABELS: Record<string, string> = {
  head_coach: 'Head Coach',
  assistant_coach: 'Assistant Coach',
}

const ROLE_STYLES: Record<string, string> = {
  head_coach:
    'bg-gray-100 text-gray-700',
  assistant_coach:
    'bg-gray-100 text-gray-600',
}

function getManilaDateTime() {
  const formatter =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

  const parts =
    formatter.formatToParts(new Date())

  const values: Record<string, string> = {}

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value
    }
  })

  return {
    date: `${values.year}-${values.month}-${values.day}`,

    minutes:
      Number(values.hour) * 60 +
      Number(values.minute),
  }
}

function timeToMinutes(time: string) {
  const [hours, minutes] =
    time.split(':').map(Number)

  return (
    hours * 60 +
    minutes
  )
}

function getUserStatus(
  userId: number,
  schedules: Schedule[],
): UserStatus {
  const now = getManilaDateTime()

  const userSchedules =
    schedules.filter(
      (schedule) =>
        schedule.coach_id === userId &&
        schedule.date === now.date
    )

  const hasOngoingClass =
    userSchedules.some((schedule) => {
      const start = timeToMinutes(
        schedule.time_start
      )

      const end = timeToMinutes(
        schedule.time_end
      )

      return (
        now.minutes >= start &&
        now.minutes < end
      )
    })

  return hasOngoingClass
    ? 'active'
    : 'deactive'
}

export default function UsersTable({
  users,
  schedules,
  currentUserId,
}: UsersTableProps) {
  const [search, setSearch] =
    useState('')

  const [statusFilter, setStatusFilter] =
    useState<
      'all' | 'active' | 'deactive'
    >('all')

  const [roleFilter, setRoleFilter] =
    useState('all')

  /*
   * This value forces the component
   * to check the class status again
   * every minute.
   */
  const [currentTime, setCurrentTime] =
    useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const filteredUsers =
    useMemo(() => {
      return users.filter((user) => {
        const status =
          getUserStatus(
            user.id,
            schedules
          )

        const searchText =
          search.toLowerCase().trim()

        const matchesSearch =
          user.name
            .toLowerCase()
            .includes(searchText) ||
          (user.contact ?? '')
            .toLowerCase()
            .includes(searchText)

        const matchesStatus =
          statusFilter === 'all' ||
          status === statusFilter

        const matchesRole =
          roleFilter === 'all' ||
          user.role === roleFilter

        return (
          matchesSearch &&
          matchesStatus &&
          matchesRole
        )
      })
    }, [
      users,
      schedules,
      search,
      statusFilter,
      roleFilter,
      currentTime,
    ])

  return (
    <div>

      {/* FILTERS */}
      <div className="flex items-end justify-between gap-6 mb-5">

        {/* SEARCH */}
        <div className="w-full max-w-[340px]">

          <label className="block text-[13px] font-medium text-gray-600 mb-2">
            Search
          </label>

          <div className="relative">

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search by name or email"
              className="w-full h-10 px-3 pr-10 border border-gray-200 rounded-lg bg-white text-[13px] text-gray-700 outline-none focus:border-black transition-colors"
            />

            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
              />
            </svg>

          </div>
        </div>

        {/* FILTERS */}
        <div className="flex items-end gap-3">

          {/* STATUS */}
          <div>

            <label className="block text-[13px] font-medium text-gray-600 mb-2">
              Status
            </label>

            <div className="flex h-10 border border-gray-200 rounded-lg overflow-hidden bg-white">

              <button
                type="button"
                onClick={() =>
                  setStatusFilter('all')
                }
                className={`px-5 text-[13px] font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter('active')
                }
                className={`px-5 text-[13px] font-medium transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Active
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter('deactive')
                }
                className={`px-5 text-[13px] font-medium transition-colors ${
                  statusFilter === 'deactive'
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Deactive
              </button>

            </div>
          </div>

          {/* ROLE */}
          <div>

            <label className="block text-[13px] font-medium text-gray-600 mb-2">
              Role
            </label>

            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(
                  e.target.value
                )
              }
              className="h-10 min-w-[120px] px-3 border border-gray-200 rounded-lg bg-white text-[13px] text-gray-700 outline-none focus:border-black"
            >
              <option value="all">
                All
              </option>

              <option value="head_coach">
                Head Coach
              </option>

              <option value="assistant_coach">
                Assistant Coach
              </option>
            </select>

          </div>

        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-sm">

        <table className="w-full text-left border-collapse">

          <thead>
            <tr className="border-b border-gray-100">

              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">
                Name
              </th>

              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">
                Contact
              </th>

              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">
                Role
              </th>

              <th className="px-6 py-4 text-[12px] font-medium text-gray-400">
                Status
              </th>

              <th className="px-6 py-4 text-[12px] font-medium text-gray-400 text-right">
                Actions
              </th>

            </tr>
          </thead>

          <tbody>

            {filteredUsers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-16 text-center"
                >
                  <p className="text-[14px] text-gray-400">
                    No users found.
                  </p>
                </td>
              </tr>
            )}

            {filteredUsers.map(
              (user) => {
                const initials =
                  user.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(
                      (part) =>
                        part[0]
                    )
                    .join('')
                    .toUpperCase()

                const isSelf =
                  user.id ===
                  currentUserId

                const status =
                  getUserStatus(
                    user.id,
                    schedules
                  )

                const isActive =
                  status === 'active'

                return (
                  <tr
                    key={user.id}
                    className="group border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >

                    {/* NAME */}
                    <td className="px-6 py-4">

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0">

                          <span className="text-white text-[12px] font-bold">
                            {initials}
                          </span>

                        </div>

                        <span className="text-[14px] font-semibold text-black">
                          {user.name}

                          {isSelf && (
                            <span className="ml-2 text-[11px] font-medium text-gray-400">
                              (you)
                            </span>
                          )}
                        </span>

                      </div>

                    </td>

                    {/* CONTACT */}
                    <td className="px-6 py-4">

                      {user.contact ? (
                        <span className="text-[13px] text-gray-600">
                          {user.contact}
                        </span>
                      ) : (
                        <span className="text-[13px] text-gray-300">
                          —
                        </span>
                      )}

                    </td>

                    {/* ROLE */}
                    <td className="px-6 py-4">

                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${
                          ROLE_STYLES[
                            user.role
                          ] ??
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ROLE_LABELS[
                          user.role
                        ] ??
                          user.role}
                      </span>

                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4">

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >

                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-500'
                              : 'bg-red-500'
                          }`}
                        />

                        {isActive
                          ? 'Active'
                          : 'Deactive'}

                      </span>

                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4">

                      <div className="flex items-center justify-end gap-1">

                        <EditUserModal
                          user={user}
                          isSelf={isSelf}
                        />

                        <DeleteUserButton
                          userId={user.id}
                          userName={user.name}
                          disabled={isSelf}
                        />

                      </div>

                    </td>

                  </tr>
                )
              }
            )}

          </tbody>

        </table>

      </div>

    </div>
  )
}