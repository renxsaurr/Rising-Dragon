'use client'

import type { ReactNode } from 'react'
import type { Schedule } from './WeeklyScheduleBoard'
import DailyScheduleBoard from './DailyScheduleBoard'

export type ScheduleBoardProps = {
  dateISO: string
  initialSchedules: Schedule[]
  branches: { id: number; name: string }[]
  coaches: { id: number; name: string; role: string; primary_branch_id: number | null; primary_branch_name: string | null }[]
  isHeadCoach: boolean
  sidebarContent?: ReactNode
}

export default function ScheduleBoard({
  dateISO,
  initialSchedules,
  branches,
  coaches,
  isHeadCoach,
  sidebarContent,
}: ScheduleBoardProps) {
  return (
    <DailyScheduleBoard
      dateISO={dateISO}
      initialSchedules={initialSchedules}
      branches={branches}
      coaches={coaches}
      isHeadCoach={isHeadCoach}
      sidebarContent={sidebarContent}
    />
  )
}
