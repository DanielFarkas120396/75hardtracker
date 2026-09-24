import { useEffect, useMemo, useState } from 'react'
import { badgeRepo } from '../db/repositories/badgeRepo'
import { bookRepo } from '../db/repositories/bookRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Badge, Challenge, DayEntry, Workout } from '../db/types'
import { BADGE_DEFINITIONS, evaluateNewBadges, type BadgeContext, type BadgeDefinition } from '../logic/badges'
import { MIN_WORKOUT_MIN, WATER_TARGET_ML } from '../logic/constants'

/**
 * Detects and persists newly-unlocked badges whenever today's data changes,
 * comparing against the challenge's full history. Returns the badge
 * definitions unlocked by the most recent check (for a celebration toast) —
 * this is transient, not the full unlocked set (see useBadges for that).
 */
export function useBadgeUnlocks(params: {
  challenge: Challenge | undefined
  entry: DayEntry | undefined
  workouts: Workout[] | undefined
  isPerfectDay: boolean | undefined
  streak: number
  unlockedBadges: Badge[]
}): BadgeDefinition[] {
  const [justUnlocked, setJustUnlocked] = useState<BadgeDefinition[]>([])
  const unlockedIds = useMemo(() => new Set(params.unlockedBadges.map((b) => b.badgeId)), [params.unlockedBadges])

  const { challenge, entry, workouts, isPerfectDay, streak } = params

  useEffect(() => {
    if (!challenge || !entry || !workouts || isPerfectDay === undefined) return
    let cancelled = false

    async function run() {
      const challengeId = challenge!.id
      const allEntries = await dayEntryRepo.getAllForChallenge(challengeId)
      const priorEntries = allEntries.filter((e) => e.id !== entry!.id)

      let workoutsLoggedBeforeToday = 0
      let outdoorQualifyingWorkoutsLoggedBeforeToday = 0
      let waterGoalHitOnAnyPriorDay = false
      let photosLoggedBeforeToday = 0

      for (const priorEntry of priorEntries) {
        const priorWorkouts = await workoutRepo.getForDayEntry(priorEntry.id)
        workoutsLoggedBeforeToday += priorWorkouts.length
        outdoorQualifyingWorkoutsLoggedBeforeToday += priorWorkouts.filter(
          (w) => w.durationMin >= MIN_WORKOUT_MIN && w.isOutdoor,
        ).length
        if (priorEntry.water_ml >= WATER_TARGET_ML) waterGoalHitOnAnyPriorDay = true
        if (priorEntry.photoId != null) photosLoggedBeforeToday += 1
      }

      const books = await bookRepo.getAll()
      // Book.finished has no timestamp, so we can't tell "before" from
      // "during" today precisely — treat any finished book as the trigger;
      // evaluateNewBadges's own alreadyUnlocked check keeps this a one-shot.
      const anyBookFinished = books.some((b) => b.finished)

      const todayQualifyingOutdoor = workouts!.some((w) => w.durationMin >= MIN_WORKOUT_MIN && w.isOutdoor)

      const context: BadgeContext = {
        streakLength: streak,
        isPerfectDay: isPerfectDay!,
        todayHasAnyWorkout: workouts!.length > 0,
        todayHasOutdoorQualifyingWorkout: todayQualifyingOutdoor,
        workoutsLoggedBeforeToday,
        outdoorQualifyingWorkoutsLoggedBeforeToday,
        todayHitWaterGoal: entry!.water_ml >= WATER_TARGET_ML,
        waterGoalHitOnAnyPriorDay,
        todayHasPhoto: entry!.photoId != null,
        photosLoggedBeforeToday,
        bookFinishedToday: anyBookFinished,
        booksFinishedBeforeToday: 0,
      }

      const newIds = evaluateNewBadges(context, unlockedIds)
      if (newIds.length === 0 || cancelled) return

      await Promise.all(
        newIds.map((id) => badgeRepo.unlock({ challengeId, badgeId: id, unlockedAt: new Date().toISOString() })),
      )

      if (!cancelled) {
        setJustUnlocked(BADGE_DEFINITIONS.filter((def) => newIds.includes(def.id)))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [challenge, entry, workouts, isPerfectDay, streak, unlockedIds])

  return justUnlocked
}
