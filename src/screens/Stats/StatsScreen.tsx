import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { rulesFor } from '../../logic/rulesets'
import { BodySection } from './BodySection'
import { ClimbCard } from './ClimbCard'
import { BookStackArt, BottleArt, StatTile } from './StatTiles'
import { WorkoutsSection } from './WorkoutsSection'

interface StatsScreenProps {
  challenge: Challenge
  streak: number
  today: string
  todayDayNumber: number
  completed: boolean
}

/** The attempt as a story: how far up the climb, what it took (illustrated totals), then the body and the workouts. */
export function StatsScreen({ challenge, streak, today, todayDayNumber, completed }: StatsScreenProps) {
  const stats = useChallengeStats(challenge.id)
  const rules = rulesFor(challenge)
  const dayReached = completed ? CHALLENGE_LENGTH : todayDayNumber
  // The bottle fills against the water owed so far, so it means something from Day 1.
  const daysSoFar = Math.min(CHALLENGE_LENGTH, Math.max(1, Number.isFinite(dayReached) ? dayReached : 1))

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="font-rounded text-sm font-semibold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-wide text-ink">
            <Icon name="stats" className="text-world-ink" />
            Stats
          </h1>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main className="flex flex-col gap-4 px-4">
        <ClimbCard dayReached={dayReached} />

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            art={<BottleArt fill={stats.water_ml / (rules.waterTargetMl * daysSoFar)} />}
            value={`${(stats.water_ml / 1000).toFixed(1)} L`}
            label="Water drunk"
            tone="text-blue-ink"
          />
          <StatTile art={<BookStackArt pages={stats.pages} />} value={`${stats.pages}`} label="Pages read" tone="text-world-ink" />
        </div>

        <BodySection today={today} />
        <WorkoutsSection challengeId={challenge.id} />
      </main>
    </div>
  )
}
