import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import type { ProgressReportCheck } from '@/utils/branch-reports'
import { Card, EmptyNote } from '@/components/DashboardWidgets'
import { cardClass } from '@/utils/branch-report-format'

const focusLabels: Record<string, string> = {
  technique: 'Technique', forms: 'Forms / patterns', sparring: 'Sparring',
  conditioning: 'Conditioning', discipline: 'Discipline and control',
}
const levelLabels: Record<string, string> = {
  needs_practice: 'Needs more practice', developing: 'Developing', consistent: 'Consistent',
}
const readinessLabels: Record<string, string> = {
  not_assessed: 'Not assessed', not_ready: 'Not ready yet', ready_for_assessment: 'Ready for coach assessment',
}

export default function BranchProgressChecks({ checks, title = 'Latest student progress checks', embedded = false }: {
  checks: ProgressReportCheck[]
  title?: string
  embedded?: boolean
}) {
  const content = checks.length === 0
    ? <div className="px-5 py-4"><EmptyNote>No coach progress checks in this date range.</EmptyNote></div>
    : <ol className="divide-y divide-gray-100">
      {checks.map((check) => (
        <li key={check.id} className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/students/${check.studentId}/progress`} className="font-semibold text-gray-950 hover:text-red-700 hover:underline">{check.studentName}</Link>
              <p className="mt-0.5 text-xs text-gray-600">{check.branchName} · {focusLabels[check.focusArea] ?? check.focusArea} · {levelLabels[check.progressLevel] ?? check.progressLevel}</p>
            </div>
            <time className="shrink-0 text-xs text-gray-600" dateTime={check.assessedOn}>{new Date(`${check.assessedOn}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{check.observation}</p>
          {check.nextSteps && <p className="mt-1.5 text-sm text-gray-700"><span className="font-medium">Next step:</span> {check.nextSteps}</p>}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
            <span>{readinessLabels[check.assessmentReadiness] ?? check.assessmentReadiness}</span>
            <span>Coach: {check.coachName}</span>
          </p>
        </li>
      ))}
    </ol>

  if (embedded) return <div>
    {content}
    <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-600">Shows up to five latest checks per selected branch. Assessment readiness is a coach recommendation; promotions remain a separate decision.</p>
  </div>

  return (
    <Card title={<><ClipboardCheck className="h-4 w-4 text-gray-950" aria-hidden />{title}</>} chip={checks.length ? `${checks.length} recent` : undefined} flush className={`${cardClass} print:break-inside-avoid`}>
      {content}
      <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-600">Shows up to five latest checks per selected branch. Assessment readiness is a coach recommendation; promotions remain a separate decision.</p>
    </Card>
  )
}
