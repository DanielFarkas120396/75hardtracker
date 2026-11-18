import { MAX_WORKOUTS } from '@logic/constants'
import type { Ruleset } from '@logic/rulesets'
import type { BoardTask } from '@logic/taskStatus'
import type { DayTaskData, TaskId } from '@logic/types'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { bookRepo } from '../db/repositories/bookRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Book, DayEntry } from '../db/types'
import { useTheme } from '../theme/ThemeProvider'
import { usePhotoCapture } from './photoCaptureContext'
import { TaskBoard, type QuickAction } from './TaskBoard'

/** The smallest pour, and what the water tile's shortcut adds. */
export const QUICK_WATER_ML = 250

/** How long "Logged … · Undo" stays up after a shortcut. */
export const LOGGED_TOAST_MS = 4000

/** What a shortcut just logged, and how to take it back. */
export interface Logged {
  text: string
  undo: () => void
  id: number
}

interface DayBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  currentBook?: Book
  socialToday?: boolean
  urgent?: boolean
  minutesLeft?: number
  /** A shortcut logged something: the screen shows "Logged … · Undo" over the page. */
  onLogged: (text: string, undo: () => void) => void
  /** Opens the "Add workout" sheet (the screen owns it, so the workouts sheet can open it too). */
  onAddWorkout: () => void
  onOpen: (task: BoardTask) => void
}

/**
 * A day's TaskBoard with its shortcuts wired up: a workout, a glass of water,
 * 1 or 10 pages, and the camera (or the library, when only that's allowed).
 * A glass or the pages say "Logged … · Undo" for a moment, so a stray tap is
 * one tap to take back. Lives under PhotoCapture, which owns the camera.
 * The web's DayBoard (src/screens/Today/DayBoard.tsx).
 */
export function DayBoard({ entry, data, completion, rules, currentBook, socialToday, urgent, minutesLeft, onLogged, onAddWorkout, onOpen }: DayBoardProps) {
  const capture = usePhotoCapture()
  const pagesLeft = Math.max(rules.pagesTarget - data.pages_read, 0)

  const addPages = async (pages: number) => {
    await dayEntryRepo.adjustPages(entry.id, pages)
    if (currentBook) await bookRepo.adjustCurrentPage(currentBook.id, pages)
  }

  const pagesShortcut = (pages: number): QuickAction => {
    const words = `${pages} ${pages === 1 ? 'page' : 'pages'}`
    return {
      label: `Add ${words}`,
      text: `+${words}`,
      onPress: () => void addPages(pages).then(() => onLogged(`Logged ${words}`, () => void addPages(-pages))),
    }
  }

  const quickActions: Partial<Record<BoardTask, QuickAction | QuickAction[]>> = {
    workouts: data.workouts.length < MAX_WORKOUTS ? { label: 'Add workout', icon: 'plus', text: 'Workout', onPress: onAddWorkout } : undefined,
    water: {
      label: `Add ${QUICK_WATER_ML} ml`,
      icon: 'plus',
      text: `${QUICK_WATER_ML} ml`,
      onPress: () => {
        void dayEntryRepo
          .adjustWater(entry.id, QUICK_WATER_ML)
          .then(() => onLogged(`Logged ${QUICK_WATER_ML} ml`, () => void dayEntryRepo.adjustWater(entry.id, -QUICK_WATER_ML)))
      },
    },
    reading: pagesLeft > 0 ? [pagesShortcut(1), pagesShortcut(10)] : undefined,
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
      photoUri={capture.photoUri}
      quickActions={quickActions}
      socialToday={socialToday}
      urgent={urgent}
      minutesLeft={minutesLeft}
      onOpen={onOpen}
    />
  )
}

/** The latest "Logged …" and the way to raise one; it falls quiet after 4 s. */
export function useLogged(): { logged: Logged | null; log: (text: string, undo: () => void) => void; clear: () => void } {
  const [logged, setLogged] = useState<Logged | null>(null)
  useEffect(() => {
    if (!logged) return
    const timer = setTimeout(() => setLogged(null), LOGGED_TOAST_MS)
    return () => clearTimeout(timer)
  }, [logged])
  return {
    logged,
    log: (text, undo) => setLogged((previous) => ({ text, undo, id: (previous?.id ?? 0) + 1 })),
    clear: () => setLogged(null),
  }
}

/** "Logged 250 ml · Undo", floating over the page just above the tab bar. */
export function LoggedToast({ logged, onDone }: { logged: Logged | null; onDone: () => void }) {
  const { colors, fonts } = useTheme()
  if (!logged) return null
  return (
    <View pointerEvents="box-none" style={styles.slot}>
      <View accessibilityRole="alert" style={[styles.toast, { backgroundColor: colors.ink }]}>
        <Text style={[styles.text, { color: colors.surface, fontFamily: fonts.rounded.bold }]}>{logged.text}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          onPress={() => {
            logged.undo()
            onDone()
          }}
          style={styles.undo}
        >
          <Text style={[styles.text, styles.underlined, { color: colors.surface, fontFamily: fonts.rounded.bold }]}>Undo</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 4,
    paddingLeft: 16,
    paddingRight: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { fontSize: 14 },
  underlined: { textDecorationLine: 'underline' },
  undo: { minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12 },
})
