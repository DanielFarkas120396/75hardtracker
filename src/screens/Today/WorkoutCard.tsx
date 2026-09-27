import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import { workoutRuleLine } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Workout, WorkoutType } from '../../db/types'
import { MAX_WORKOUTS } from '../../logic/constants'
import type { Ruleset } from '../../logic/rulesets'

const WORKOUT_TYPES: WorkoutType[] = ['Running', 'Walking', 'Weights', 'Yoga', 'Cycling', 'Swimming', 'Other']

interface WorkoutCardProps {
  dayEntryId: number
  workouts: Workout[]
  complete: boolean
  cheer: string
  rules: Ruleset
  /** Whether this attempt's weekly recovery day (75 Soft) was taken on this entry. */
  restDay: boolean
}

export function WorkoutCard({ dayEntryId, workouts, complete, cheer, rules, restDay }: WorkoutCardProps) {
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
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">🏋️ Workouts</h2>
      <p className="mt-1 text-sm text-ink-muted">{workoutRuleLine(rules)}</p>

      <div className="mt-4 flex flex-col gap-3">
        {workouts.map((workout) => (
          <WorkoutRow key={workout.id} workout={workout} />
        ))}
      </div>

      {workouts.length < MAX_WORKOUTS && (
        <Button variant="secondary" className="mt-4 w-full" onClick={addWorkout}>
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
          ) : (
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
          )}
        </div>
      )}
    </Card>
  )
}

function WorkoutRow({ workout }: { workout: Workout }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <select
          value={workout.type}
          onChange={(e) => void workoutRepo.update(workout.id, { type: e.target.value as WorkoutType })}
          className="min-h-touch flex-1 rounded-xl bg-surface px-3 font-rounded font-bold text-ink"
        >
          {WORKOUT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void workoutRepo.remove(workout.id)}
          aria-label="Remove workout"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted"
        >
          ✕
        </button>
      </div>

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
    </div>
  )
}
