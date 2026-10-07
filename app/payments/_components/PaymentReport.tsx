import type { ReactNode } from 'react'
import { paymentDetail } from './PaymentRecordsTable'
import { formatBeltLabel } from '@/utils/belts'
import { formatCoverage } from '@/utils/payment-fees'
import { formatAmount } from '@/utils/payment-reminders'
import type {
  BranchPaymentStats,
  MissedStudent,
  NotPaidGroup,
  PaymentKind,
  PaymentRecord,
} from '@/utils/payment-records'

// Status as plain words, so the report reads fine in black and white.
const STATUS_TEXT: Record<PaymentKind, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  soon: 'Due soon',
}

const NOTE_LENGTH = 80

const TABLE = 'w-full border-collapse text-left text-[11px] leading-snug'
const TH = 'border-b border-gray-400 px-1.5 py-1 font-semibold text-black'
const TD = 'border-b border-gray-200 px-1.5 py-1 align-top text-black'

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const shortNote = (note: string) => (note.length > NOTE_LENGTH ? `${note.slice(0, NOTE_LENGTH - 1)}…` : note)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 text-[13px] font-semibold text-black">{title}</h2>
      {children}
    </section>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</dt>
      <dd className="text-[13px] font-semibold text-black">{value}</dd>
    </div>
  )
}

/** Print-only payment report for the shown month and branch: every section, whatever tab is open. */
export default function PaymentReport({
  monthLabel,
  branchLabel,
  showBranch,
  generatedAt,
  generatedBy,
  stats,
  notPaid,
  trackingStarted,
  rows,
  missed,
}: {
  monthLabel: string
  branchLabel: string
  /** All branches: show each student's branch. */
  showBranch: boolean
  /** e.g. "Oct 7, 2026, 12:05 PM" (Manila) */
  generatedAt: string
  generatedBy: string
  stats: BranchPaymentStats
  notPaid: NotPaidGroup
  trackingStarted: boolean
  /** Every record of the month for the branch; the screen filter does not apply. */
  rows: PaymentRecord[]
  missed: MissedStudent[]
}) {
  const percent = stats.expected > 0 ? Math.floor((stats.collected / stats.expected) * 100) : null

  return (
    // Hidden on screen. On paper it is the only thing shown (see payment-report-print.css).
    <article data-payment-report className="hidden text-black print:block">
      <header className="border-b border-gray-400 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Rising Dragon Taekwondo</p>
        <h1 className="mt-1 text-lg font-semibold">
          Payment Report — {monthLabel} · {branchLabel}
        </h1>
        <p className="mt-0.5 text-[11px] text-gray-700">
          Generated {generatedAt} (Manila){generatedBy ? ` by ${generatedBy}` : ''}
        </p>
      </header>

      <Section title="Summary">
        <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
          <SummaryItem label="Expected" value={formatAmount(stats.expected)} />
          <SummaryItem label="Collected" value={formatAmount(stats.collected)} />
          <SummaryItem label="Collected %" value={percent === null ? '—' : `${percent}%`} />
          <SummaryItem label="Paid" value={String(stats.paidCount)} />
          <SummaryItem label="Unpaid" value={String(stats.unpaidCount)} />
          <SummaryItem label="Overdue" value={String(stats.overdueCount)} />
        </dl>
        {trackingStarted && notPaid.activeCount > 0 && (
          <p className="mt-2 text-[12px]">
            {notPaid.notPaidCount} of {notPaid.activeCount} students not paid yet
          </p>
        )}
      </Section>

      {trackingStarted && (
        <Section title={`Not paid yet — ${monthLabel}`}>
          {notPaid.students.length === 0 ? (
            <p className="text-[12px]">Everyone has paid for {monthLabel}.</p>
          ) : (
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Student</th>
                  <th className={TH}>Belt</th>
                  {showBranch && <th className={TH}>Branch</th>}
                  <th className={TH}>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {notPaid.students.map((student) => (
                  <tr key={student.id}>
                    <td className={TD}>{student.name}</td>
                    <td className={TD}>{formatBeltLabel(student.beltLevel) || '—'}</td>
                    {showBranch && <td className={TD}>{student.branchName}</td>}
                    <td className={`${TD} whitespace-nowrap`}>
                      {student.enrollmentDate ? formatDate(student.enrollmentDate) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      <Section title={`Payment records — ${monthLabel}`}>
        {rows.length === 0 ? (
          <p className="text-[12px]">No payments for this month yet.</p>
        ) : (
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Student</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Details</th>
                <th className={TH}>Due date</th>
                <th className={TH}>Status</th>
                <th className={TH}>Paid</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={TD}>
                    {row.studentName}
                    {showBranch && <span className="block text-gray-600">{row.branchName}</span>}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatAmount(row.amount)}</td>
                  <td className={TD}>{paymentDetail(row) ?? '—'}</td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(row.dueDate)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{STATUS_TEXT[row.kind]}</td>
                  <td className={TD}>
                    {row.status === 'Paid'
                      ? [row.paidDate ? formatDate(row.paidDate) : null, row.method].filter(Boolean).join(' · ') || '—'
                      : '—'}
                  </td>
                  <td className={TD}>{row.notes ? shortNote(row.notes) : ''}</td>
                </tr>
              ))}
              {/* A normal last row, not <tfoot>: a tfoot would repeat on every printed page. */}
              <tr className="font-semibold">
                <td className={`${TD} border-t border-gray-400`}>Total expected</td>
                <td className={`${TD} whitespace-nowrap border-t border-gray-400 text-right tabular-nums`}>
                  {formatAmount(stats.expected)}
                </td>
                <td className={`${TD} border-t border-gray-400`} colSpan={5}>
                  Total collected: {formatAmount(stats.collected)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>

      {missed.length > 0 && (
        <Section title="Missed months">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Months</th>
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {missed.map((student) => (
                <tr key={student.studentId}>
                  <td className={TD}>
                    {student.name}
                    {showBranch && <span className="block text-gray-600">{student.branchName}</span>}
                  </td>
                  <td className={TD}>{student.months.map((month) => formatCoverage(`${month}-01`, 1)).join(', ')}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    {student.months.length} month{student.months.length === 1 ? '' : 's'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </article>
  )
}
