import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Challenge } from '../db/types'
import { dayNumberForDate, todayISO } from '../lib/dates'

/**
 * Today's DayEntry for the given challenge, creating it on first load if it
 * doesn't exist yet. Returns `undefined` while loading/creating.
 */
export function useTodayEntry(challenge: Challenge | undefined) {
  const dayNumber = challenge ? dayNumberForDate(challenge.startDate, todayISO()) : undefined

  useEffect(() => {
    if (!challenge || dayNumber === undefined) return
    void dayEntryRepo.getOrCreate({ challengeId: challenge.id, dayNumber, date: todayISO() })
  }, [challenge, dayNumber])

  const entry = useLiveQuery(async () => {
    if (!challenge || dayNumber === undefined) return undefined
    return dayEntryRepo.getByChallengeAndDayNumber(challenge.id, dayNumber)
  }, [challenge?.id, dayNumber])

  return { entry, dayNumber }
}
