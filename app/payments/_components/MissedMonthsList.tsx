import Link from 'next/link'
import { FOCUS_RING } from './ModalShell'
import { paymentsHref } from './payments-url'
import { formatCoverage } from '@/utils/payment-fees'
import type { MissedStudent } from '@/utils/payment-records'
import PaginatedTableRows from '@/components/PaginatedTableRows'

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600'

/** Students with past months that have no payment. Each month links to that month's Not paid yet list. */
export default function MissedMonthsList({
  students,
  showBranch,
  branch,
}: {
  students: MissedStudent[]
  showBranch: boolean
  /** The selected branch key, kept in the month links. */
  branch: string
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="system-data-table w-full min-w-[560px] border-collapse text-left">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className={`${TH} pl-5`}>Student</th>
              <th className={TH}>Months missed</th>
              <th className={`${TH} pr-5 text-right`}>Total</th>
            </tr>
          </thead>
          <PaginatedTableRows itemLabel="missed payment records" colSpan={3}>
            {students.map((student) => (
              <tr key={student.studentId} className="align-top">
                <td className="px-5 py-3">
                  <p className="break-words text-sm font-medium text-gray-900">{student.name}</p>
                  {showBranch && <p className="mt-0.5 text-xs text-gray-500">{student.branchName}</p>}
                </td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    {student.months.map((month) => (
                      <Link
                        key={month}
                        href={paymentsHref({ month, branch, filter: 'all', tab: 'notpaid' })}
                        scroll={false}
                        className={`rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 ${FOCUS_RING}`}
                      >
                        {formatCoverage(`${month}-01`, 1)}
                      </Link>
                    ))}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 pr-5 text-right text-sm font-semibold text-amber-700">
                  {student.months.length} month{student.months.length === 1 ? '' : 's'}
                </td>
              </tr>
            ))}
          </PaginatedTableRows>
        </table>
      </div>
    </>
  )
}
