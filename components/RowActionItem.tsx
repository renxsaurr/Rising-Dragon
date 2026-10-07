import type { ButtonHTMLAttributes } from 'react'

export const ROW_ACTION_CLASS = 'flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none'

export default function RowActionItem({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${ROW_ACTION_CLASS} ${className}`} {...props} />
}
