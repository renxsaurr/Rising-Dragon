'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

/** Debounced search that updates its own query parameter and preserves active filters. */
export default function LiveSearchInput({
  name = 'q',
  initialValue,
  placeholder,
  label,
  className = '',
  inputClassName = '',
  delay = 250,
}: {
  name?: string
  initialValue: string
  placeholder: string
  label: string
  className?: string
  inputClassName?: string
  delay?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(initialValue)

  useEffect(() => setValue(initialValue), [initialValue])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const query = value.trim()
      if (query) params.set(name, query)
      else params.delete(name)
      const next = params.toString()
      const current = new URLSearchParams(window.location.search).get(name) ?? ''
      if (current === query) return
      router.replace(`${pathname}${next ? `?${next}` : ''}${window.location.hash}`, { scroll: false })
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [delay, name, pathname, router, value])

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={`live-search-${name}`} className="sr-only">{label}</label>
      <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        id={`live-search-${name}`}
        type="search"
        maxLength={80}
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={`h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm font-medium text-gray-950 outline-none transition placeholder:font-normal placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${inputClassName}`}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => setValue('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
