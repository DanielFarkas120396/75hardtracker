import { taskCheer } from '../../content/microcopy'
import type { BoardTask } from '../../content/taskStatus'
import { dietRuleLine, formatLiters, readingRuleLine, workoutRuleLine } from '../../content/variants'
import type { DayEntry, Workout } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import type { TaskId } from '../../logic/types'
import { DayNotesTask } from './DayNotesTask'
import { DietTask } from './DietTask'
import { PhotoTask } from './PhotoTask'
import { ReadingTask } from './ReadingTask'
import type { TaskSheetContent } from './TaskSheet'
import { WaterTask } from './WaterTask'
import { WorkoutTask } from './WorkoutTask'

/** Everything a day's sheets need, from the screen showing the board. */
export interface TaskSheetContext {
  entry: DayEntry
  workouts: Workout[]
  completion: Record<TaskId, boolean>
  rules: Ruleset
  dayNumber: number
  /** Whether the day is a declared social occasion: a drink is allowed. */
  socialToday: boolean
  canPlanSocial: boolean
  onPlanSocial: () => void
  /** Another day of the same challenge week that took the recovery day, if any. */
  weekRestDay: number | undefined
  /** Only a photo from the library (finishing yesterday). */
  libraryOnly: boolean
  /** Opens the "Add workout" sheet: the workouts sheet adds through the same form as the tile. */
  onAddWorkout: () => void
}

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
      return (
        <DietTask
          entry={ctx.entry}
          rules={ctx.rules}
          socialToday={ctx.socialToday}
          canPlanSocial={ctx.canPlanSocial}
          onPlanSocial={ctx.onPlanSocial}
        />
      )
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

/** What the sheet shows for one task of the day. */
export function describeTask(task: BoardTask, ctx: TaskSheetContext): TaskSheetContent {
  return {
    task,
    ruleLine: ruleLine(task, ctx),
    complete: task === 'notes' ? false : ctx.completion[task],
    cheer: task === 'notes' ? undefined : taskCheer(task, ctx.dayNumber, ctx.rules),
    // A done workout can still get its feel: that sheet stays open.
    closesWhenDone: task !== 'workouts',
    body: body(task, ctx),
  }
}
