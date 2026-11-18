import { taskCheer } from '@logic/microcopy'
import type { Ruleset } from '@logic/rulesets'
import { TASK_TITLES, type BoardTask } from '@logic/taskStatus'
import type { TaskId } from '@logic/types'
import { dietRuleLine, formatLiters, readingRuleLine, workoutRuleLine } from '@logic/variantsCopy'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import { DoneBadge } from '../components/ui/controls'
import { Sheet, SheetHeader } from '../components/ui/Sheet'
import type { DayEntry, Workout } from '../db/types'
import { useTheme } from '../theme/ThemeProvider'
import { DayNotesTask, DietTask, PhotoTask, WaterTask } from './taskBodies'
import { ReadingTask } from './ReadingTask'
import { TASK_ICONS } from './TaskTile'
import { AddWorkoutForm, WorkoutTask } from './WorkoutTask'

/** How long the cheer stays up before the sheet closes itself. */
export const CHEER_VISIBLE_MS = 1500

/** Everything a day's sheets need, from the screen showing the board. */
export interface TaskSheetContext {
  entry: DayEntry
  workouts: Workout[]
  completion: Record<TaskId, boolean>
  rules: Ruleset
  dayNumber: number
  /** Whether the day is a declared social occasion: a drink is allowed. */
  socialToday: boolean
  /** Another day of the same challenge week that took the recovery day, if any. */
  weekRestDay: number | undefined
  /** Only a photo from the library (finishing yesterday). */
  libraryOnly: boolean
  /** Opens the "Add workout" sheet: the workouts sheet adds through the same form as the tile. */
  onAddWorkout: () => void
}

// The web's taskSheets.tsx: each task's rule line, as typed there.
function ruleLine(task: BoardTask, ctx: TaskSheetContext): string {
  switch (task) {
    case 'workouts':
      return workoutRuleLine(ctx.rules)
    case 'diet':
      return dietRuleLine(ctx.rules)
    case 'water':
      return `Goal: ${formatLiters(ctx.rules.waterTargetMl)} L a day.`
    case 'reading':
      return readingRuleLine(ctx.rules)
    case 'photo':
      return ctx.libraryOnly ? "Yesterday's photo, from your library." : 'One progress photo a day.'
    case 'notes':
      return "Optional — just for you. It doesn't affect completing the day."
  }
}

function body(task: BoardTask, ctx: TaskSheetContext) {
  switch (task) {
    case 'workouts':
      return (
        <WorkoutTask
          dayEntryId={ctx.entry.id}
          workouts={ctx.workouts}
          complete={ctx.completion.workouts}
          rules={ctx.rules}
          restDay={ctx.entry.restDay === true}
          weekRestDay={ctx.weekRestDay}
          onAdd={ctx.onAddWorkout}
        />
      )
    case 'diet':
      return <DietTask entry={ctx.entry} rules={ctx.rules} socialToday={ctx.socialToday} />
    case 'water':
      return <WaterTask entry={ctx.entry} rules={ctx.rules} />
    case 'reading':
      return <ReadingTask entry={ctx.entry} rules={ctx.rules} />
    case 'photo':
      return <PhotoTask />
    case 'notes':
      return <DayNotesTask entry={ctx.entry} />
  }
}

/** What the day's sheet holds: one task's controls, or the "Add workout" form. */
export type OpenSheet = BoardTask | 'add-workout'

interface TaskSheetProps {
  /** What is open, or null when closed. */
  sheet: OpenSheet | null
  context: TaskSheetContext
  onClose: () => void
}

/**
 * The bottom sheet holding one task's controls, under a header in the world's
 * tint. When the task completes here, the header flips to done (tick and
 * cheer) and, except for workouts (a done workout can still get its feel),
 * the sheet closes on its own after the cheer. The web's TaskSheet.
 *
 * The "Add workout" form opens in this same sheet (the web has a second one):
 * the phone shows one sheet at a time, and a second asked for while the first
 * is still leaving would never appear.
 */
export function TaskSheet({ sheet, context, onClose }: TaskSheetProps) {
  const label = sheet === null ? '' : sheet === 'add-workout' ? 'Add workout' : TASK_TITLES[sheet]
  return (
    <Sheet open={sheet !== null} onClose={onClose} label={label}>
      {sheet === 'add-workout' ? (
        <AddWorkoutForm key={sheet} dayEntryId={context.entry.id} rules={context.rules} onClose={onClose} />
      ) : (
        sheet && <SheetContent key={sheet} task={sheet} context={context} onClose={onClose} />
      )}
    </Sheet>
  )
}

function SheetContent({ task, context, onClose }: { task: BoardTask; context: TaskSheetContext; onClose: () => void }) {
  const { colors, fonts } = useTheme()
  const complete = task === 'notes' ? false : context.completion[task]
  const cheer = task === 'notes' ? undefined : taskCheer(task, context.dayNumber, context.rules)
  const closesWhenDone = task !== 'workouts'

  // `justDone` counts switches to complete since the sheet opened; 0 means none (or undone).
  const [prevComplete, setPrevComplete] = useState(complete)
  const [justDone, setJustDone] = useState(0)
  if (prevComplete !== complete) {
    setPrevComplete(complete)
    setJustDone(complete ? justDone + 1 : 0)
  }

  useEffect(() => {
    if (justDone === 0) return
    if (cheer) AccessibilityInfo.announceForAccessibility(cheer)
    if (!closesWhenDone) return
    const timer = setTimeout(onClose, CHEER_VISIBLE_MS)
    return () => clearTimeout(timer)
    // The cheer and the way to close belong to the task this sheet was opened on.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [justDone])

  return (
    <>
      <SheetHeader
        icon={TASK_ICONS[task]}
        title={TASK_TITLES[task]}
        ruleLine={ruleLine(task, context)}
        badge={complete ? <DoneBadge pop={justDone > 0} /> : undefined}
        onClose={onClose}
      >
        {justDone > 0 && cheer && (
          <View pointerEvents="none" style={[styles.cheer, { backgroundColor: colors.world }]}>
            <Text style={[styles.cheerText, { color: colors.onWorld, fontFamily: fonts.rounded.bold }]}>{cheer}</Text>
          </View>
        )}
      </SheetHeader>
      <View style={styles.body}>{body(task, context)}</View>
    </>
  )
}

const styles = StyleSheet.create({
  cheer: { position: 'absolute', right: 20, bottom: -12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  cheerText: { fontSize: 12 },
  body: { paddingTop: 20 },
})
