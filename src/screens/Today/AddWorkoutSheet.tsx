import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MoodPicker } from '../../components/MoodPicker'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Stepper } from '../../components/ui/Stepper'
import { Toggle } from '../../components/ui/Toggle'
import type { Mood } from '../../content/moods'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { WorkoutType } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import { ActivityPicker } from './ActivityPicker'

const MAX_MIN = 300

interface AddWorkoutSheetProps {
  open: boolean
  dayEntryId: number
  rules: Ruleset
  onClose: () => void
}

/** The Workouts tile's shortcut: a small sheet asking the activity, the length and how it felt, then saving the session. */
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
  const [feel, setFeel] = useState<Mood | undefined>(undefined)

  const save = async () => {
    await workoutRepo.add({ dayEntryId, type, durationMin, isOutdoor, ...(feel ? { feel } : {}) })
    onClose()
  }

  return (
    <>
      <h2 id="add-workout-title" className="font-rounded text-lg font-extrabold text-ink">
        Add workout
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="font-rounded font-extrabold text-ink">{type}</p>
          <ActivityPicker value={type} onPick={setType} />
        </div>
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
        <div className="flex flex-col gap-1.5">
          {/* The picker's group carries this label for screen readers. */}
          <p aria-hidden="true" className="font-rounded text-sm font-bold text-ink-muted">
            How did it feel?
          </p>
          <MoodPicker
            label="How did it feel?"
            value={feel}
            onPick={(mood) => setFeel(feel === mood ? undefined : mood)}
            selectedClassName="bg-orange-light ring-2 ring-orange-ink"
          />
        </div>
        <Button variant="primary" className="w-full" onClick={() => void save()} disabled={durationMin === 0}>
          Save
        </Button>
      </div>
    </>
  )
}
