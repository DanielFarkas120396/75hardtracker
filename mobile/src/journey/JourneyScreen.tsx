import type { ChallengeGate } from '@logic/challengeGate'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { dateForDayNumber, formatShortDay } from '@logic/dates'
import { journeyLog, type Chapter } from '@logic/journeyLog'
import type { WorldId } from '@logic/worlds'
import { useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useDerivedValue, useSharedValue } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ClimbCard } from '../components/ClimbCard'
import { FlameStreak } from '../components/FlameStreak'
import { Icon } from '../components/icons/Icon'
import { photoRepo } from '../db/repositories/photoRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Workout } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { pictureUri } from '../files/pictures'
import { expoStore } from '../files/store'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTabBarHidden } from '../hooks/useTabBar'
import { useTheme, WorldScope } from '../theme/ThemeProvider'
import { AltitudeRail } from './AltitudeRail'
import { DayCard, type OpenDay } from './DayCard'
import { DayRow } from './DayRow'
import { dayInView, READ_LINE, type RowPlace } from './railMaths'
import { WorldCover } from './WorldCover'
import { WORLDS, type World } from './worlds'

/** The cover closing a chapter: its score while you're in it, "Cleared" with the date once it's behind you. */
function chapterCover(chapter: Chapter<World>, startDate: string, todayDone: boolean) {
  const { world, done, jokers, cleared } = chapter
  const length = world.lastDay - world.firstDay + 1
  const days = `Days ${world.firstDay}–${world.lastDay}`
  if (!cleared) {
    // Today still counts as to go until it's done.
    const toGo = world.lastDay - chapter.days[0].dayNumber + (chapter.days[0].status === 'today' && !todayDone ? 1 : 0)
    return { badge: `${done}/${length}`, detail: toGo > 0 ? `${days} · ${toGo} to go` : days }
  }
  const jokerNote = jokers > 0 ? ` · ${jokers} ${jokers === 1 ? 'joker' : 'jokers'}` : ''
  return { badge: 'Cleared', detail: `${days} · ${done}/${length}${jokerNote} · done ${formatShortDay(dateForDayNumber(startDate, world.lastDay))}` }
}

/**
 * The Journey as a logbook: the attempt's days, newest first, in chapters by world (each under its cover, in its
 * colours), the next world waiting locked on top, and the climb as a rail down the left edge. Tapping a day opens its
 * card: photo, notes, workouts. It only reads. The web's JourneyScreen (src/screens/Journey/JourneyScreen.tsx).
 */
