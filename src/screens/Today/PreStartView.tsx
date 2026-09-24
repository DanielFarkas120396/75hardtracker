import { Mascot } from '../../components/mascot/Mascot'
import type { Challenge } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { daysUntilStart } from '../../logic/days'

interface PreStartViewProps {
  challenge: Challenge
  todayDayNumber: number
}

/** What Today shows before Day 1: a countdown instead of task cards (no day can be logged yet). */
export function PreStartView({ challenge, todayDayNumber }: PreStartViewProps) {
  const brokenStartDate = !Number.isFinite(todayDayNumber)
  const days = daysUntilStart(todayDayNumber)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 pb-24 text-center">
      <Mascot state="idle" size={120} />
      <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
      {brokenStartDate ? (
        <>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">Pick a start date</h1>
          <p className="max-w-xs font-rounded text-ink-muted">
            Your challenge doesn't have a valid start date. Set one in Settings to begin.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">
            {days === 1 ? 'Day 1 starts tomorrow' : `Day 1 starts in ${days} days`}
          </h1>
          <p className="max-w-xs font-rounded text-ink-muted">
            Your {CHALLENGE_LENGTH} days begin on {formatDisplayDate(challenge.startDate)}. Use the time to pick
            your book, plan two workouts a day and stock up on water.
          </p>
          <p className="max-w-xs font-rounded text-sm text-ink-muted">
            You can still move the start date in Settings.
          </p>
        </>
      )}
    </div>
  )
}
