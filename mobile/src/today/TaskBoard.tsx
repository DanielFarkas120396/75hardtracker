import { initialPhases, landedCount, phasesReducer, settling, type Phase } from '@logic/boardPhases'
import { TASK_IDS } from '@logic/dayCompletion'
import { TASK_PAINTER } from '@logic/fillKinds'
import { minutesToFinish } from '@logic/menace'
import type { Ruleset } from '@logic/rulesets'
import { spoken, TASK_TITLES, taskStatusLine, type BoardTask } from '@logic/taskStatus'
import type { DayTaskData, TaskId } from '@logic/types'
import { dietToggleLabel } from '@logic/variantsCopy'
import * as Haptics from 'expo-haptics'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated'
import { Icon } from '../components/icons/Icon'
import { Track } from '../components/ui/controls'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { DayEntry } from '../db/types'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { FADE_AWAY, FADE_HERE, growIn, MorphingTile, shrinkOut, SLIDE, useLanding, type Box } from './boardMotion'
import { canAnimate, setBoardBusy, useFrozenWhile } from './boardSettle'
import { FillEngineContext, useFillEngine } from './fills/TileFill'
import { HOLD_MS, TASK_ICONS, TaskTile, type QuickAction } from './TaskTile'

export type { QuickAction } from './TaskTile'

/** Whether Today is the tab in front: its fills rest while another tab shows. The route provides it. */
export const ScreenFocusContext = createContext(true)

/** How long the board waits for the chip's place before giving up on the trip (no layout: the chip just shows). */
const CHIP_PLACE_MS = 150

interface TaskBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  /** The book being read, for the done reading chip. */
  bookTitle?: string
  /** The day's photo, as an address an image can load: the iris opens on it, and it's the done photo chip's thumbnail. */
  photoUri?: string
  /** Shortcuts on the tiles that have one. */
  quickActions?: Partial<Record<BoardTask, QuickAction | QuickAction[]>>
  /** A declared social occasion today: the diet tile shows a glass instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left (the duck tapping or hunting): the open tiles get an edge. */
  urgent?: boolean
  /** Minutes until the evening's deadline (bedtime, then midnight), when urgent: a task that no longer fits gets a red edge. */
  minutesLeft?: number
  /** A sheet covers the board: it holds still, and plays what changed once the sheet closes. */
  paused?: boolean
  /** How many chips have landed: the gauge counts these, not the saved completions. */
  onLandedChange?: (count: number) => void
  onOpen: (task: BoardTask) => void
}

/** A day with nothing logged: the tiles sort by what a task takes in full, so they never move as it progresses. */
const FRESH_DAY: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

const inGrid = (phase: Phase) => phase === 'tile' || phase === 'full'

/** One object per day state, so holding it compares by identity. */
const useMemoDay = (data: DayTaskData, completion: Record<TaskId, boolean>) => useMemo(() => ({ data, completion }), [data, completion])

