import { useBadges } from '../../hooks/useBadges'
import { BADGE_DEFINITIONS } from '../../logic/badges'

interface BadgesSectionProps {
  challengeId: number
}

export function BadgesSection({ challengeId }: BadgesSectionProps) {
  const unlocked = useBadges(challengeId)
  const unlockedIds = new Set(unlocked.map((b) => b.badgeId))

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">
        🏅 Badges ({unlockedIds.size}/{BADGE_DEFINITIONS.length})
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {BADGE_DEFINITIONS.map((badge) => {
          const isUnlocked = unlockedIds.has(badge.id)
          // Locked badges are quieter (lock icon, muted name) rather than faded, so their text stays readable.
          return (
            <div key={badge.id} className={`rounded-2xl p-3 ${isUnlocked ? 'bg-yellow-light' : 'bg-canvas'}`}>
              <p className="text-xl">{isUnlocked ? '🏅' : '🔒'}</p>
              <p className={`mt-1 font-rounded text-sm font-bold ${isUnlocked ? 'text-ink' : 'text-ink-muted'}`}>
                {badge.name}
              </p>
              <p className="text-xs text-ink-muted">{badge.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
