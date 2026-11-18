import { MAX_WORKOUTS, WORKOUT_TYPES } from '@logic/constants'
import { isQualifyingWorkout } from '@logic/dayCompletion'
import type { Mood } from '@logic/moods'
import type { Ruleset } from '@logic/rulesets'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import type { IconName } from '../components/icons/icons'
import { Button } from '../components/ui/Button'
import { MoodPicker, Stepper, Toggle } from '../components/ui/controls'
import { SheetHeader } from '../components/ui/Sheet'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Workout, WorkoutType } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useTheme } from '../theme/ThemeProvider'
import { useWorkoutsForEntry } from './hooks'

// The workouts sheet and the "Add workout" form, as on the web
// (src/screens/Today/WorkoutTask.tsx, AddWorkoutSheet.tsx, ActivityPicker.tsx).

/** Each activity's logo (the web's ACTIVITY_ICONS, src/content/activities.ts). */
const ACTIVITY_ICONS: Record<WorkoutType, IconName> = {
  Running: 'running',
  Walking: 'walking',
  Weights: 'weights',
  Yoga: 'yoga',
  Cycling: 'cycling',
  Swimming: 'swimming',
  Other: 'stopwatch',
}

const MAX_MIN = 300

/** How long "Workout removed · Undo" stays up. */
export const UNDO_VISIBLE_MS = 5000

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

/** The workouts sheet's body: the day's sessions, and 75 Soft's recovery day. */
export function WorkoutTask({ dayEntryId, workouts, complete, rules, restDay, weekRestDay, onAdd }: WorkoutTaskProps) {
  const { colors, fonts } = useTheme()
  const [restDayError, setRestDayError] = useState<string | null>(null)
  // The last removed session, kept for a moment so Undo can write it back as it was.
  const [removed, setRemoved] = useState<Workout | null>(null)
  useAnnounceChanges(removed ? 'Workout removed' : (restDayError ?? ''))

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
    if (!result.ok && result.reason === 'week-taken') setRestDayError(`Day ${result.dayNumber} was this week's recovery day.`)
  }

  const undoRestDay = () => {
    setRestDayError(null)
    void dayEntryRepo.setRestDay(dayEntryId, false)
  }

  const muted = { color: colors.inkMuted, fontFamily: fonts.rounded.regular }

  return (
    <View>
      <View style={styles.rows}>
        {workouts.map((workout) => (
          <WorkoutRow key={workout.id} workout={workout} minMinutes={rules.minWorkoutMin} onRemove={() => remove(workout)} />
        ))}
      </View>

      {workouts.length < MAX_WORKOUTS && (
        <Button label="+ Add workout" variant="secondary" onPress={onAdd} style={workouts.length > 0 ? styles.gap : undefined} />
      )}

      {rules.restDaysPerWeek > 0 && (
        <View style={styles.gap}>
          {restDay ? (
            <View style={styles.rest}>
              <View style={[styles.restPill, { backgroundColor: colors.greenLight }]}>
                <Text style={[styles.small, { color: colors.greenInk, fontFamily: fonts.rounded.bold }]}>Recovery day ✓</Text>
              </View>
              <Button label="Undo" variant="secondary" onPress={undoRestDay} />
            </View>
          ) : weekRestDay !== undefined ? (
            <Text style={[styles.small, muted]}>Day {weekRestDay} was this week&apos;s recovery day.</Text>
          ) : (
            !complete && (
              <>
                <Button label="Take my recovery day" variant="secondary" onPress={() => void takeRestDay()} />
                {restDayError !== null && (
                  <Text accessibilityRole="alert" style={[styles.small, styles.gapSmall, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>
                    {restDayError}
                  </Text>
                )}
              </>
            )
          )}
        </View>
      )}

      {removed && (
        <View accessibilityRole="alert" style={[styles.removed, { backgroundColor: colors.ink }]}>
          <Text style={[styles.small, { color: colors.surface, fontFamily: fonts.rounded.bold }]}>Workout removed</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={undoRemove} style={styles.undo}>
            <Text style={[styles.small, styles.underlined, { color: colors.surface, fontFamily: fonts.rounded.bold }]}>Undo</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function WorkoutRow({ workout, minMinutes, onRemove }: { workout: Workout; minMinutes: number; onRemove: () => void }) {
  const { colors, fonts } = useTheme()
  const setFeel = (feel: Mood) => {
    void workoutRepo.update(workout.id, { feel: workout.feel === feel ? undefined : feel })
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.canvas }]}>
      <View style={styles.rowHead}>
        <Text style={[styles.large, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{workout.type}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove workout" onPress={onRemove} style={styles.remove}>
          <Icon name="close" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>

      <ActivityPicker value={workout.type} onPick={(type) => void workoutRepo.update(workout.id, { type })} idleFill={colors.surface} />

      <Stepper
        value={workout.durationMin}
        onStep={(delta) => void workoutRepo.adjustDuration(workout.id, delta, 0, MAX_MIN)}
        step={5}
        min={0}
        max={MAX_MIN}
        unit="min"
      />
      {workout.durationMin < minMinutes && (
        <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
          Under {minMinutes} min: saved, but it doesn&apos;t count yet.
        </Text>
      )}

      <Toggle checked={workout.isOutdoor} onChange={(checked) => void workoutRepo.update(workout.id, { isOutdoor: checked })} label="Outdoor" activeColor="blue" />

      <Feel value={workout.feel} onPick={setFeel} idleFill={colors.surface} />
    </View>
  )
}

/** "How did it feel?" and the five moods, in the workouts' orange. */
function Feel({ value, onPick, idleFill }: { value: Mood | undefined; onPick: (mood: Mood) => void; idleFill?: string }) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.feel}>
      {/* The picker's group carries this label for VoiceOver. */}
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}
      >
        How did it feel?
      </Text>
      <MoodPicker label="How did it feel?" value={value} onPick={onPick} selected={{ fill: colors.orangeLight, ring: colors.orangeInk }} idleFill={idleFill} />
    </View>
  )
}

