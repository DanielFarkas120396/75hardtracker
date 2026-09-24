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
}

/**
 * Detects the moment today's entry flips to `completed` and returns the
 * celebration to show. It lives at the App level, not on the Today screen:
 * finishing Day 75 swaps Today for the victory screen, and the celebration
 * must survive that swap.
 */
export function useDayCompleteCelebration(gate: ChallengeGate | undefined) {
  const dayKey = gate ? `${gate.challenge.id}:${gate.todayDayNumber}` : null
  const completed = gate?.dayEntries.some((e) => e.dayNumber === gate.todayDayNumber && e.completed) ?? false

  const [seen, setSeen] = useState({ dayKey, completed })
  const [celebration, setCelebration] = useState<DayCelebration | null>(null)

  // Compare with the previous render during render (React's "adjust state
  // when a prop changes" pattern) — only a change on the same day counts,
  // so loading the app, switching days or restarting never celebrates.
  if (seen.dayKey !== dayKey || seen.completed !== completed) {
    setSeen({ dayKey, completed })
    if (gate && seen.dayKey === dayKey && !seen.completed && completed) {
      const streak = streakEndingAt(gate.dayEntries, gate.todayDayNumber)
      setCelebration({
        dayNumber: gate.todayDayNumber,
        xpEarned: completedDayXp(streak),
        streak,
        isFinalDay: gate.todayDayNumber === CHALLENGE_LENGTH,
      })
    }
  }

  const dismiss = useCallback(() => setCelebration(null), [])
  return { celebration, dismiss }
}
