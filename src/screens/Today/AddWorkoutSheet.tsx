import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/icons/Icon'
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
import { TASK_ICONS, TASK_TONE } from './taskTones'

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
      {/* The same header as the task sheets: the world tint, the icon, the title and a close button. */}
      <header className={`-mx-5 -mt-5 flex items-center gap-3 rounded-t-[2.5rem] px-5 pt-5 pb-4 ${TASK_TONE.tint}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface ${TASK_TONE.ink}`}>
          <Icon name={TASK_ICONS.workouts} />
        </span>
        <h2 id="add-workout-title" className="min-w-0 flex-1 font-rounded text-xl font-extrabold text-ink">
          Add workout
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Icon name="close" size={20} />
        </button>
      </header>
      <div className="mt-4 flex flex-col gap-3">
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
        <Toggle checked={isOutdoor} onChange={setIsOutdoor} label="Outdoor" activeColor="blue" />
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