interface ActivityPickerProps {
  value: WorkoutType
  onPick: (type: WorkoutType) => void
  /** The other logos' background, set against what's behind the row. */
  idleFill?: string
}

/** The seven activities as logos; the chosen one is ringed in the workouts' orange. */
function ActivityPicker({ value, onPick, idleFill }: ActivityPickerProps) {
  const { colors } = useTheme()
  return (
    <View accessibilityLabel="Activity" style={styles.activities}>
      {WORKOUT_TYPES.map((type) => {
        const selected = type === value
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={type}
            accessibilityState={{ selected }}
            onPress={() => onPick(type)}
            style={[
              styles.activity,
              { backgroundColor: selected ? colors.orangeLight : (idleFill ?? colors.canvas) },
              selected && { borderWidth: 2, borderColor: colors.orangeInk },
            ]}
          >
            <Icon name={ACTIVITY_ICONS[type]} size={26} strokeWidth={1.8} color={selected ? colors.orangeInk : colors.inkMuted} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** Activities usually done outside: Outdoor starts on for them while the day still needs its outdoor workout. */
const OUTSIDE: ReadonlySet<WorkoutType> = new Set(['Running', 'Walking', 'Cycling'])

interface AddWorkoutFormProps {
  dayEntryId: number
  rules: Ruleset
  onClose: () => void
}

/**
 * The Workouts tile's shortcut: a small form asking the activity, the length
 * and how it felt, then saving the session. It is mounted each time it opens,
 * so it starts from the defaults again.
 */
export function AddWorkoutForm({ dayEntryId, rules, onClose }: AddWorkoutFormProps) {
  const { colors, fonts } = useTheme()
  const [type, setType] = useState<WorkoutType>('Running')
  const [durationMin, setDurationMin] = useState(rules.minWorkoutMin)
  // Until it's switched by hand, Outdoor follows the activity while the day still needs an outdoor session.
  const [outdoorChoice, setOutdoorChoice] = useState<boolean>()
  const [feel, setFeel] = useState<Mood | undefined>(undefined)
  const logged = useWorkoutsForEntry(dayEntryId) ?? []
  const needsOutdoor = rules.requireOutdoor && !logged.some((w) => w.isOutdoor && isQualifyingWorkout(w, rules))
  const isOutdoor = outdoorChoice ?? (needsOutdoor && OUTSIDE.has(type))
  const qualifying = logged.filter((w) => isQualifyingWorkout(w, rules)).length
  const saving = useRef(false)

  const save = async () => {
    // A double tap reaches here twice before the sheet closes, and two sessions would pass Hard's 2 × 45.
    // Once saved, the form is on its way out: it takes no second save.
    if (saving.current) return
    saving.current = true
    try {
      await workoutRepo.add({ dayEntryId, type, durationMin, isOutdoor, ...(feel ? { feel } : {}) })
      onClose()
    } catch (error) {
      saving.current = false
      throw error
    }
  }

  return (
    <>
      <SheetHeader icon="workout" title="Add workout" onClose={onClose} />
      <View style={styles.form}>
        <View style={styles.feel}>
          <Text style={[styles.base, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{type}</Text>
          <ActivityPicker value={type} onPick={setType} />
        </View>
        <View style={styles.centred}>
          <Stepper
            value={durationMin}
            onStep={(delta) => setDurationMin((value) => Math.min(MAX_MIN, Math.max(0, value + delta)))}
            step={5}
            min={0}
            max={MAX_MIN}
            unit="min"
          />
        </View>
        <View style={styles.outdoor}>
          <Toggle checked={isOutdoor} onChange={setOutdoorChoice} label="Outdoor" activeColor="blue" />
          {needsOutdoor && (
            <Text style={[styles.small, styles.hint, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
              {rules.requiredWorkouts - qualifying === 1 ? 'This one must be outdoors.' : "One of today's workouts must be outdoors."}
            </Text>
          )}
        </View>
        <Feel value={feel} onPick={(mood) => setFeel(feel === mood ? undefined : mood)} />
        <Button label="Save" onPress={() => void save()} disabled={durationMin === 0} />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  rows: { gap: 12 },
  gap: { marginTop: 16 },
  gapSmall: { marginTop: 8 },
  small: { fontSize: 14 },
  base: { fontSize: 16 },
  large: { fontSize: 18 },
  underlined: { textDecorationLine: 'underline' },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  removed: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, paddingLeft: 16, paddingRight: 4 },
  undo: { minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12 },
  row: { gap: 8, borderRadius: 16, padding: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  feel: { gap: 6 },
  activities: { flexDirection: 'row', gap: 2 },
  activity: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  form: { marginTop: 16, gap: 12 },
  centred: { alignItems: 'center' },
  outdoor: { gap: 4 },
  hint: { paddingHorizontal: 4 },
})
