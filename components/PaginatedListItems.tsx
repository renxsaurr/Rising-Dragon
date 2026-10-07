'use client'

import { Children, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Pagination controls for mobile card/list layouts that mirror the table page size. */
export default function PaginatedListItems({
  children,
  pageSize = 5,
  itemLabel = 'records',
}: {
  children: ReactNode
  pageSize?: number
  itemLabel?: string
}) {
  const [pagination, setPagination] = useState({ page: 1, rowsKey: '' })
  const items = useMemo(() => Children.toArray(children), [children])
  const rowsKey = items.map((item) => typeof item === 'object' && item !== null && 'key' in item ? String(item.key) : '').join('|')
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = pagination.rowsKey === rowsKey ? Math.min(pagination.page, pageCount) : 1
  const visibleItems = items.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      {visibleItems}
      {pageCount > 1 && (
        <nav aria-label={`${itemLabel} pagination`} className="flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3">
          <span className="text-xs font-medium text-gray-700">Page {page} of {pageCount}</span>
          <button type="button" aria-label="Previous page" onClick={() => setPagination({ page: Math.max(1, page - 1), rowsKey })} disabled={page === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next page" onClick={() => setPagination({ page: Math.min(pageCount, page + 1), rowsKey })} disabled={page === pageCount} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"><ChevronRight size={18} aria-hidden="true" /></button>
        </nav>
      )}
    </>
  )
}
