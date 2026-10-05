import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { WorkoutType } from '../../db/types'
import { WORKOUT_TYPES } from '../../logic/constants'
import type { Ruleset } from '../../logic/rulesets'

const MAX_MIN = 300

interface AddWorkoutSheetProps {
  open: boolean
  dayEntryId: number
  rules: Ruleset
  onClose: () => void
}

/** The Workouts tile's shortcut: a small sheet asking the activity and the length, then saving the session. */
export function AddWorkoutSheet({ open, dayEntryId, rules, onClose }: AddWorkoutSheetProps) {
  // Portalled: the board sits in a stacking context under the tab bar, and the sheet must cover it.
  return createPortal(
    <Modal open={open} onClose={onClose} placement="sheet" labelledBy="add-workout-title">
      <AddWorkoutForm dayEntryId={dayEntryId} rules={rules} onClose={onClose} />
    </Modal>,
    document.body,
  )
}

/** Mounted each time the sheet opens, so it starts from the defaults again. */
function AddWorkoutForm({ dayEntryId, rules, onClose }: Omit<AddWorkoutSheetProps, 'open'>) {
  const [type, setType] = useState<WorkoutType>('Running')
  const [durationMin, setDurationMin] = useState(rules.minWorkoutMin)
  const [isOutdoor, setIsOutdoor] = useState(false)

  const save = async () => {
    await workoutRepo.add({ dayEntryId, type, durationMin, isOutdoor })
    onClose()
  }

  return (
    <>
      <h2 id="add-workout-title" className="font-rounded text-lg font-extrabold text-ink">
        Add workout
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as WorkoutType)}
          aria-label="Activity"
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        >
          {WORKOUT_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="flex justify-center">
          <Stepper
            value={durationMin}
            onStep={(delta) => setDurationMin((value) => Math.min(MAX_MIN, Math.max(0, value + delta)))}
            step={5}
            min={0}
            max={MAX_MIN}
            unit="min"
          />
        </div>
        <Toggle checked={isOutdoor} onChange={setIsOutdoor} label={isOutdoor ? 'Outdoor' : 'Indoor'} activeColor="blue" />
        <Button variant="primary" className="w-full" onClick={() => void save()} disabled={durationMin === 0}>
          Save
        </Button>
      </div>
    </>
  )
}
