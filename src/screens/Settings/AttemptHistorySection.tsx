import { useLiveQuery } from 'dexie-react-hooks'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { ChallengeStatus } from '../../db/types'

const STATUS_STYLES: Record<ChallengeStatus, string> = {
  active: 'bg-green-light text-green',
  completed: 'bg-yellow-light text-yellow-dark',
  failed: 'bg-danger/10 text-danger-dark',
}

export function AttemptHistorySection() {
  const challenges = useLiveQuery(() => challengeRepo.getAll(), []) ?? []

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Attempt history</h2>

      <div className="mt-3 flex flex-col gap-2">
        {[...challenges].reverse().map((challenge) => (
          <div key={challenge.id} className="flex items-center justify-between rounded-2xl bg-canvas px-3 py-2">
            <div>
              <p className="font-rounded font-bold text-ink">Attempt #{challenge.attemptNumber}</p>
              <p className="text-xs text-ink-muted">Started {challenge.startDate}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 font-rounded text-xs font-bold capitalize ${STATUS_STYLES[challenge.status]}`}
            >
              {challenge.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
