import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { BodySection } from './BodySection'

interface StatsScreenProps {
  challenge: Challenge
  streak: number
  today: string
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-sm">
      <p className="font-rounded text-xs font-bold text-ink-muted">{label}</p>
      <p className={`mt-1 font-rounded text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  )
}

export function StatsScreen({ challenge, streak, today }: StatsScreenProps) {
  const stats = useChallengeStats(challenge.id)

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">📊 Stats</h1>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main className="flex flex-col gap-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total XP" value={`⭐ ${stats.xp}`} color="text-yellow-ink" />
          <StatCard
            label="Current streak"
            value={`🔥 ${streak} ${streak === 1 ? 'day' : 'days'}`}
            color="text-orange-ink"
          />
          <StatCard label="Perfect days" value={`${stats.perfectDays}`} color="text-green-ink" />
          <StatCard label="Water logged" value={`${(stats.water_ml / 1000).toFixed(1)} L`} color="text-blue-ink" />
          <StatCard label="Pages read" value={`${stats.pages}`} color="text-green-ink" />
          <StatCard label="Workout minutes" value={`${stats.workoutMinutes} min`} color="text-green-ink" />
        </div>

        <BodySection today={today} />
      </main>
    </div>
  )
}
