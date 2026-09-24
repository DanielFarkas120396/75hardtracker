import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge } from '../../db/types'
import { useChallengeTotals } from '../../hooks/useChallengeTotals'
import { useXpTotal } from '../../hooks/useXpTotal'
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
  const xpTotal = useXpTotal(challenge.id)
  const totals = useChallengeTotals(challenge.id)

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
          <StatCard label="Total XP" value={`⭐ ${xpTotal}`} color="text-yellow-dark" />
          <StatCard
            label="Current streak"
            value={`🔥 ${streak} ${streak === 1 ? 'day' : 'days'}`}
            color="text-orange"
          />
          <StatCard label="Perfect days" value={`${totals.perfectDays}`} color="text-green" />
          <StatCard label="Water logged" value={`${(totals.water_ml / 1000).toFixed(1)} L`} color="text-blue" />
          <StatCard label="Pages read" value={`${totals.pages}`} color="text-green" />
          <StatCard label="Workout minutes" value={`${totals.workoutMinutes} min`} color="text-green" />
        </div>

        <BodySection today={today} />
      </main>
    </div>
  )
}
