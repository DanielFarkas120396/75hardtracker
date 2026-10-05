import { useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { MoodPicker } from '../../components/MoodPicker'
import { Button } from '../../components/ui/Button'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import { ACTIVITY_ICONS } from '../../content/activities'
import type { Mood } from '../../content/moods'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Workout, WorkoutType } from '../../db/types'
import { MAX_WORKOUTS, WORKOUT_TYPES } from '../../logic/constants'
import type { Ruleset } from '../../logic/rulesets'

interface WorkoutTaskProps {
  dayEntryId: number
  workouts: Workout[]
  complete: boolean
  rules: Ruleset
  /** Whether this attempt's weekly recovery day (75 Soft) was taken on this entry. */
  restDay: boolean
  /** The day number of another entry in this challenge week that already took the recovery day, if any. */
  weekRestDay: number | undefined
}

/** The workouts sheet's body: the day's sessions, and 75 Soft's recovery day. */
export function WorkoutTask({ dayEntryId, workouts, complete, rules, restDay, weekRestDay }: WorkoutTaskProps) {
  const [restDayError, setRestDayError] = useState<string | null>(null)

  const addWorkout = () => {
    void workoutRepo.add({ dayEntryId, type: 'Running', durationMin: rules.minWorkoutMin, isOutdoor: false })
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
          <WorkoutRow key={workout.id} workout={workout} />
        ))}
      </div>

      {workouts.length < MAX_WORKOUTS && (
        <Button variant="secondary" className={`w-full ${workouts.length > 0 ? 'mt-4' : ''}`} onClick={addWorkout}>
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
    </div>
  )
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const setFeel = (feel: Mood) => {
    void workoutRepo.update(workout.id, { feel: workout.feel === feel ? undefined : feel })
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-rounded text-lg font-extrabold text-ink">{workout.type}</p>
        <button
          type="button"
          onClick={() => void workoutRepo.remove(workout.id)}
          aria-label="Remove workout"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted"
        >
          ✕
        </button>
      </div>

      <ActivityPicker value={workout.type} onPick={(type) => void workoutRepo.update(workout.id, { type })} />

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
        label={workout.isOutdoor ? 'Outdoor' : 'Indoor'}
        activeColor="blue"
      />

      <p className="font-rounded text-sm font-bold text-ink-muted">How did it feel?</p>
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

/** The seven activities as logos; the chosen one is ringed in the workouts' orange. */
function ActivityPicker({ value, onPick }: { value: WorkoutType; onPick: (type: WorkoutType) => void }) {
  return (
    <div role="group" aria-label="Activity" className="grid grid-cols-7 gap-1">
      {WORKOUT_TYPES.map((type) => {
        const selected = type === value
        return (
          <button
            key={type}
            type="button"
            aria-label={type}
            aria-pressed={selected}
            onClick={() => onPick(type)}
            className={`flex h-11 items-center justify-center rounded-xl motion-safe:transition-colors ${
              selected ? 'bg-orange-light text-orange-ink ring-2 ring-orange-ink' : 'bg-surface text-ink-muted'
            }`}
          >
            <Icon name={ACTIVITY_ICONS[type]} size={26} strokeWidth={1.8} />
          </button>
        )
      })}
    </div>
  )
}
