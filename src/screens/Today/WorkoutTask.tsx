import { useEffect, useState } from 'react'
import { MoodPicker } from '../../components/MoodPicker'
import { Button } from '../../components/ui/Button'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import type { Mood } from '../../content/moods'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Workout } from '../../db/types'
import { MAX_WORKOUTS } from '../../logic/constants'
import type { Ruleset } from '../../logic/rulesets'
import { ActivityPicker } from './ActivityPicker'

interface WorkoutTaskProps {
  dayEntryId: number
  workouts: Workout[]
  complete: boolean
  rules: Ruleset
  /** Whether this attempt's weekly recovery day (75 Soft) was taken on this entry. */
  restDay: boolean
  /** The day number of another entry in this challenge week that already took the recovery day, if any. */
  weekRestDay: number | undefined
  /** Opens the "Add workout" form: the sheet adds a session the same way as the tile's shortcut. */
  onAdd: () => void
}

/** How long "Workout removed · Undo" stays up. */
const UNDO_VISIBLE_MS = 5000

/** The workouts sheet's body: the day's sessions, and 75 Soft's recovery day. */
export function WorkoutTask({ dayEntryId, workouts, complete, rules, restDay, weekRestDay, onAdd }: WorkoutTaskProps) {
  const [restDayError, setRestDayError] = useState<string | null>(null)
  // The last removed session, kept for a moment so Undo can write it back as it was.
  const [removed, setRemoved] = useState<Workout | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const remove = (workout: Workout) => {
    setRemoved(workout)
    void workoutRepo.remove(workout.id)
  }

  const undoRemove = () => {
    if (!removed) return
    const { id: _id, ...again } = removed
    setRemoved(null)
    void workoutRepo.add(again)
  }

  const takeRestDay = async () => {
    setRestDayError(null)
    const result = await dayEntryRepo.setRestDay(dayEntryId, true)
    if (!result.ok && result.reason === 'week-taken') {
      setRestDayError(`Day ${result.dayNumber} was this week's recovery day.`)
    }
  }

  const undoRestDay = () => {
    setRestDayError(null)
    void dayEntryRepo.setRestDay(dayEntryId, false)
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {workouts.map((workout) => (
          <WorkoutRow key={workout.id} workout={workout} onRemove={() => remove(workout)} />
        ))}
      </div>

      {workouts.length < MAX_WORKOUTS && (
        <Button variant="secondary" className={`w-full ${workouts.length > 0 ? 'mt-4' : ''}`} onClick={onAdd}>
          + Add workout
        </Button>
      )}

      {rules.restDaysPerWeek > 0 && (
        <div className="mt-4">
          {restDay ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-light px-3 py-1 font-rounded text-sm font-bold text-green-ink">
                Recovery day ✓
              </span>
              <Button variant="secondary" onClick={undoRestDay}>
                Undo
              </Button>
            </div>
          ) : weekRestDay !== undefined ? (
            <p className="mt-3 font-rounded text-sm text-ink-muted">Day {weekRestDay} was this week's recovery day.</p>
          ) : (
            !complete && (
              <>
                <Button variant="secondary" className="w-full" onClick={() => void takeRestDay()}>
                  Take my recovery day
                </Button>
                {restDayError && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
                    {restDayError}
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}

      <div role="status" aria-live="polite">
        {removed && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2 font-rounded text-sm font-bold text-surface">
            <span>Workout removed</span>
            <button
              type="button"
              onClick={undoRemove}
              className="min-h-touch rounded-xl px-3 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-surface"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function WorkoutRow({ workout, onRemove }: { workout: Workout; onRemove: () => void }) {
  const setFeel = (feel: Mood) => {
    void workoutRepo.update(workout.id, { feel: workout.feel === feel ? undefined : feel })
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-rounded text-lg font-bold text-ink">{workout.type}</p>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove workout"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted"
        >
          ✕
        </button>
      </div>

      <ActivityPicker
        value={workout.type}
        onPick={(type) => void workoutRepo.update(workout.id, { type })}
        idleClassName="bg-surface"
      />

      <Stepper
        value={workout.durationMin}
        onStep={(delta) => void workoutRepo.adjustDuration(workout.id, delta, 0, 300)}
        step={5}
        min={0}
        max={300}
        unit="min"
      />

      <Toggle
        checked={workout.isOutdoor}
        onChange={(checked) => void workoutRepo.update(workout.id, { isOutdoor: checked })}
        label="Outdoor"
        activeColor="blue"
      />

      {/* The picker's group carries this label for screen readers. */}
      <p aria-hidden="true" className="font-rounded text-sm font-bold text-ink-muted">
        How did it feel?
      </p>
      <MoodPicker
        label="How did it feel?"
        value={workout.feel}
        onPick={setFeel}
        selectedClassName="bg-orange-light ring-2 ring-orange-ink"
        idleClassName="bg-surface"
      />
    </div>
  )
}
