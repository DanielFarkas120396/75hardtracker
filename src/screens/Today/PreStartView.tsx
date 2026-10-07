import { useState } from 'react'
import { Mascot } from '../../components/mascot/Mascot'
import { Greeting, WhyQuote } from '../../components/ProfileLines'
import { Button } from '../../components/ui/Button'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { preStartPlanLine, VARIANT_NAMES } from '../../content/variants'
import type { Challenge } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { daysUntilStart } from '../../logic/days'
import { rulesFor } from '../../logic/rulesets'
import { BookPicker } from './ReadingTask'
import { SocialOccasionSheet } from './SocialOccasionSheet'

interface PreStartViewProps {
  challenge: Challenge
  todayDayNumber: number
  today: string
}

/**
 * What Today shows before Day 1: a countdown instead of task cards (no day can
 * be logged yet), in the Today hero's look (the ring at 0), so Day 1 isn't a jump.
 */
export function PreStartView({ challenge, todayDayNumber, today }: PreStartViewProps) {
  const brokenStartDate = !Number.isFinite(todayDayNumber)
  const days = daysUntilStart(todayDayNumber)
  const rules = rulesFor(challenge)
  const [socialOpen, setSocialOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-center">
      <Greeting />
      <section className="flex w-full max-w-xs flex-col items-center gap-3 rounded-card bg-world-soft px-3 py-4">
        <p className="font-rounded text-xs font-bold text-ink-muted">
          {VARIANT_NAMES[rules.variant]} #{challenge.attemptNumber}
        </p>
        <div className="flex items-end gap-2">
          <Mascot mood="waiting" size={64} />
          <ProgressRing value={0} max={TASK_IDS.length} size={112} strokeWidth={10} trackColor="var(--color-surface)">
            <span className="font-display text-3xl tracking-wide text-ink-muted">0/{TASK_IDS.length}</span>
          </ProgressRing>
        </div>
        <WhyQuote className="max-w-xs" />
      </section>
      {brokenStartDate ? (
        <>
          <h1 className="font-display text-2xl tracking-wide text-ink">Pick a start date</h1>
          <p className="max-w-xs font-rounded text-ink-muted">
            Your challenge doesn't have a valid start date. Set one in Settings to begin.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl tracking-wide text-ink">
            {days === 1 ? 'Day 1 starts tomorrow' : `Day 1 starts in ${days} days`}
          </h1>
          <p className="max-w-xs font-rounded text-ink-muted">
            Your {CHALLENGE_LENGTH} days begin on {formatDisplayDate(challenge.startDate)}. Use the time to pick
            your book, {preStartPlanLine(rules)} and stock up on water.
          </p>
          <p className="max-w-xs font-rounded text-sm text-ink-muted">
            You can still move the start date in Settings.
          </p>
          <section aria-label="Your book" className="w-full max-w-xs rounded-card bg-surface p-3 text-left shadow-sm">
            <BookPicker />
          </section>
          {rules.socialDaysPerWeek > 0 && (
            <Button variant="secondary" onClick={() => setSocialOpen(true)}>
              🥂 Plan a social occasion
            </Button>
          )}
        </>
      )}

      <SocialOccasionSheet
        open={socialOpen}
        challenge={challenge}
        today={today}
        todayDayNumber={todayDayNumber}
        onClose={() => setSocialOpen(false)}
        onDeclared={() => {}}
      />
    </div>
  )
}
