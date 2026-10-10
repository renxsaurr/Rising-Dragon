import { formatCoverage } from '@/utils/payment-fees'
import type { PaymentRecord } from '@/utils/payment-records'

// Shared by the on-screen records table and the printable payment report.
export function paymentDetail(row: PaymentRecord) {
  if (row.paymentType === 'Monthly' && row.coverageStart && row.quantity) {
    return `Monthly · ${formatCoverage(row.coverageStart, row.quantity, row.enrollmentDate ?? row.coverageStart)}`
  }
  if (row.paymentType === 'Per session' && row.quantity) {
    return `${row.quantity} session${row.quantity === 1 ? '' : 's'}`
  }
  return null
}