/**
 * The five tasks of a day (mood and notes live outside the board: they're optional and never "done"). The open ones
 * are tiles, the quickest kind first, each filling as its task progresses and opening its sheet on tap; the done ones
 * are chips above them. A tile whose task gets done fills to the top, glows, and shrinks into its chip while the
 * others close up. Late in the evening the tiles get an edge, red on what no longer fits before the deadline.
 * The web's TaskBoard (src/screens/Today/TaskBoard.tsx).
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data: liveData, completion: liveCompletion, rules, bookTitle, photoUri, quickActions, socialToday = false, urgent = false, minutesLeft, paused = false, onLandedChange, onOpen } = props
  const { data, completion } = useFrozenWhile(paused, useMemoDay(liveData, liveCompletion))
  const reduceMotion = useReduceMotion()
  const focused = useContext(ScreenFocusContext)
  const engine = useFillEngine()
  const animate = canAnimate()
  const [phases, dispatch] = useReducer(phasesReducer, completion, initialPhases)
  const [settledAt, setSettledAt] = useState<Partial<Record<TaskId, number | null>>>({})
  // Where a full tile stood when it set off for its chip, and where its chip is.
  const [morphFrom, setMorphFrom] = useState<Partial<Record<TaskId, Box>>>({})
  const [chipAt, setChipAt] = useState<Partial<Record<TaskId, Box>>>({})
  // The chips that landed while the board was open: their tick pops.
  const [popped, setPopped] = useState<Partial<Record<TaskId, boolean>>>({})
  const cells = useRef<Partial<Record<TaskId, Box>>>({})
  const chipBoxes = useRef<Partial<Record<TaskId, Box>>>({})
  const rows = useRef<{ chips?: Box; grid?: Box }>({})
  const holds = useRef<Partial<Record<TaskId, ReturnType<typeof setTimeout>>>>({})
  const previous = useRef(phases)

  // A task done (from the board, or in its sheet): its tile leaves for a chip, so it is said, and felt.
  const doneNow = TASK_IDS.filter((task) => liveCompletion[task]).join()
  const doneBefore = useRef(doneNow)
  useEffect(() => {
    const before = doneBefore.current.split(',')
    doneBefore.current = doneNow
    const done = TASK_IDS.find((task) => doneNow.split(',').includes(task) && !before.includes(task))
    if (!done) return
    AccessibilityInfo.announceForAccessibility(`${TASK_TITLES[done]} done.`)
    // Not every phone can; the day doesn't depend on it.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }, [doneNow])

  // Under a sheet, or with another tab in front, the fills stop too, drift included.
  const held = paused || !focused
  useEffect(() => {
    engine.hold(held)
    return () => engine.hold(false)
  }, [engine, held])

  const landed = landedCount(phases)
  useEffect(() => onLandedChange?.(landed), [landed, onLandedChange])
  // Busy from the live day, and while a saved completion hasn't reached this board yet (the workouts load on their own).
  const busy = settling(phases, liveCompletion) || (entry.completed && !TASK_IDS.every((task) => liveCompletion[task]))
  useEffect(() => setBoardBusy(busy), [busy])
  useEffect(() => () => setBoardBusy(false), [])

  // The day is the truth; the board follows it.
  useLayoutEffect(() => dispatch({ type: 'sync', completion, animate }), [completion, animate])

  // A done tile is full once its fill has settled at the top (at once if it has no fill).
  useEffect(() => {
    for (const task of TASK_IDS) {
      if (completion[task] && phases[task] === 'tile' && (!engine.supports(TASK_PAINTER[task]) || settledAt[task] === 1)) dispatch({ type: 'full', task })
    }
  }, [completion, phases, settledAt, engine])

  // Full: the tile glows, then sets off for its chip from where it stands.
  useEffect(() => {
    for (const task of TASK_IDS) {
      const holding = holds.current[task] !== undefined
      if (phases[task] === 'full' && !holding) {
        holds.current[task] = setTimeout(
          () => {
            holds.current[task] = undefined
            const cell = cells.current[task]
            const grid = rows.current.grid
            if (cell && grid) setMorphFrom((all) => ({ ...all, [task]: { ...cell, x: cell.x + grid.x, y: cell.y + grid.y } }))
            // Its chip is about to be laid out afresh: an earlier trip's place no longer counts.
            chipBoxes.current[task] = undefined
            setChipAt((all) => ({ ...all, [task]: undefined }))
            dispatch({ type: 'morph', task })
          },
          reduceMotion ? 0 : HOLD_MS,
        )
      } else if (phases[task] !== 'full' && holding) {
        clearTimeout(holds.current[task])
        holds.current[task] = undefined
      }
    }
  }, [phases, reduceMotion])

  // Morphing: the tile travels once its chip's place is known. Without a trip to make (reduce motion, or no layout
  // to go by), the chip just shows.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const now: Partial<Record<TaskId, boolean>> = {}
    for (const task of TASK_IDS) {
      if (phases[task] === 'morphing') {
        if (reduceMotion || !morphFrom[task]) dispatch({ type: 'landed', task })
        else if (!chipAt[task]) timers.push(setTimeout(() => dispatch({ type: 'landed', task }), CHIP_PLACE_MS))
      }
      if (previous.current[task] === 'morphing' && phases[task] === 'chip') now[task] = true
      if (phases[task] === 'tile' && previous.current[task] !== 'tile') now[task] = false
      // A tile that left takes what its fill last said with it: the next one starts from nothing.
      if (phases[task] === 'chip' && previous.current[task] !== 'chip') setSettledAt((all) => (all[task] === undefined ? all : { ...all, [task]: undefined }))
    }
    previous.current = phases
    // oxlint-disable-next-line react/set-state-in-effect -- the pop belongs to the commit after the landing
    if (Object.keys(now).length > 0) setPopped((all) => ({ ...all, ...now }))
    return () => timers.forEach(clearTimeout)
  }, [phases, reduceMotion, morphFrom, chipAt])

  useEffect(() => {
    const pending = holds.current
    return () => Object.values(pending).forEach((id) => clearTimeout(id))
  }, [])

  // A chip's place in the board: its own box in the chips row, plus the row's.
  const placeChip = (task: TaskId) => {
    const chip = chipBoxes.current[task]
    const row = rows.current.chips
    if (!chip || !row) return
    const at = { ...chip, x: chip.x + row.x, y: chip.y + row.y }
    setChipAt((all) => (all[task]?.x === at.x && all[task]?.y === at.y && all[task]?.width === at.width ? all : { ...all, [task]: at }))
  }

  const byTime = (a: TaskId, b: TaskId) => minutesToFinish(a, FRESH_DAY, rules) - minutesToFinish(b, FRESH_DAY, rules)
  const open = TASK_IDS.filter((task) => phases[task] !== 'chip').sort(byTime)
  const grid = open.filter((task) => inGrid(phases[task]))
  const chips = TASK_IDS.filter((task) => phases[task] === 'morphing' || phases[task] === 'chip')
  const moves = animate && !reduceMotion
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft
  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

  const tile = (task: TaskId) => (
    <TaskTile
      task={task}
      data={data}
      rules={rules}
      complete={completion[task]}
      bookTitle={bookTitle}
      urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
      quick={phases[task] === 'tile' ? quickActions?.[task] : undefined}
      controls={task === 'diet' ? (onLayout) => <DietSwitches entry={entry} rules={rules} socialToday={socialToday} onLayout={onLayout} /> : undefined}
      imageUri={task === 'photo' ? photoUri : undefined}
      glowing={phases[task] === 'full'}
      onSettledAt={(at) => setSettledAt((all) => (all[task] === at ? all : { ...all, [task]: at }))}
      onOpen={() => onOpen(task)}
    />
  )

  return (
    <FillEngineContext.Provider value={engine}>
      <View accessibilityLabel="Tasks">
        {/* Tiles and chips already there when the board opens stand still. */}
        <LayoutAnimationConfig skipEntering>
          {chips.length > 0 && (
            <View
              testID="board-chips"
              style={styles.chips}
              onLayout={(event) => {
                rows.current.chips = event.nativeEvent.layout
                chips.forEach(placeChip)
              }}
            >
              {chips.map((task) => (
                <Chip
                  key={task}
                  task={task}
                  label={`${TASK_TITLES[task]}, ${spoken(statusOf(task))}, done`}
                  photoUri={photoUri}
                  // Hidden while its tile flies in: the tile lands exactly on it.
                  hidden={phases[task] === 'morphing'}
                  popped={popped[task] ?? false}
                  moves={moves}
                  fades={reduceMotion && animate}
                  onLayout={(event) => {
                    chipBoxes.current[task] = event.nativeEvent.layout
                    placeChip(task)
                  }}
                  onOpen={() => onOpen(task)}
                />
              ))}
            </View>
          )}
          {grid.length > 0 && (
            <View testID="board-grid" style={styles.grid} onLayout={(event) => (rows.current.grid = event.nativeEvent.layout)}>
              {/* Two to a row; the odd tile out at the end takes the whole row. A tile coming back (a task undone) grows in. */}
              {grid.map((task) => (
                <Animated.View
                  key={task}
                  layout={moves ? SLIDE : undefined}
                  entering={moves ? growIn : undefined}
                  exiting={reduceMotion && animate ? FADE_AWAY : undefined}
                  testID={`cell-${task}`}
                  style={styles.cell}
                  onLayout={(event) => (cells.current[task] = event.nativeEvent.layout)}
                >
                  {tile(task)}
                </Animated.View>
              ))}
            </View>
          )}
        </LayoutAnimationConfig>
        {/* Lifted out of the grid where it stood, above the rest, for its trip into the chip row. */}
        {open.map((task) => {
          const from = morphFrom[task]
          if (phases[task] !== 'morphing' || !from || reduceMotion) return null
          return (
            <MorphingTile key={task} task={task} from={from} to={chipAt[task]} photoUri={photoUri} onLanded={() => dispatch({ type: 'landed', task })}>
              {tile(task)}
            </MorphingTile>
          )
        })}
      </View>
    </FillEngineContext.Provider>
  )
}

