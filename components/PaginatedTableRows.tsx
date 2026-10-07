'use client'

import { Children, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Keeps table pagination consistent while leaving each module in control of its rows. */
export default function PaginatedTableRows({
  children,
  pageSize = 5,
  itemLabel = 'records',
  pinnedRows = 0,
  colSpan = 100,
}: {
  children: ReactNode
  pageSize?: number
  itemLabel?: string
  /** Number of trailing rows (such as a totals row) that stay visible on every page. */
  pinnedRows?: number
  colSpan?: number
}) {
  const [pagination, setPagination] = useState({ page: 1, rowsKey: '' })
  const allRows = useMemo(() => Children.toArray(children), [children])
  const rowsKey = allRows.map((row) => typeof row === 'object' && row !== null && 'key' in row ? String(row.key) : '').join('|')
  const pinnedCount = Math.min(pinnedRows, allRows.length)
  const regularRows = pinnedCount ? allRows.slice(0, -pinnedCount) : allRows
  const totalsRows = pinnedCount ? allRows.slice(-pinnedCount) : []
  const pageCount = Math.max(1, Math.ceil(regularRows.length / pageSize))
  const page = pagination.rowsKey === rowsKey ? Math.min(pagination.page, pageCount) : 1
  const pageRows = regularRows.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <tbody className="hidden print:table-row-group">
        {allRows}
      </tbody>
      <tbody className="divide-y divide-gray-100 print:hidden">
        {pageRows}
        {totalsRows}
      </tbody>
      {pageCount > 1 && (
        <tfoot className="border-t border-gray-200 bg-white print:hidden">
          <tr>
            <td colSpan={colSpan} className="px-4 py-3">
              <nav aria-label={`${itemLabel} pagination`} className="flex items-center justify-end gap-3">
                <span className="text-xs font-medium text-gray-700">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setPagination({ page: Math.max(1, page - 1), rowsKey })}
                  disabled={page === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setPagination({ page: Math.min(pageCount, page + 1), rowsKey })}
                  disabled={page === pageCount}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  )
}
