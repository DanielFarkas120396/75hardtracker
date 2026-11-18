import { formatHHmm, minutesToFinish, parseHHmm, planError, type PlanError } from '@logic/menace'
import { TASK_NAMES } from '@logic/microcopy'
import type { Ruleset } from '@logic/rulesets'
import type { DayTaskData, TaskId } from '@logic/types'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { TimeField } from '../components/ui/PickerField'
import { SheetHeader } from '../components/ui/Sheet'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { DayEntry } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useTheme } from '../theme/ThemeProvider'

const ERROR_TEXT: Record<PlanError, string> = {
  past: 'Pick a time later than now.',
  'past-midnight': "That won't fit before midnight.",
}

/** The time a row starts on when "Set a time" is tapped: the next quarter of an hour at least 30 minutes away, and before midnight whatever the hour. */
function suggestedTime(nowMin: number): string {
  return formatHHmm(Math.min(23 * 60 + 59, Math.ceil((nowMin + 30) / 15) * 15))
}

interface PlanFormProps {
  entry: DayEntry
  data: DayTaskData
  missing: readonly TaskId[]
  nowMin: number
  rules: Ruleset
  onClose: () => void
  /** Called after saving, with the earliest saved time still ahead of `nowMin` (null when there is none). */
  onSaved: (earliest: number | null) => void
}

/**
 * "Tell the duck your plan": a time for each task still missing today. The
 * web's PlanSheet (src/screens/Today/PlanSheet.tsx). It is mounted each time
 * it opens, so the draft starts from the saved plan. A row with no plan shows
 * "Set a time": the phone's time picker always shows a time, and "no plan"
 * must stay possible.
 */
export function PlanForm({ entry, data, missing, nowMin, rules, onClose, onSaved }: PlanFormProps) {
  const { colors, fonts } = useTheme()
  const saved = entry.plans ?? {}
  const [draft, setDraft] = useState<Partial<Record<TaskId, string>>>(() => ({ ...saved }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Only rows changed since the sheet opened are checked, so an earlier plan
  // whose time has passed never blocks saving the others.
  const errorFor = (task: TaskId): PlanError | null => {
    const value = draft[task]
    if (!value || value === saved[task]) return null
    return planError(task, value, data, nowMin, rules)
  }
  const rowErrors = missing.flatMap((task) => {
    const error = errorFor(task)
    return error ? [`${TASK_NAMES[task]}: ${ERROR_TEXT[error]}`] : []
  })
  const hasErrors = rowErrors.length > 0
  // A refused time greys Save out: said aloud, or it would happen in silence.
  useAnnounceChanges(saveError ?? rowErrors.join(' '))

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
          estimates[task] = value === saved[task] && typeof storedEstimate === 'number' ? storedEstimate : minutesToFinish(task, data, rules)
        }
      }
      await dayEntryRepo.setPlans(entry.id, plans, estimates)
      const upcoming = Object.values(plans)
        .map((value) => parseHHmm(value)!)
        .filter((at) => at >= nowMin)
      onSaved(upcoming.length > 0 ? Math.min(...upcoming) : null)
    } catch {
      setSaveError("Couldn't save your plan — try again.")
      setSaving(false)
    }
  }

  const clear = (task: TaskId) =>
    setDraft((previous) => {
      const next = { ...previous }
      delete next[task]
      return next
    })

  return (
    <>
      <SheetHeader icon="calendar" title="Tell the duck your plan" ruleLine="He leaves a task alone until its time comes. Break the plan and he'll know." onClose={onClose} />
      <View style={styles.rows}>
        {missing.map((task) => {
          const value = draft[task]
          const error = errorFor(task)
          return (
            <Field key={task} label={TASK_NAMES[task]} error={error ? ERROR_TEXT[error] : undefined}>
              {value ? (
                <View style={styles.row}>
                  <TimeField label={TASK_NAMES[task]} value={value} onChange={(time) => setDraft((previous) => ({ ...previous, [task]: time }))} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${TASK_NAMES[task]}`} onPress={() => clear(task)} style={styles.clear}>
                    <Text style={[styles.clearText, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Clear</Text>
                  </Pressable>
                </View>
              ) : (
                <Button
                  label="Set a time"
                  variant="secondary"
                  accessibilityLabel={`Set a time for ${TASK_NAMES[task]}`}
                  onPress={() => setDraft((previous) => ({ ...previous, [task]: suggestedTime(nowMin) }))}
                />
              )}
            </Field>
          )
        })}
      </View>
      {saveError !== null && <Text style={[styles.error, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>{saveError}</Text>}
      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save plan'} onPress={() => void save()} disabled={saving || hasErrors} style={styles.action} />
        <Button label="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={styles.action} />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  rows: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  clear: { minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12 },
  clearText: { fontSize: 14 },
  error: { marginTop: 8, fontSize: 14 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
})