interface ChipProps {
  task: TaskId
  /** What VoiceOver says: the title, the status and "done". */
  label: string
  photoUri?: string
  /** While its tile flies in: there, to give the tile its place to land, but not seen. */
  hidden: boolean
  /** It landed while the board was open: its tick pops. */
  popped: boolean
  moves: boolean
  fades: boolean
  onLayout: (event: LayoutChangeEvent) => void
  onOpen: () => void
}

/** A done task: a pill with its icon (the day's photo for the photo), its title and a tick. */
function Chip({ task, label, photoUri, hidden, popped, moves, fades, onLayout, onOpen }: ChipProps) {
  const { colors, fonts, mode } = useTheme()
  const landing = useLanding(popped)
  return (
    <Animated.View layout={moves ? SLIDE : undefined} entering={fades ? FADE_HERE : undefined} exiting={moves ? shrinkOut : undefined} testID={`chip-${task}`} style={landing.chip} onLayout={onLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        onPress={onOpen}
        style={[styles.chip, hidden && styles.hidden, { backgroundColor: colors.surface, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' }]}
      >
        {task === 'photo' && photoUri ? <Image source={{ uri: photoUri }} style={styles.thumb} /> : <Icon name={TASK_ICONS[task]} size={16} color={colors.inkMuted} />}
        <Text style={[styles.chipLabel, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{TASK_TITLES[task]}</Text>
        <Animated.Text style={[styles.chipLabel, { color: colors.greenInk, fontFamily: fonts.rounded.semibold }, landing.tick]}>✓</Animated.Text>
      </Pressable>
    </Animated.View>
  )
}

interface DietSwitchesProps {
  entry: DayEntry
  rules: Ruleset
  /** A declared social occasion: the plain glass takes the alcohol switch's place. */
  socialToday: boolean
  /** Their box in the tile: where the ink starts from. */
  onLayout?: (event: LayoutChangeEvent) => void
}

/** The diet tile's two switches, stacked on its right with a gap, so a near-miss doesn't open the sheet. Each has a short visible label. */
function DietSwitches({ entry, rules, socialToday, onLayout }: DietSwitchesProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.switches} onLayout={onLayout}>
      <MiniSwitch
        label={dietToggleLabel(rules)}
        text="Diet"
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
      />
      {socialToday ? (
        <View style={styles.glass}>
          <Icon name="drink" size={22} color={colors.ink} label="Social night today — a drink is allowed" />
        </View>
      ) : (
        <MiniSwitch
          label="No alcohol"
          text="No drink"
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
        />
      )}
    </View>
  )
}

interface MiniSwitchProps {
  /** The switch's name for VoiceOver ("No alcohol"). */
  label: string
  /** The short label shown beside the track ("No drink"). */
  text: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function MiniSwitch({ label, text, checked, onChange }: MiniSwitchProps) {
  const { colors, fonts } = useTheme()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.mini}
    >
      <Text style={[styles.miniText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{text}</Text>
      <Track checked={checked} on={colors.greenInk} width={32} height={20} thumb={16} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chips: { marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12 },
  hidden: { opacity: 0 },
  chipLabel: { fontSize: 14 },
  thumb: { width: 24, height: 24, borderRadius: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '40%', flexGrow: 1 },
  switches: { position: 'absolute', top: 0, bottom: 0, right: 8, alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  mini: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 4 },
  miniText: { fontSize: 12 },
  glass: { height: 48, width: 36, alignItems: 'center', justifyContent: 'center', paddingRight: 4 },
})
