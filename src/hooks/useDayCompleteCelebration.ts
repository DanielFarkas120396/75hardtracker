import { useCallback, useState } from 'react'
import { CHALLENGE_LENGTH } from '../logic/constants'
import { streakEndingAt } from '../logic/streak'
import { completedDayXp } from '../logic/xp'
import type { ChallengeGate } from './useChallengeGate'

export interface DayCelebration {
  dayNumber: number
  xpEarned: number
  streak: number
  isFinalDay: boolean
  /** Finished the morning after (late logging), not on the day itself. */
  late: boolean
}

/**
 * Detects the moment today's entry — or the late day's, while yesterday can
 * still be finished (until noon) — flips to `completed`, and returns the
 * celebration to show. It lives at the App level, not on the Today screen:
 * finishing Day 75 swaps Today for the victory screen, and the celebration
 * must survive that swap.
 */
export function useDayCompleteCelebration(gate: ChallengeGate | undefined) {
  const watched = gate ? [gate.todayDayNumber, gate.lateDayNumber].filter((d): d is number => d !== null) : []
  const dayKey = gate ? `${gate.challenge.id}:${watched.join(',')}` : null
  const doneDays = gate
    ? watched.filter((day) => gate.dayEntries.some((e) => e.dayNumber === day && e.completed)).join(',')
    : ''

  const [seen, setSeen] = useState({ dayKey, doneDays })
  const [celebration, setCelebration] = useState<DayCelebration | null>(null)

  // Compare with the previous render during render (React's "adjust state
  // when a prop changes" pattern) — only a change on the same days counts,
  // so loading the app, switching days or restarting never celebrates.
  if (seen.dayKey !== dayKey || seen.doneDays !== doneDays) {
    setSeen({ dayKey, doneDays })
    const before = seen.doneDays.split(',')
    const justDone = doneDays.split(',').find((day) => day !== '' && !before.includes(day))
    if (gate && seen.dayKey === dayKey && justDone !== undefined) {
      const dayNumber = Number(justDone)
      const streak = streakEndingAt(gate.dayEntries, dayNumber)
      setCelebration({
        dayNumber,
        xpEarned: completedDayXp(streak),
        streak,
        isFinalDay: dayNumber === CHALLENGE_LENGTH,
        late: dayNumber !== gate.todayDayNumber,
      })
    }
  }

  const dismiss = useCallback(() => setCelebration(null), [])
  return { celebration, dismiss }
}
