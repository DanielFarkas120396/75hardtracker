import { useEffect } from 'react'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { DayEntry } from '../db/types'
import { isChallengeDay } from '../logic/days'

/**
 * Today's DayEntry, taken from the gate's live entries and created the first
 * time the day is opened. `undefined` while it's being created — and always
 * outside Day 1–75 (before the start), where no entry may exist.
 */
export function useTodayEntry(params: {
  challengeId: number
  dayNumber: number
  today: string
  dayEntries: DayEntry[]
}): DayEntry | undefined {
  const { challengeId, dayNumber, today, dayEntries } = params
  const entry = isChallengeDay(dayNumber) ? dayEntries.find((e) => e.dayNumber === dayNumber) : undefined
  const missing = entry === undefined && isChallengeDay(dayNumber)

  useEffect(() => {
    if (missing) void dayEntryRepo.getOrCreate({ challengeId, dayNumber, date: today })
  }, [missing, challengeId, dayNumber, today])

  return entry
}
