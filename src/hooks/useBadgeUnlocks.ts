import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { loadBadgeEvaluation } from '../db/badgeEvaluation'
import { badgeRepo } from '../db/repositories/badgeRepo'
import { BADGE_DEFINITIONS, evaluateNewBadges, type BadgeDefinition } from '../logic/badges'
import type { ChallengeGate } from './useChallengeGate'

/**
 * Watches the current attempt's data and unlocks every badge it has earned
 * but doesn't have yet, returning a queue of toasts for the newly unlocked
 * ones. It runs at the App level, so badges earned by the last action of an
 * attempt (Day 75, when Today unmounts) still unlock.
 */
export function useBadgeUnlocks(gate: ChallengeGate | undefined) {
  const challenge = gate && gate.kind !== 'needsRestart' ? gate.challenge : undefined
  const todayDayNumber = gate?.todayDayNumber

  // The challenge row only matters by id and start date, so those are the deps
  // (the gate hands us a new object on every emission).
  const evaluation = useLiveQuery(async () => {
    if (!challenge || todayDayNumber === undefined) return undefined
    return loadBadgeEvaluation(challenge, todayDayNumber)
  }, [challenge?.id, challenge?.startDate, todayDayNumber])

  const [toasts, setToasts] = useState<BadgeDefinition[]>([])

  const challengeId = challenge?.id
  useEffect(() => {
    if (!evaluation || challengeId === undefined) return
    const earned = evaluateNewBadges(evaluation.context, evaluation.unlockedBadgeIds)
    if (earned.length === 0) return

    void badgeRepo.unlockMissing(challengeId, earned).then((added) => {
      if (added.length === 0) return
      setToasts((queue) => [
        ...queue,
        ...BADGE_DEFINITIONS.filter((def) => added.includes(def.id) && !queue.some((q) => q.id === def.id)),
      ])
    })
  }, [evaluation, challengeId])

  const dismiss = useCallback((badgeId: string) => {
    setToasts((queue) => queue.filter((b) => b.id !== badgeId))
  }, [])

  return { toasts, dismiss }
}
