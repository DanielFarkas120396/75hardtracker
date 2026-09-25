import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Workout, WorkoutType } from '../../db/types'
import { MIN_WORKOUT_MIN } from '../../logic/constants'

const WORKOUT_TYPES: WorkoutType[] = ['Running', 'Walking', 'Weights', 'Yoga', 'Cycling', 'Swimming', 'Other']
const MAX_WORKOUTS = 2

interface WorkoutCardProps {
  dayEntryId: number
  workouts: Workout[]
  complete: boolean
  cheer: string
}

export function WorkoutCard({ dayEntryId, workouts, complete, cheer }: WorkoutCardProps) {
  const addWorkout = () => {
    void workoutRepo.add({ dayEntryId, type: 'Running', durationMin: MIN_WORKOUT_MIN, isOutdoor: false })
  }

  return (
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">🏋️ Workouts</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Two sessions of at least {MIN_WORKOUT_MIN} minutes, one of them outdoors.
      </p>

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
