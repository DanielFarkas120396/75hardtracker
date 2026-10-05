import { useState } from 'react'
import type { BoardTask } from '../../content/taskStatus'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { MAX_WORKOUTS } from '../../logic/constants'
import type { Book, DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { AddWorkoutSheet } from './AddWorkoutSheet'
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
 * A day's TaskBoard with its shortcuts wired up: a workout (through a small
 * sheet), a glass of water, a page, and the camera (or the library, when only that's allowed). Lives under
 * PhotoCapture, which owns the camera.
 */
export function DayBoard({ entry, data, completion, rules, currentBook, photo, socialToday, onOpen }: DayBoardProps) {
  const capture = usePhotoCapture()
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false)

  const quickActions: Partial<Record<BoardTask, QuickAction>> = {
    workouts:
      data.workouts.length < MAX_WORKOUTS
        ? { label: 'Add workout', icon: 'plus', text: 'Workout', onPress: () => setAddWorkoutOpen(true) }
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
    <>
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
      <AddWorkoutSheet open={addWorkoutOpen} dayEntryId={entry.id} rules={rules} onClose={() => setAddWorkoutOpen(false)} />
    </>
  )
}
