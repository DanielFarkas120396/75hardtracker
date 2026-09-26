import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { TASK_NAMES } from '../../content/microcopy'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import { minutesToFinish, parseHHmm, planError, type PlanError } from '../../logic/menace'
import type { DayTaskData, TaskId } from '../../logic/types'

const ERROR_TEXT: Record<PlanError, string> = {
  past: 'Pick a time later than now.',
  'past-midnight': "That won't fit before midnight.",
}

interface PlanSheetProps {
  open: boolean
  entry: DayEntry
  data: DayTaskData
  missing: readonly TaskId[]
  nowMin: number
  onClose: () => void
  /** Called after saving, with the earliest saved time still ahead of `nowMin` (null when there is none). */
  onSaved: (earliest: number | null) => void
}

/** "Tell the duck your plan": a time for each task still missing today. */
export function PlanSheet(props: PlanSheetProps) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <PlanForm {...props} />
    </Modal>
  )
}

/** Mounted each time the sheet opens, so the draft starts from the saved plan. */
function PlanForm({ entry, data, missing, nowMin, onClose, onSaved }: PlanSheetProps) {
  const saved = entry.plans ?? {}
  const [draft, setDraft] = useState<Partial<Record<TaskId, string>>>(() => ({ ...saved }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Only rows changed since the sheet opened are checked, so an earlier plan
  // whose time has passed never blocks saving the others.
  const errorFor = (task: TaskId): PlanError | null => {
    const value = draft[task]
    if (!value || value === saved[task]) return null
    return planError(task, value, data, nowMin)
  }
  const hasErrors = missing.some((task) => errorFor(task) !== null)

  const save = async () => {
    if (hasErrors) return
    setSaving(true)
    setSaveError(null)
    try {
      const plans: Partial<Record<TaskId, string>> = {}
      const estimates: Partial<Record<TaskId, number>> = {}
      for (const task of missing) {
        const value = draft[task]
        if (value && parseHHmm(value) !== null) {
          plans[task] = value
          const storedEstimate = entry.planEstimates?.[task]
          estimates[task] = value === saved[task] && typeof storedEstimate === 'number' ? storedEstimate : minutesToFinish(task, data)
        }
      }
      await dayEntryRepo.setPlans(entry.id, plans, estimates)
      const upcoming = Object.values(plans)
        .map((value) => parseHHmm(value!)!)
        .filter((at) => at >= nowMin)
      onSaved(upcoming.length > 0 ? Math.min(...upcoming) : null)
    } catch {
      setSaveError("Couldn't save your plan — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h3 className="font-rounded text-lg font-extrabold text-ink">Tell the duck your plan</h3>
      <p className="mt-1 text-sm text-ink-muted">He leaves a task alone until its time comes. Break the plan and he'll know.</p>
      {missing.map((task) => {
        const error = errorFor(task)
        return (
          <Field key={task} label={TASK_NAMES[task]} error={error ? ERROR_TEXT[error] : undefined}>
            <span className="flex gap-2">
              <input
                type="time"
                aria-label={TASK_NAMES[task]}
                value={draft[task] ?? ''}
                onChange={(e) => setDraft((previous) => ({ ...previous, [task]: e.target.value }))}
                className="min-h-touch min-w-0 flex-1 rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
              />
              {draft[task] && (
                <button
                  type="button"
                  aria-label={`Clear ${TASK_NAMES[task]}`}
                  onClick={() =>
                    setDraft((previous) => {
                      const next = { ...previous }
                      delete next[task]
                      return next
                    })
                  }
                  className="min-h-touch shrink-0 rounded-xl px-3 font-rounded text-sm font-bold text-ink-muted"
                >
                  Clear
                </button>
              )}
            </span>
          </Field>
        )
      })}
      {saveError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {saveError}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void save()} disabled={saving || hasErrors}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </>
  )
}
