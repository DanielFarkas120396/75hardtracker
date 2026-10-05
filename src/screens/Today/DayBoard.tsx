import type { BoardTask } from '../../content/taskStatus'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
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
  onOpen: (task: BoardTask) => void
}

/**
 * A day's TaskBoard with its shortcuts wired up: a workout, a glass of water,
 * a page, and the camera (or the library, when only that's allowed). Lives under
 * PhotoCapture, which owns the camera.
 */
export function DayBoard({ entry, data, completion, rules, currentBook, photo, socialToday, onOpen }: DayBoardProps) {
  const capture = usePhotoCapture()

  const quickActions: Partial<Record<BoardTask, QuickAction>> = {
    // The same default session the sheet adds; the sheet fine-tunes it.
    workouts:
      data.workouts.length < MAX_WORKOUTS
        ? {
            label: `Add a ${rules.minWorkoutMin} min workout`,
            icon: 'plus',
            text: `${rules.minWorkoutMin} min`,
            onPress: () =>
              void workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: rules.minWorkoutMin, isOutdoor: false }),
          }
        : undefined,
    water: {
      label: `Add ${QUICK_WATER_ML} ml`,
      icon: 'plus',
      text: `${QUICK_WATER_ML} ml`,
      onPress: () => void dayEntryRepo.adjustWater(entry.id, QUICK_WATER_ML),
    },
    reading: {
      label: 'Add 1 page',
      icon: 'plus',
      text: '1 page',
      onPress: () => {
        void dayEntryRepo.adjustPages(entry.id, 1)
        if (currentBook) void bookRepo.adjustCurrentPage(currentBook.id, 1)
      },
    },
    photo: capture.libraryOnly
      ? { label: 'Choose from library', icon: 'gallery', onPress: capture.chooseFromLibrary }
      : { label: 'Take photo', icon: 'photo', onPress: capture.takePhoto },
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
      onOpen={onOpen}
    />
  )
}
