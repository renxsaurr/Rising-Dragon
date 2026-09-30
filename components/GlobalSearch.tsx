'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { searchDirectory } from '@/app/header-actions'

type SearchResult = {
  id: number
  type: 'student' | 'staff'
  name: string
  detail: string
  href: string
}

export default function GlobalSearch({ canSearchStaff }: { canSearchStaff: boolean }) {
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if (event.key === 'Escape') setIsOpen(false)
    }
    const handleOutsideClick = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('keydown', handleShortcut)
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => {
      document.removeEventListener('keydown', handleShortcut)
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const matches = await searchDirectory(term)
        if (!ignore) setResults(matches as SearchResult[])
      } catch {
        if (!ignore) setResults([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }, 250)

    return () => {
      ignore = true
      window.clearTimeout(timeout)
    }
  }, [query])

  const selectResult = (result: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    const layout = window.matchMedia('(min-width: 1280px)').matches ? 'desktop' : 'mobile'
    const anchor = result.type === 'student' ? `student-${result.id}-${layout}` : `user-${result.id}-${layout}`
    router.push(`${result.href}#${anchor}`)
  }

  return (
    <div ref={wrapperRef} className="relative w-52 shrink-0 sm:w-64 xl:w-72">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder={canSearchStaff ? 'Search students or staff' : 'Search students'}
          aria-label={canSearchStaff ? 'Search students and staff' : 'Search students'}
          aria-controls="global-search-results"
          aria-expanded={isOpen}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/10 xl:pr-12"
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[9px] text-gray-400 xl:block">Ctrl K</kbd>
        )}
      </div>

      {isOpen && query.trim().length < 2 && (
        <div role="status" className="absolute right-0 top-full z-[70] mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
          <p className="text-sm font-medium text-gray-800">Search {canSearchStaff ? 'students and staff' : 'students'}</p>
          <p className="mt-1 text-xs text-gray-500">Type at least 2 characters to see matching records.</p>
        </div>
      )}

      {isOpen && query.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute right-0 top-full z-[70] mt-2 max-h-[min(70vh,24rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          {loading ? (
            <p className="px-3 py-4 text-sm text-gray-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">{canSearchStaff ? 'No matching students or staff found.' : 'No matching students found.'}</p>
          ) : (
            <>
              {(['student', 'staff'] as const).map((type) => {
                const sectionResults = results.filter((result) => result.type === type)
                if (sectionResults.length === 0) return null
                return (
                  <div key={type}>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{type === 'student' ? 'Students' : 'Staff'}</p>
                    {sectionResults.map((result) => (
                      <button key={`${result.type}-${result.id}`} type="button" role="option" aria-selected="false" onClick={() => selectResult(result)} className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{result.name}</span>
                          <span className="mt-0.5 block truncate text-xs capitalize text-gray-500">{result.detail}</span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">{type}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
