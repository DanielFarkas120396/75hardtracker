import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { spoken, TASK_TITLES, taskStatusLine, type BoardTask } from '../../content/taskStatus'
import type { DayEntry } from '../../db/types'
import { TASK_IDS } from '../../logic/dayCompletion'
import { minutesToFinish } from '../../logic/menace'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { DietSwitches } from './DietSwitches'
import { animateWidth, boxIn, canAnimate, glow, HOLD_MS, morphIntoChip, popTick, type Box, type Morph } from './fills/boardMotion'
import { initialPhases, landedCount, phasesReducer, settling, type Phase } from './fills/boardPhases'
import { setBoardBusy } from './fills/boardSettle'
import { TASK_PAINTER } from './fills/painter'
import { FillEngineContext, useFillEngine } from './fills/useFillEngine'
import { useFrozenWhile } from './fills/useFrozenWhile'
import { TaskTile, type QuickAction } from './TaskTile'
import { TASK_ICONS } from './taskTones'

export type { QuickAction } from './TaskTile'

interface TaskBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  /** The book being read, for the done reading chip. */
  bookTitle?: string
  /** The day's photo: the iris opens on it, and it's the done photo chip's thumbnail. */
  photo?: Blob
  /** Shortcuts on the tiles that have one. */
  quickActions?: Partial<Record<BoardTask, QuickAction>>
  /** A declared social occasion today: the diet tile shows a toast instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left (the duck tapping or hunting): the open tiles get an edge. */
  urgent?: boolean
  /** Minutes until midnight, when urgent: a task that no longer fits gets a red edge. */
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
 * others close up. Late in the evening the tiles get an edge, red on what no longer fits before midnight.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data: liveData, completion: liveCompletion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, minutesLeft, paused = false, onLandedChange, onOpen } = props
  const { data, completion } = useFrozenWhile(paused, useMemoDay(liveData, liveCompletion))
  const reduceMotion = useReducedMotion() ?? false
  const engine = useFillEngine()
  const animate = canAnimate()
  const [phases, dispatch] = useReducer(phasesReducer, completion, initialPhases)
  const [settledAt, setSettledAt] = useState<Partial<Record<TaskId, number | null>>>({})
  // Where a full tile stood when it set off for its chip.
  const [morphFrom, setMorphFrom] = useState<Partial<Record<TaskId, Box>>>({})
  const boardRef = useRef<HTMLElement>(null)
  const boxes = useRef<Partial<Record<TaskId, HTMLDivElement | null>>>({})
  const chipEls = useRef<Partial<Record<TaskId, HTMLButtonElement | null>>>({})
  const holds = useRef<Partial<Record<TaskId, number>>>({})
  const morphs = useRef<Partial<Record<TaskId, Morph>>>({})
  const widths = useRef<Partial<Record<TaskId, number>>>({})
  const previous = useRef(phases)

  // Under a sheet the fills stop too, drift included.
  useEffect(() => {
    engine?.hold(paused)
    return () => engine?.hold(false)
  }, [engine, paused])

  const landed = landedCount(phases)
  useEffect(() => onLandedChange?.(landed), [landed, onLandedChange])
  // Busy from the live day, and while a saved completion hasn't reached this board yet (the workouts load on their own).
  const busy = settling(phases, liveCompletion) || (entry.completed && !TASK_IDS.every((task) => liveCompletion[task]))
  useEffect(() => setBoardBusy(busy), [busy])
  useEffect(() => () => setBoardBusy(false), [])

  // The day is the truth; the board follows it.
  useLayoutEffect(() => dispatch({ type: 'sync', completion, animate }), [completion, animate])

  // A done tile is full once its fill has settled at the top (at once if it has no fill yet).
  useEffect(() => {
    const hasFill = (task: TaskId) => engine?.supports(TASK_PAINTER[task]) ?? false
    for (const task of TASK_IDS) {
      if (completion[task] && phases[task] === 'tile' && (!hasFill(task) || settledAt[task] === 1)) dispatch({ type: 'full', task })
    }
  }, [completion, phases, settledAt, engine])

  // Full: the tile glows, then sets off for its chip from where it stands.
  useEffect(() => {
    for (const task of TASK_IDS) {
      const holding = holds.current[task] !== undefined
      if (phases[task] === 'full' && !holding) {
        const tile = boxes.current[task]?.firstElementChild
        if (tile instanceof HTMLElement && !reduceMotion) glow(tile)
        holds.current[task] = window.setTimeout(
          () => {
            holds.current[task] = undefined
            const board = boardRef.current
            const box = boxes.current[task]
            if (board && box) {
              const from = boxIn(board, box)
              setMorphFrom((all) => ({ ...all, [task]: from }))
            }
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

  // Morphing: the tile, lifted out of the grid where it stood, shrinks into its chip; landing pops the tick.
  useLayoutEffect(() => {
    for (const task of TASK_IDS) {
      const running = morphs.current[task]
      if (phases[task] === 'morphing' && !running) {
        const board = boardRef.current
        const box = boxes.current[task]
        const chip = chipEls.current[task]
        const tile = box?.firstElementChild
        if (!board || !box || !chip || !(tile instanceof HTMLElement)) {
          dispatch({ type: 'landed', task })
          continue
        }
        const morph = morphIntoChip({ board, box, tile, chip }, reduceMotion)
        morphs.current[task] = morph
        void morph.finished.then(() => {
          if (morphs.current[task] !== morph) return
          morphs.current[task] = undefined
          // In the frame the flight ends: the chip shows as its title and icon land on it, not a frame later.
          flushSync(() => dispatch({ type: 'landed', task }))
        })
      } else if (phases[task] !== 'morphing' && running) {
        running.cancel()
        morphs.current[task] = undefined
      }
      if (previous.current[task] === 'morphing' && phases[task] === 'chip' && !reduceMotion) {
        const chip = chipEls.current[task]
        if (chip) popTick(chip)
      }
    }
    previous.current = phases
  }, [phases, reduceMotion])

  // The odd tile out takes the whole row: a tile whose width changes widens or narrows instead of jumping.
  useLayoutEffect(() => {
    for (const task of TASK_IDS) {
      const box = boxes.current[task]
      if (!box || !inGrid(phases[task])) continue
      const width = box.offsetWidth
      const was = widths.current[task]
      const tile = box.firstElementChild
      if (was !== undefined && was !== width && tile instanceof HTMLElement && !reduceMotion) animateWidth(tile, was, width)
      widths.current[task] = width
    }
  })

  useEffect(() => {
    const pendingHolds = holds.current
    const pendingMorphs = morphs.current
    return () => {
      Object.values(pendingHolds).forEach((id) => clearTimeout(id))
      Object.values(pendingMorphs).forEach((morph) => morph?.cancel())
    }
  }, [])

  const byTime = (a: TaskId, b: TaskId) => minutesToFinish(a, FRESH_DAY, rules) - minutesToFinish(b, FRESH_DAY, rules)
  const open = TASK_IDS.filter((task) => phases[task] !== 'chip').sort(byTime)
  const grid = open.filter((task) => inGrid(phases[task]))
  const chips = TASK_IDS.filter((task) => phases[task] === 'morphing' || phases[task] === 'chip')
  const layout = animate && !reduceMotion ? 'position' : false
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft
  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

  return (
    <FillEngineContext.Provider value={engine}>
      <section ref={boardRef} aria-label="Tasks" className="relative">
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {chips.map((task) => (
                <motion.button
                  key={task}
                  ref={(el: HTMLButtonElement | null) => {
                    chipEls.current[task] = el
                  }}
                  layout={layout}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={() => onOpen(task)}
                  aria-label={`${TASK_TITLES[task]}, ${spoken(statusOf(task))}, done`}
                  // Hidden while its tile flies in: the tile lands exactly on it. A class, not a style: React shows it in the
                  // landing commit itself, where framer would wait for its next frame.
                  className={`flex min-h-touch items-center gap-1.5 rounded-full bg-surface px-3 font-rounded text-sm font-semibold text-ink-muted ring-1 ring-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:ring-0${phases[task] === 'morphing' ? ' opacity-0' : ''}`}
                >
                  <span data-chip-icon className="flex">
                    {task === 'photo' && photo ? (
                      <BlobImage blob={photo} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <Icon name={TASK_ICONS[task]} size={16} />
                    )}
                  </span>
                  <span data-chip-label>{TASK_TITLES[task]}</span>
                  <span data-chip-tick aria-hidden="true" className="inline-block text-green-ink">
                    ✓
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
        {open.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {/* Tiles already there when the board opens stand still; one coming back (a task undone) grows in. */}
            <AnimatePresence initial={false}>
              {open.map((task) => {
                const morphing = phases[task] === 'morphing'
                const i = grid.indexOf(task)
                // An odd tile out at the end takes the whole row.
                const lastOdd = !morphing && i === grid.length - 1 && grid.length % 2 === 1
                const from = morphFrom[task]
                return (
                  <motion.div
                    key={task}
                    ref={(el: HTMLDivElement | null) => {
                      boxes.current[task] = el
                    }}
                    layout={morphing ? false : layout}
                    initial={layout ? { opacity: 0, scale: 0.92 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    className={lastOdd ? 'col-span-2' : undefined}
                    // Lifted out of the grid where it stood, above the rest, for its trip into the chip row.
                    style={morphing && from ? { position: 'absolute', zIndex: 5, left: from.left, top: from.top, width: from.width, height: from.height } : undefined}
                  >
                    <TaskTile
                      task={task}
                      data={data}
                      rules={rules}
                      complete={completion[task]}
                      bookTitle={bookTitle}
                      urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
                      quick={phases[task] === 'tile' ? quickActions?.[task] : undefined}
                      controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
                      image={task === 'photo' ? photo : undefined}
                      morphing={morphing}
                      onSettledAt={(at) => setSettledAt((all) => (all[task] === at ? all : { ...all, [task]: at }))}
                      onOpen={() => onOpen(task)}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </FillEngineContext.Provider>
  )
}
