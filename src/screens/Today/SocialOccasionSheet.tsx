import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { addDaysISO, dateForDayNumber, dayNumberForDate, formatShortDay } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { challengeWeek } from '../../logic/rulesets'

interface SocialOccasionSheetProps {
  open: boolean
  challenge: Challenge
  today: string
  todayDayNumber: number
  onClose: () => void
  /** Called after a successful declaration, with the day number just declared. */
  onDeclared: (dayNumber: number) => void
}

/** "Plan a social occasion": a sheet to declare, or cancel, a day when a drink is allowed. */
export function SocialOccasionSheet(props: SocialOccasionSheetProps) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <SocialForm {...props} />
    </Modal>
  )
}

/** Mounted each time the sheet opens, so the date picker starts empty. */
function SocialForm({ challenge, today, todayDayNumber, onClose, onDeclared }: SocialOccasionSheetProps) {
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tomorrow = addDaysISO(today, 1)
  const start = challenge.startDate
  const min = tomorrow > start ? tomorrow : start
  const maxDate = dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)
  const declaredDays = (challenge.socialDays ?? []).filter((dayNumber) => dayNumber >= todayDayNumber)

  const declare = async () => {
    if (!picked) return
    setSaving(true)
    setError(null)
    try {
      const dayNumber = dayNumberForDate(challenge.startDate, picked)
      const result = await challengeRepo.setSocialDay(challenge.id, dayNumber, true, today)
      if (result.ok) {
        onDeclared(dayNumber)
        onClose()
        return
      }
      switch (result.reason) {
        case 'too-late':
          setError('Declare it the day before at the latest.')
          break
        case 'week-taken':
          setError(`Week ${challengeWeek(dayNumber)} already has one: Day ${result.dayNumber}.`)
          break
        case 'out-of-range':
          setError('Pick a day of this challenge.')
          break
        case 'not-allowed':
          setError("This challenge doesn't allow social occasions.")
          break
      }
    } catch {
      setError("Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h3 className="font-rounded text-lg font-extrabold text-ink">Plan a social occasion</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts.
      </p>

      <Field label="Day">
        <input
          type="date"
          aria-label="Day"
          min={min}
          max={maxDate}
          value={picked}
          onChange={(e) => {
            setPicked(e.target.value)
            setError(null)
          }}
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      </Field>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void declare()} disabled={saving || !picked}>
          {saving ? 'Saving…' : 'Declare'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
          Close
        </Button>
      </div>

      {declaredDays.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-ink-muted">Declared</h4>
          <div className="mt-2 flex flex-col gap-2">
            {declaredDays.map((dayNumber) => (
              <DeclaredRow
                key={dayNumber}
                challenge={challenge}
                today={today}
                dayNumber={dayNumber}
                isToday={dayNumber === todayDayNumber}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

interface DeclaredRowProps {
  challenge: Challenge
  today: string
  dayNumber: number
  isToday: boolean
}

/**
 * One declared day in the list. Today's row asks for confirmation before
 * cancelling — it can't be re-declared, and losing it flips the diet task —
 * while other days cancel as soon as Cancel is tapped, as before.
 */
function DeclaredRow({ challenge, today, dayNumber, isToday }: DeclaredRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.setSocialDay(challenge.id, dayNumber, false, today)
    } catch {
      setError("Couldn't save that — try again.")
    } finally {
      setBusy(false)
    }
  }

  if (isToday && confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-canvas px-3 py-2">
        <p className="font-rounded text-sm font-bold text-ink">
          Cancel today's occasion? You can't declare today again, and a drink today would break your diet.
        </p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void cancel()} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel it'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </Button>
        </div>
      </div>
    )
  }

  const label = isToday
    ? `Today · Day ${dayNumber}`
    : `${formatShortDay(dateForDayNumber(challenge.startDate, dayNumber))} · Day ${dayNumber}`

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-canvas px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-rounded text-sm font-bold text-ink">{label}</span>
        <Button
          variant="secondary"
          aria-label={`Cancel Day ${dayNumber}`}
          disabled={busy}
          onClick={() => (isToday ? setConfirming(true) : void cancel())}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
