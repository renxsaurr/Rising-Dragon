'use client'

import { useState } from 'react'

export type WeekPoint = { label: string; range: string; present: number; total: number }

const WIDTH = 600
const HEIGHT = 220

// Weekly attendance rate as a smooth area, with a dashed line for the period average.
export default function AttendanceAreaChart({ weeks }: { weeks: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const rates = weeks.map((week) => (week.total ? (week.present / week.total) * 100 : null))
  const known = rates.map((rate, index) => ({ rate, index })).filter((point): point is { rate: number; index: number } => point.rate !== null)

  if (known.length === 0) {
    return <p className="grid h-56 place-items-center rounded-lg bg-gray-50 text-sm text-gray-400">No attendance recorded in this period.</p>
  }

  const totalPresent = weeks.reduce((sum, week) => sum + week.present, 0)
  const totalMarked = weeks.reduce((sum, week) => sum + week.total, 0)
  const average = (totalPresent / totalMarked) * 100
  // centre of each week's column, so points line up with the hit targets and labels below
  const x = (index: number) => ((index + 0.5) / weeks.length) * WIDTH
  const y = (rate: number) => HEIGHT - (rate / 100) * HEIGHT
  const points = known.map((point) => [x(point.index), y(point.rate)] as const)

  // monotone-ish smoothing: horizontal control points halfway between neighbours
  let line = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const mid = (x0 + x1) / 2
    line += ` C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`
  }
  const area = `${line} L ${points[points.length - 1][0]} ${HEIGHT} L ${points[0][0]} ${HEIGHT} Z`
  const hoverRate = hover === null ? null : rates[hover]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-2"><span className="h-0.5 w-4 rounded bg-red-500" />Weekly attendance rate</span>
        <span className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-gray-400" />Average {Math.round(average)}%</span>
      </div>

      <div className="flex gap-3">
        <div className="relative flex h-56 w-9 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-gray-400">
          {[100, 75, 50, 25, 0].map((tick) => <span key={tick} className="leading-none">{tick}%</span>)}
        </div>

        <div className="relative h-56 flex-1" onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map((tick) => (
            <div key={tick} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: `${tick}%` }} />
          ))}

          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="attendance-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#attendance-fill)" />
            <path d={line} fill="none" stroke="rgb(239 68 68)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={WIDTH} y1={y(average)} y2={y(average)} stroke="rgb(156 163 175)" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={HEIGHT} stroke="rgb(209 213 219)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          </svg>

          {hover !== null && hoverRate !== null && (
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
              style={{ left: `${(x(hover) / WIDTH) * 100}%`, bottom: `${hoverRate}%` }}
            />
          )}

          {/* hit targets: one column per week */}
          <div className="absolute inset-0 flex">
            {weeks.map((week, index) => (
              <div
                key={week.range}
                className="h-full flex-1"
                onMouseEnter={() => setHover(index)}
                role="img"
                aria-label={rates[index] === null ? `${week.range}: no records` : `${week.range}: ${Math.round(rates[index]!)}% present`}
              />
            ))}
          </div>

          {hover !== null && (
            <div
              className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg ${hover > weeks.length / 2 ? '-translate-x-full -ml-3' : 'ml-3'}`}
              style={{ left: `${(x(hover) / WIDTH) * 100}%` }}
            >
              <p className="font-semibold">{weeks[hover].range}</p>
              <p className="mt-0.5 text-gray-300">
                {hoverRate === null ? 'No records' : `${Math.round(hoverRate)}% present · ${weeks[hover].present} of ${weeks[hover].total}`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="ml-12 mt-2 flex">
        {weeks.map((week, index) => (
          <span key={week.range} className="flex-1 text-center text-[11px] text-gray-400">{index % 2 === (weeks.length - 1) % 2 ? week.label : ''}</span>
        ))}
      </div>
    </div>
  )
}
