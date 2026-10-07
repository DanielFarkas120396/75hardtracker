import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

/** How long "Logged … · Undo" stays up after a shortcut. */
export const LOGGED_TOAST_MS = 4000

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
  /** Minutes until midnight, when urgent. */
  minutesLeft?: number
  /** Opens the "Add workout" sheet (the screen owns it, so the workouts sheet can open it too). */
  onAddWorkout: () => void
  onOpen: (task: BoardTask) => void
}

/**
 * A day's TaskBoard with its shortcuts wired up: a workout, a glass of water,
 * the pages still to read, and the camera (or the library, when only that's
 * allowed). A glass or the pages show "Logged … · Undo" for a moment, so a
 * stray tap is one tap to take back. Lives under PhotoCapture, which owns the camera.
 */
export function DayBoard(props: DayBoardProps) {
  const { entry, data, completion, rules, currentBook, photo, socialToday, urgent, minutesLeft, onAddWorkout, onOpen } = props
  const capture = usePhotoCapture()
  const pagesLeft = Math.max(rules.pagesTarget - data.pages_read, 0)
  const [logged, setLogged] = useState<{ text: string; undo: () => void; id: number } | null>(null)

  useEffect(() => {
    if (!logged) return
    const timer = setTimeout(() => setLogged(null), LOGGED_TOAST_MS)
    return () => clearTimeout(timer)
  }, [logged])

  const log = (text: string, undo: () => void) => setLogged((previous) => ({ text, undo, id: (previous?.id ?? 0) + 1 }))

  const addPages = (pages: number) => {
    void dayEntryRepo.adjustPages(entry.id, pages)
    if (currentBook) void bookRepo.adjustCurrentPage(currentBook.id, pages)
  }

  const quickActions: Partial<Record<BoardTask, QuickAction>> = {
    workouts:
      data.workouts.length < MAX_WORKOUTS ? { label: 'Add workout', icon: 'plus', text: 'Workout', onPress: onAddWorkout } : undefined,
    water: {
      label: `Add ${QUICK_WATER_ML} ml`,
      icon: 'plus',
      text: `${QUICK_WATER_ML} ml`,
      onPress: () => {
        void dayEntryRepo.adjustWater(entry.id, QUICK_WATER_ML)
        log(`Logged ${QUICK_WATER_ML} ml`, () => void dayEntryRepo.adjustWater(entry.id, -QUICK_WATER_ML))
      },
    },
    reading:
      pagesLeft > 0
        ? {
            label: `Add the ${pagesLeft} ${pagesLeft === 1 ? 'page' : 'pages'} left`,
            icon: 'plus',
            text: `${pagesLeft} left`,
            onPress: () => {
              addPages(pagesLeft)
              log(`Logged ${pagesLeft} ${pagesLeft === 1 ? 'page' : 'pages'}`, () => addPages(-pagesLeft))
            },
          }
        : undefined,
    photo: capture.libraryOnly
      ? { label: 'Choose from library', icon: 'gallery', text: 'Pick', onPress: capture.chooseFromLibrary }
      : { label: 'Take photo', icon: 'photo', text: 'Snap', onPress: capture.takePhoto },
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
        urgent={urgent}
        minutesLeft={minutesLeft}
        onOpen={onOpen}
      />
      {/* Portalled: the board sits in a stacking context under the tab bar, and the toast floats just above it. */}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md justify-center"
        >
          {logged && (
            <div
              key={logged.id}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink py-1 pr-1 pl-4 font-rounded text-sm font-bold text-surface shadow-lg"
            >
              <span>{logged.text}</span>
              <button
                type="button"
                onClick={() => {
                  logged.undo()
                  setLogged(null)
                }}
                className="min-h-touch rounded-xl px-3 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-surface"
              >
                Undo
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
