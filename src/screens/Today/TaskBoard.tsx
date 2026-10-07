import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'
import { Burst } from '../../components/ui/Burst'
import { DoneBadge } from '../../components/ui/DoneBadge'
import {
  BOARD_TASKS,
  notesStatusLine,
  TASK_TITLES,
  taskProgress,
  taskStatusLine,
  type BoardTask,
} from '../../content/taskStatus'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { DietSwitches } from './DietSwitches'
import { TASK_ICONS, TASK_TONES } from './taskTones'

/** A one-tap shortcut on a tile, next to opening its sheet ("+250 ml", the camera). */
export interface QuickAction {
  /** Announced to screen readers ("Add 250 ml"). */
  label: string
  icon: IconName
  /** Shown next to the icon; none for an icon-only button. */
  text?: string
  onPress: () => void
}

interface TaskBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  /** The book being read, for the done reading tile. */
  bookTitle?: string
  /** The day's photo, shown on the done photo tile. */
  photo?: Blob
  /** Shortcuts on the tiles that have one; a done tile shows none. */
  quickActions?: Partial<Record<BoardTask, QuickAction>>
  /** A declared social occasion today: the diet tile shows a toast instead of the alcohol switch. */
  socialToday?: boolean
  /**
   * Late in the evening with tasks left (the duck tapping or hunting): the open
   * tiles get a red edge, and the done ones and the notes fold into a row of chips.
   */
  urgent?: boolean
  onOpen: (task: BoardTask) => void
}

/**
 * The six tiles of a day: the five tasks and the mood, each opening its sheet
 * on tap. Done tiles go quiet so the open ones stand out; when it's urgent,
 * only the open tasks keep a tile.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data, completion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, onOpen } = props
  const reduceMotion = useReducedMotion()
  const isDone = (task: BoardTask) => task !== 'notes' && completion[task]
  const open = BOARD_TASKS.filter((task) => task !== 'notes' && !completion[task])
  const reshaped = urgent && open.length > 0
  const tiles = reshaped ? open : BOARD_TASKS
  const chips = reshaped ? BOARD_TASKS.filter((task) => !open.includes(task)) : []
  const layout = reduceMotion ? false : 'position'

  const statusOf = (task: BoardTask) =>
    task === 'notes' ? notesStatusLine(entry) : taskStatusLine(task, data, rules, isDone(task), bookTitle)

  return (
    <section aria-label="Tasks">
      <LayoutGroup>
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((task) => (
              <motion.button
                key={task}
                layout={layout}
                type="button"
                onClick={() => onOpen(task)}
                aria-label={`${TASK_TITLES[task]}, ${statusOf(task)}${isDone(task) ? ', done' : ''}`}
                className="flex min-h-touch items-center gap-1.5 rounded-full bg-surface px-3 font-rounded text-sm font-bold text-ink-muted shadow-sm ring-1 ring-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:ring-0"
              >
                <Icon name={TASK_ICONS[task]} size={16} />
                {TASK_TITLES[task]}
                {isDone(task) && (
                  <span aria-hidden="true" className="text-world-ink">
                    ✓
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((task) => {
            const done = isDone(task)
            return (
              <motion.div key={task} layout={layout} className={reshaped && tiles.length === 1 ? 'col-span-2' : undefined}>
                <TaskTile
                  task={task}
                  done={done}
                  urgent={reshaped && !done}
                  status={statusOf(task)}
                  progress={task === 'notes' || done ? null : taskProgress(task, data, rules)}
                  photo={task === 'photo' && done ? photo : undefined}
                  quick={done ? undefined : quickActions?.[task]}
                  controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
                  onOpen={() => onOpen(task)}
                />
              </motion.div>
            )
          })}
        </div>
      </LayoutGroup>
    </section>
  )
}

interface TaskTileProps {
  task: BoardTask
  done: boolean
  /** Late with this task still open: a red edge and a bold status line. */
  urgent: boolean
  status: string
  /** 0–1 for a measurable, unfinished task; null otherwise. */
  progress: number | null
  photo?: Blob
  quick?: QuickAction
  /** Controls on the tile's right (the diet switches); the tick then takes the icon's place. */
  controls?: ReactNode
  onOpen: () => void
}

function TaskTile({ task, done, urgent, status, progress, photo, quick, controls, onOpen }: TaskTileProps) {
  const reduceMotion = useReducedMotion()
  const tone = TASK_TONES[task]

  // Compare with the previous render during render (React's "adjust state
  // when a prop changes" pattern): only a switch to done after mount pops.
  const [prevDone, setPrevDone] = useState(done)
  const [pops, setPops] = useState(0)
  if (prevDone !== done) {
    setPrevDone(done)
    if (done) setPops((n) => n + 1)
  }

  // A done tile goes quiet (neutral, muted text, the world's tick) so the open ones stand out.
  const onPhoto = photo !== undefined
  const titleColor = onPhoto ? 'text-white' : done ? 'text-ink-muted' : 'text-ink'
  const statusColor = onPhoto ? 'text-white/90' : done ? 'text-ink-muted' : urgent ? 'font-extrabold text-ink' : tone.ink
  const iconBox = onPhoto ? 'bg-black/40 text-white' : done ? 'bg-world text-on-world' : `bg-surface ${tone.ink}`
  const fill = done ? 'bg-surface ring-1 ring-ink/10 dark:ring-0' : tone.tint
  // On the diet tile the switches fill the right side, so the tick takes the icon's place instead of a corner.
  const tickInIcon = done && controls !== undefined && !onPhoto

  return (
    <div className={`relative min-h-[7.5rem] overflow-hidden rounded-card shadow-sm ${fill} ${urgent ? 'ring-2 ring-danger-ink' : ''}`}>
      {photo && (
        <>
          <BlobImage blob={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        </>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${TASK_TITLES[task]}, ${status}${done ? ', done' : ''}`}
        className="relative flex min-h-[7.5rem] w-full flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBox}`}>
          {tickInIcon ? (
            <span aria-hidden="true" className="font-bold">
              ✓
            </span>
          ) : (
            <Icon name={TASK_ICONS[task]} size={20} />
          )}
        </span>
        <span className={`mt-auto pt-3 font-rounded font-extrabold leading-tight ${titleColor}`}>{TASK_TITLES[task]}</span>
        <span className={`mt-0.5 text-xs font-semibold leading-tight ${statusColor}`}>{status}</span>
      </button>
      {controls}
      {done && (
        <span className={`absolute ${tickInIcon ? 'top-3 left-3' : 'top-2 right-2'}`}>
          {!tickInIcon && <DoneBadge pop={pops > 0} />}
          {pops > 0 && !reduceMotion && <Burst key={pops} className="top-0 left-0" />}
        </span>
      )}
      {quick && (
        <button
          type="button"
          aria-label={quick.label}
          onClick={quick.onPress}
          className={`absolute top-2 right-2 flex min-h-touch min-w-touch touch-manipulation items-center justify-center gap-1 rounded-full bg-surface px-3 font-rounded text-xs font-extrabold shadow-sm motion-safe:transition-transform motion-safe:active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${tone.ink}`}
        >
          <Icon name={quick.icon} size={16} />
          {quick.text}
        </button>
      )}
      {progress !== null && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-black/5 dark:bg-white/10">
          <span
            data-testid="progress"
            className={`block h-full ${tone.bar} motion-safe:transition-[width]`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </div>
  )
}
