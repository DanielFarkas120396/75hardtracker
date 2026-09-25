import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { Challenge } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import { daysUntilStart, isChallengeDay } from '../../logic/days'
import { isStartDateEditable, validateStartDateChange, type StartDateChangeResult } from '../../logic/startDate'

type Rejection = Extract<StartDateChangeResult, { ok: false }>['reason']

const REJECTION_MESSAGES: Record<Rejection, string> = {
  empty: 'Pick a date first.',
  invalid: "That isn't a valid date.",
  past: "The start date can't be in the past — earlier days can't be backfilled.",
  locked: 'The start date is locked once your attempt is past Day 1.',
}

interface StartDateSectionProps {
  challenge: Challenge
  today: string
  todayDayNumber: number
}

function statusLine(challenge: Challenge, todayDayNumber: number): string {
  const days = daysUntilStart(todayDayNumber)
  if (days > 0) return `Starts ${days === 1 ? 'tomorrow' : `in ${days} days`} — ${formatDisplayDate(challenge.startDate)}.`
  if (todayDayNumber === 1) return `Day 1 is today — ${formatDisplayDate(challenge.startDate)}.`
  if (isChallengeDay(todayDayNumber)) return `Day 1 was ${formatDisplayDate(challenge.startDate)}.`
  return "Your start date isn't valid — pick a new one."
}

/**
 * Edits the active attempt's start date: today or later, and only before or
 * on Day 1 (see validateStartDateChange). Moving the start while Day 1 has
 * logs clears them, so that asks for confirmation first.
 */
export function StartDateSection({ challenge, today, todayDayNumber }: StartDateSectionProps) {
  const [draft, setDraft] = useState(challenge.startDate)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasLoggedProgress = useLiveQuery(() => dayEntryRepo.hasLoggedProgress(challenge.id), [challenge.id]) ?? false

  const editable = isStartDateEditable(todayDayNumber)

  const apply = async () => {
    setSaving(true)
    try {
      const result = await challengeRepo.changeStartDate(challenge.id, draft, today)
      setError(result.ok ? null : REJECTION_MESSAGES[result.reason])
    } finally {
      setSaving(false)
      setConfirmClear(false)
    }
  }

  const save = () => {
    const result = validateStartDateChange({ proposed: draft, today, todayDayNumber })
    if (!result.ok) {
      setError(REJECTION_MESSAGES[result.reason])
      return
    }
    setError(null)
    if (draft === challenge.startDate) return
    if (hasLoggedProgress) {
      setConfirmClear(true)
      return
    }
    void apply()
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Challenge start date</h2>
      <p className="mt-1 text-sm text-ink-muted">{statusLine(challenge, todayDayNumber)}</p>

      {editable ? (
        <>
          <div className="mt-3 flex gap-2">
            <input
              type="date"
              value={draft}
              min={today}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(null)
              }}
              aria-label="Start date"
              className="min-h-touch min-w-0 flex-1 rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
            />
            <Button
              variant="secondary"
              onClick={save}
              disabled={saving || draft === challenge.startDate}
              className="shrink-0"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Today or later. It locks once Day 2 begins.</p>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm font-semibold text-ink-muted">
          🔒 Locked — your attempt is past Day 1, so its days are set.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Move the start date?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          You've already logged progress for Day 1. Moving the start to {formatDisplayDate(draft)} clears it —
          workouts, water, pages, diet, the photo and any badges earned so far.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void apply()} disabled={saving}>
            {saving ? 'Moving…' : 'Clear & move'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmClear(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  )
}
