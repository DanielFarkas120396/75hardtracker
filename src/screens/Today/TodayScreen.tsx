import { useEffect, useState } from 'react'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { BadgeUnlockToast } from '../../components/BadgeUnlockToast'
import { FlameStreak } from '../../components/FlameStreak'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { useActiveChallenge } from '../../hooks/useActiveChallenge'
import { useBadgeUnlocks } from '../../hooks/useBadgeUnlocks'
import { useBadges } from '../../hooks/useBadges'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useStreak } from '../../hooks/useStreak'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { useXpTotal } from '../../hooks/useXpTotal'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { calculateDayXp } from '../../logic/xp'
import type { BadgeDefinition } from '../../logic/badges'
import { DayCompleteCelebration } from './DayCompleteCelebration'
import { DietCard } from './DietCard'
import { PhotoCard } from './PhotoCard'
import { ReadingCard } from './ReadingCard'
import { WaterCard } from './WaterCard'
import { WorkoutCard } from './WorkoutCard'

export function TodayScreen() {
  const challenge = useActiveChallenge()
  const { entry, dayNumber } = useTodayEntry(challenge)
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts)
  const streak = useStreak(challenge?.id)
  const xpTotal = useXpTotal(challenge?.id)
  const unlockedBadges = useBadges(challenge?.id)

  const [showCelebration, setShowCelebration] = useState(false)
  const [toastQueue, setToastQueue] = useState<BadgeDefinition[]>([])

  const newlyUnlocked = useBadgeUnlocks({
    challenge,
    entry,
    workouts,
    isPerfectDay: completion?.isComplete,
    streak,
    unlockedBadges,
  })

  useEffect(() => {
    if (newlyUnlocked.length === 0) return
    setToastQueue((prev) => {
      const existingIds = new Set(prev.map((b) => b.id))
      const additions = newlyUnlocked.filter((b) => !existingIds.has(b.id))
      return additions.length > 0 ? [...prev, ...additions] : prev
    })
  }, [newlyUnlocked])

  useEffect(() => {
    if (!entry || !completion) return
    // Compare against the persisted `completed` flag (not local component
    // state) so remounting the screen — e.g. switching tabs — never
    // re-triggers the celebration for a day that was already finished.
    if (completion.isComplete && !entry.completed) {
      setShowCelebration(true)
    }
    if (completion.isComplete !== entry.completed) {
      void dayEntryRepo.update(entry.id, { completed: completion.isComplete })
    }
  }, [entry, completion])

  if (!challenge || !entry || !workouts || !completion || dayNumber === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const completedCount = Object.values(completion.completion).filter(Boolean).length
  const todayXp = calculateDayXp(completion.data, streak).total

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">
            Day {dayNumber} / {CHALLENGE_LENGTH}
          </h1>
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-dark">⭐ {xpTotal} XP</p>
        </div>
        <div className="flex items-center gap-3">
          <FlameStreak streak={streak} />
          <ProgressRing value={completedCount} max={5}>
            <span className="font-rounded text-sm font-extrabold text-ink">{completedCount}/5</span>
          </ProgressRing>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4">
        <WorkoutCard dayEntryId={entry.id} workouts={workouts} complete={completion.completion.workouts} />
        <DietCard entry={entry} complete={completion.completion.diet} />
        <WaterCard entry={entry} complete={completion.completion.water} />
        <ReadingCard entry={entry} complete={completion.completion.reading} />
        <PhotoCard entry={entry} complete={completion.completion.photo} />
      </main>

      <DayCompleteCelebration
        visible={showCelebration}
        dayNumber={dayNumber}
        xpEarned={todayXp}
        onDismiss={() => setShowCelebration(false)}
      />

      <BadgeUnlockToast
        badges={toastQueue}
        onDismiss={(id) => setToastQueue((prev) => prev.filter((b) => b.id !== id))}
      />
    </div>
  )
}
