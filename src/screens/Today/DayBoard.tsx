import type { BoardTask } from '../../content/taskStatus'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { MAX_WORKOUTS } from '../../logic/constants'
import type { Book, DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { usePhotoCapture } from './photoCaptureContext'
import { TaskBoard, type QuickAction } from './TaskBoard'

/** The smallest pour, and what the water tile's shortcut adds. */
export const QUICK_WATER_ML = 250

interface DayBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  currentBook?: Book
  photo?: Blob
  /** A declared social occasion today: the diet tile shows a toast instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left: the board brings the open tasks forward. */
  urgent?: boolean
  /** Opens the "Add workout" sheet (the screen owns it, so the workouts sheet can open it too). */
  onAddWorkout: () => void
  onOpen: (task: BoardTask) => void
}

/**
 * A day's TaskBoard with its shortcuts wired up: a workout, a glass of water,
 * the pages still to read, and the camera (or the library, when only that's
 * allowed). Lives under PhotoCapture, which owns the camera.
 */
export function DayBoard({ entry, data, completion, rules, currentBook, photo, socialToday, urgent, onAddWorkout, onOpen }: DayBoardProps) {
  const capture = usePhotoCapture()
  const pagesLeft = Math.max(rules.pagesTarget - data.pages_read, 0)

  const quickActions: Partial<Record<BoardTask, QuickAction>> = {
    workouts:
      data.workouts.length < MAX_WORKOUTS ? { label: 'Add workout', icon: 'plus', text: 'Workout', onPress: onAddWorkout } : undefined,
    water: {
      label: `Add ${QUICK_WATER_ML} ml`,
      icon: 'plus',
      text: `${QUICK_WATER_ML} ml`,
      onPress: () => void dayEntryRepo.adjustWater(entry.id, QUICK_WATER_ML),
    },
    reading:
      pagesLeft > 0
        ? {
            label: `Add the ${pagesLeft} ${pagesLeft === 1 ? 'page' : 'pages'} left`,
            icon: 'plus',
            text: `${pagesLeft} left`,
            onPress: () => {
              void dayEntryRepo.adjustPages(entry.id, pagesLeft)
              if (currentBook) void bookRepo.adjustCurrentPage(currentBook.id, pagesLeft)
            },
          }
        : undefined,
    photo: capture.libraryOnly
      ? { label: 'Choose from library', icon: 'gallery', text: 'Pick', onPress: capture.chooseFromLibrary }
      : { label: 'Take photo', icon: 'photo', text: 'Snap', onPress: capture.takePhoto },
  }

  return (
    <TaskBoard
      entry={entry}
      data={data}
      completion={completion}
      rules={rules}
      bookTitle={currentBook?.title}
      photo={photo}
      quickActions={quickActions}
      socialToday={socialToday}
      urgent={urgent}
      onOpen={onOpen}
    />
  )
}
