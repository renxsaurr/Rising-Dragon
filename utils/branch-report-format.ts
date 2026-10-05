// shared by the Branch reports components — no server-only imports here
import type { BranchCounts } from '@/utils/branch-reports'

export const LOW_DATA_MARKS = 10
export const GOOD_RATE = 85
export const FAIR_RATE = 70
export const DROP_ALERT_POINTS = 10

export const cardClass = 'rounded-2xl border-gray-200 bg-white shadow-sm shadow-gray-900/[0.03]'

export const marksOf = (counts: BranchCounts) => counts.present + counts.absent
export const isLowData = (counts: BranchCounts) => marksOf(counts) < LOW_DATA_MARKS
// 0 = reliable, 1 = Low data, 2 = no marks — so Low data never ranks as best
export const dataTier = (counts: BranchCounts) => (marksOf(counts) === 0 ? 2 : isLowData(counts) ? 1 : 0)

// whole percent, so the shown number and its status always agree
export const ratePercent = (rate: number) => Math.round(rate * 100)

export function rateStatus(rate: number) {
  const value = ratePercent(rate)
  if (value >= GOOD_RATE) return { label: 'Good', dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (value >= FAIR_RATE) return { label: 'Fair', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' }
  return { label: 'Low', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' }
}

function formatDay(date: string, withYear: boolean) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })
}

// "Sep 6 – Oct 5, 2026"; withYear=false gives "Aug 7 – Sep 5" (years still shown if the range crosses one)
export function formatRange(start: string, end: string, withYear = true) {
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4)
  if (start === end) return formatDay(end, withYear)
  return `${formatDay(start, crossesYear)} – ${formatDay(end, withYear || crossesYear)}`
}
