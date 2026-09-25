import { useMemo } from 'react'
import type { DayEntry } from '../db/types'
import { bedtimeMinutes, menace, plansToMinutes, type Menace } from '../logic/menace'
import type { DayTaskData } from '../logic/types'
import { useSettings } from './useSettings'

/** The Today duck's menace, from today's progress, today's plan, the bedtime setting and the time. */
export function useMenace(data: DayTaskData | undefined, entry: DayEntry | undefined, nowMin: number): Menace | undefined {
  const { bedtime } = useSettings()
  return useMemo(
    () =>
      data && entry
        ? menace({ data, nowMin, bedtimeMin: bedtimeMinutes(bedtime), plans: plansToMinutes(entry.plans) })
        : undefined,
    [data, entry, nowMin, bedtime],
  )
}
