'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { INPUT } from './ModalShell'

export type StudentChoice = { id: number; name: string; belt: string; branch: string; billingPlan: 'Monthly' | 'Per session' }

const MAX_RESULTS = 8

const details = (student: StudentChoice) => [student.billingPlan === 'Per session' ? 'Pay per session' : 'Monthly', student.belt, student.branch].filter(Boolean).join(' · ')

/** Every typed word must appear somewhere in the name, ignoring case: "juan cruz" finds "Juan Dela Cruz". */
function matchesName(name: string, query: string) {
  const lower = name.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => lower.includes(word))
}

/** Searchable student picker (ARIA combobox pattern: input + listbox, arrow keys, Enter, Escape). */
export default function StudentCombobox({
  inputId,
  students,
  selectedId,
  onSelect,
  disabled,
}: {
  inputId: string
  students: StudentChoice[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  disabled: boolean
}) {
  const selected = students.find((student) => student.id === selectedId) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()
  const optionId = (index: number) => `${listId}-option-${index}`

  const allMatches = useMemo(() => students.filter((student) => matchesName(student.name, query)), [students, query])
  const matches = allMatches.slice(0, MAX_RESULTS)
  const noStudents = students.length === 0
  const showList = open && !disabled && !noStudents

  const pick = (student: StudentChoice) => {
    onSelect(student.id)
    setQuery(student.name)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveIndex(0)
      } else {
        setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && showList && matches[activeIndex]) {
      // Pick the student instead of submitting the form.
      event.preventDefault()
      pick(matches[activeIndex])
    } else if (event.key === 'Escape' && showList) {
      // Close only the list. Stopping here keeps the popup itself open.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[activeIndex] ? optionId(activeIndex) : undefined}
        autoComplete="off"
        placeholder={noStudents ? 'No active students' : 'Type a name to search'}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActiveIndex(0)
          // Typing again means a new search, so the old choice is cleared.
          if (selectedId !== null) onSelect(null)
        }}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        disabled={disabled || noStudents}
        required
        className={INPUT}
      />

      {selected && !showList && <p className="mt-1 text-xs text-gray-500">{details(selected)}</p>}

      {showList &&
        (matches.length ? (
          <>
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching students"
              className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-sm"
            >
              {matches.map((student, index) => (
                <li
                  key={student.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown would blur the input and close the list before the click lands
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(student)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? 'bg-gray-100 text-black' : 'text-gray-700'}`}
                >
                  <span className="font-medium">{student.name}</span>
                  {details(student) && <span className="text-gray-500"> · {details(student)}</span>}
                </li>
              ))}
            </ul>
            {allMatches.length > MAX_RESULTS && (
              <p className="mt-1 text-xs text-gray-500">
                Showing {MAX_RESULTS} of {allMatches.length}. Keep typing to narrow it down.
              </p>
            )}
          </>
        ) : (
          <p id={listId} role="status" className="mt-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
            No students found.
          </p>
        ))}
    </div>
  )
}
