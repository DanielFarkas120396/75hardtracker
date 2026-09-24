import { useLiveQuery } from 'dexie-react-hooks'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'

export interface ChallengeTotals {
  water_ml: number
  pages: number
  workoutMinutes: number
  perfectDays: number
}

const EMPTY_TOTALS: ChallengeTotals = { water_ml: 0, pages: 0, workoutMinutes: 0, perfectDays: 0 }

/** Running totals for the given challenge: water, pages, workout minutes, perfect days. */
export function useChallengeTotals(challengeId: number | undefined): ChallengeTotals {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return EMPTY_TOTALS

      const entries = await dayEntryRepo.getAllForChallenge(challengeId)
      const totals: ChallengeTotals = { ...EMPTY_TOTALS }

      for (const entry of entries) {
        totals.water_ml += entry.water_ml
        totals.pages += entry.pages_read
        if (entry.completed) totals.perfectDays += 1

        const workouts = await workoutRepo.getForDayEntry(entry.id)
        totals.workoutMinutes += workouts.reduce((sum, w) => sum + w.durationMin, 0)
      }

      return totals
    }, [challengeId]) ?? EMPTY_TOTALS
  )
}
