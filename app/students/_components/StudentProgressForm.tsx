'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { recordStudentProgress } from '@/app/students/progress-actions'

const fieldClass = 'mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none focus:border-black focus:ring-2 focus:ring-black/10'

export default function StudentProgressForm({ studentId, today }: { studentId: number; today: string }) {
  const [busy, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setMessage('')
    setError('')
    const input = {
      assessedOn: String(form.get('assessedOn') ?? ''),
      focusArea: String(form.get('focusArea') ?? ''),
      progressLevel: String(form.get('progressLevel') ?? ''),
      assessmentReadiness: String(form.get('assessmentReadiness') ?? ''),
      observation: String(form.get('observation') ?? ''),
      nextSteps: String(form.get('nextSteps') ?? ''),
    }
    startTransition(async () => {
      const result = await recordStudentProgress(studentId, input)
      if ('error' in result) setError(result.error ?? 'Could not save student progress.')
      else {
        formElement.reset()
        setMessage('Progress note saved.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-gray-950">Record a progress check</h2>
        <p className="mt-1 text-sm text-gray-600">Record observable progress and a coach’s assessment recommendation. This does not promote the student.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-800">Assessment date
          <input className={fieldClass} type="date" name="assessedOn" max={today} defaultValue={today} required />
        </label>
        <label className="text-sm font-medium text-gray-800">Focus area
          <select className={fieldClass} name="focusArea" defaultValue="technique">
            <option value="technique">Technique</option>
            <option value="forms">Forms / patterns</option>
            <option value="sparring">Sparring</option>
            <option value="conditioning">Conditioning</option>
            <option value="discipline">Discipline and control</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-800">Observed progress
          <select className={fieldClass} name="progressLevel" defaultValue="developing">
            <option value="needs_practice">Needs more practice</option>
            <option value="developing">Developing</option>
            <option value="consistent">Consistent</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-800">Belt assessment readiness
          <select className={fieldClass} name="assessmentReadiness" defaultValue="not_assessed">
            <option value="not_assessed">Not assessed</option>
            <option value="not_ready">Not ready yet</option>
            <option value="ready_for_assessment">Ready for coach assessment</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-gray-800">Coach observation
        <textarea className={fieldClass} name="observation" rows={3} maxLength={1000} required placeholder="Describe a specific skill or behavior observed." />
      </label>
      <label className="block text-sm font-medium text-gray-800">Recommended practice / next step <span className="font-normal text-gray-500">(optional)</span>
        <textarea className={fieldClass} name="nextSteps" rows={2} maxLength={500} placeholder="What should the student continue practicing?" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className={`text-sm ${error ? 'text-red-700' : 'text-gray-600'}`}>{error || message}</p>
        <button type="submit" disabled={busy} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Saving…' : 'Save progress'}
        </button>
      </div>
    </form>
  )
}