export function JourneyScreen({ gate }: { gate: ChallengeGate }) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { challenge, dayEntries, todayDayNumber, streak, missedDays } = gate
  const completed = gate.kind === 'completed'
  const dayReached = completed ? CHALLENGE_LENGTH : todayDayNumber

  const log = useMemo(
    () =>
      journeyLog(WORLDS, {
        todayDayNumber,
        completed,
        completedDays: new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
        missedDays: new Set(missedDays),
        restoredDays: new Set(challenge.restoredDays ?? []),
      }),
    [todayDayNumber, completed, dayEntries, missedDays, challenge.restoredDays],
  )

  // One read for the attempt's workouts and one for its photos, not one per row.
  const entryIds = dayEntries.map((e) => e.id)
  const photoIds = dayEntries.flatMap((e) => (e.photoId == null ? [] : [e.photoId]))
  const workouts = useLiveQuery(() => workoutRepo.getForDayEntries(entryIds), [entryIds.join(',')])
  const photos = useLiveQuery(() => photoRepo.getMany(photoIds), [photoIds.join(',')])
  const workoutsByEntry = useMemo(() => {
    const byEntry = new Map<number, Workout[]>()
    for (const workout of workouts ?? []) byEntry.set(workout.dayEntryId, [...(byEntry.get(workout.dayEntryId) ?? []), workout])
    return byEntry
  }, [workouts])
  const photoUris = useMemo(() => new Map((photos ?? []).map((photo) => [photo.id, pictureUri(expoStore, 'photos', photo.file)])), [photos])

  const entryFor = (dayNumber: number) => dayEntries.find((e) => e.dayNumber === dayNumber)
  const dateFor = (dayNumber: number) => entryFor(dayNumber)?.date ?? dateForDayNumber(challenge.startDate, dayNumber)
  const dayData = (dayNumber: number) => {
    const entry = entryFor(dayNumber)
    return {
      entry,
      workouts: entry ? (workoutsByEntry.get(entry.id) ?? []) : [],
      photoUri: entry?.photoId == null ? undefined : photoUris.get(entry.photoId),
    }
  }

  // The card keeps its day while it closes, so it shrinks back into the row with its content.
  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  // A screen that covers the app brings Today forward (a missed day at midnight, say): the card closes first, so its
  // Modal never stays up over Today's.
  const covered = useTabBarHidden()
  if (covered && cardOpen) setCardOpen(false)
  const onOpenDay = (dayNumber: number, from: { x: number; y: number }) => {
    setOpenDay({ dayNumber, date: dateFor(dayNumber), ...dayData(dayNumber), from, restored: challenge.restoredDays?.includes(dayNumber) })
    setCardOpen(true)
  }
  // The live entry, so the card follows what's logged while it's open.
  const live = openDay && dayData(openDay.dayNumber)
  const shownDay = openDay && live && { ...openDay, ...(live.entry ? live : {}) }

  // Where each row and each cover sits in the page: the rail reads the rows on the UI thread, a jump reads the covers.
  const rowPlaces = useRef(new Map<number, RowPlace>())
  const coverPlaces = useRef(new Map<WorldId, number>())
  const rows = useSharedValue<RowPlace[]>([])
  const placeRow = (day: number) => (event: LayoutChangeEvent) => {
    const { y, height: rowHeight } = event.nativeEvent.layout
    rowPlaces.current.set(day, { day, top: y, height: rowHeight })
    rows.value = [...rowPlaces.current.values()].filter((row) => row.day <= dayReached).sort((a, b) => a.top - b.top)
  }
  const placeCover = (world: WorldId) => (event: LayoutChangeEvent) => {
    coverPlaces.current.set(world, event.nativeEvent.layout.y)
  }

  // The read line, in the page's points: 45% down the screen, which starts under the status bar.
  const scrollY = useSharedValue(0)
  const lineOffset = height * READ_LINE - insets.top
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  const railDay = useDerivedValue(() => Math.min(dayReached, dayInView(rows.value, scrollY.value + lineOffset, dayReached)))

  // A world reached jumps to its cover; one ahead, to the top, where the next world waits.
  const scroll = useAnimatedRef<Animated.ScrollView>()
  const onJump = (world: World) => {
    const cover = world.firstDay <= dayReached ? coverPlaces.current.get(world.id) : undefined
    scroll.current?.scrollTo({ y: cover === undefined ? 0 : Math.max(0, cover - 24), animated: !reduceMotion })
  }

  const todayDone = Boolean(entryFor(todayDayNumber)?.completed)
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <Animated.ScrollView ref={scroll} testID="journey-scroll" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.attempt, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Attempt #{challenge.attemptNumber}</Text>
            <View accessible accessibilityRole="header" accessibilityLabel="Journey" style={styles.titleRow}>
              <Icon name="journey" color={colors.worldInk} />
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Journey</Text>
            </View>
          </View>
          <FlameStreak streak={streak} />
        </View>

        <ClimbCard dayReached={dayReached} />

        {log.next && (
          <View style={styles.chapterStart}>
            <WorldScope world={log.next.world.id}>
              <WorldCover
                world={log.next.world}
                locked
                badge={log.next.inDays === 1 ? 'Tomorrow' : `In ${log.next.inDays} days`}
                detail={`Days ${log.next.world.firstDay}–${log.next.world.lastDay}`}
                pageCanvas={colors.canvas}
              />
            </WorldScope>
          </View>
        )}

        {log.chapters.map((chapter) => (
          <WorldScope key={chapter.world.id} world={chapter.world.id}>
            <View testID={`cover-${chapter.world.id}`} style={styles.chapterStart} onLayout={placeCover(chapter.world.id)}>
              <WorldCover world={chapter.world} {...chapterCover(chapter, challenge.startDate, todayDone)} pageCanvas={colors.canvas} />
            </View>
            {chapter.days.map(({ dayNumber, status }) => (
              <DayRow
                key={dayNumber}
                dayNumber={dayNumber}
                date={dateFor(dayNumber)}
                status={status}
                {...dayData(dayNumber)}
                onOpen={(from) => onOpenDay(dayNumber, from)}
                onLayout={placeRow(dayNumber)}
              />
            ))}
          </WorldScope>
        ))}
      </Animated.ScrollView>

      <AltitudeRail day={railDay} onJump={onJump} />
      <DayCard day={shownDay} open={cardOpen} onClose={() => setCardOpen(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: 8, paddingLeft: 40, paddingRight: 16, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 8 },
  attempt: { fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, letterSpacing: 0.6 },
  chapterStart: { marginTop: 16 },
})
