'use client'

import { useState } from 'react'
import Link from 'next/link'

type Branch = {
  id: number
  name: string
  address: string
  description?: string | null
  photo_url?: string | null
  studentCount: number
  todayClasses: number
}

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
  </svg>
)

export default function BranchesView({ branches }: { branches: Branch[] }) {
  const [view, setView] = useState<'list' | 'grid'>('grid')

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`p-2 ${view === 'list' ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
          >
            <ListIcon />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-2 ${view === 'grid' ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-[14px] text-gray-400">
          No branches yet.
        </div>
      ) : view === 'list' ? (
        <div className="space-y-3">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/branches/${branch.id}`}
              className="flex items-stretch bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md hover:border-red-200 transition-all group"
            >
              <div className="w-1.5 bg-red-600 shrink-0" />
              <div className="flex-1 flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[15px] font-semibold text-black group-hover:text-red-600 transition-colors">
                    {branch.name}
                  </p>
                  <p className="text-[13px] text-gray-500 mt-0.5">{branch.address}</p>
                  <div className="flex gap-3 mt-2 text-[12px] text-gray-500">
                    <span>{branch.studentCount} students</span>
                    <span>·</span>
                    <span>{branch.todayClasses} classes today</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-red-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/branches/${branch.id}`}
              className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg hover:border-red-200 transition-all group"
            >
              {branch.photo_url ? (
                <img src={branch.photo_url} alt={branch.name} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-3xl font-bold">
                  {branch.name.charAt(0)}
                </div>
              )}

              <div className="p-4">
                <h3 className="font-semibold text-[14px] text-black group-hover:text-red-600 transition-colors">
                  {branch.name}
                </h3>
                <p className="text-[13px] text-gray-500">{branch.address}</p>
                {branch.description && (
                  <p className="text-[12px] text-gray-400 mt-1 line-clamp-2">{branch.description}</p>
                )}
                <div className="flex gap-2 mt-3 text-[11px]">
                  <span className="bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                    {branch.studentCount} students
                  </span>
                  <span className="bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                    {branch.todayClasses} today
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}