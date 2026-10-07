import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'
import { TASK_TITLES, taskProgress, taskStatusLine, type BoardTask } from '../../content/taskStatus'
import type { DayEntry } from '../../db/types'
import { TASK_IDS } from '../../logic/dayCompletion'
import { minutesToFinish } from '../../logic/menace'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { DietSwitches } from './DietSwitches'
import { TASK_ICONS, TASK_TONE } from './taskTones'

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
  /** The book being read, for the done reading chip. */
  bookTitle?: string
  /** The day's photo, shown as the done photo chip's thumbnail. */
  photo?: Blob
  /** Shortcuts on the tiles that have one. */
  quickActions?: Partial<Record<BoardTask, QuickAction>>
  /** A declared social occasion today: the diet tile shows a toast instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left (the duck tapping or hunting): the open tiles get an edge. */
  urgent?: boolean
  /** Minutes until midnight, when urgent: a task that no longer fits gets a red edge. */
  minutesLeft?: number
  onOpen: (task: BoardTask) => void
}

/** A status line for VoiceOver: "0 of 2 · 45 min each" reads as "0 of 2, 45 min each". */
function spoken(status: string): string {
  return status.replaceAll(' · ', ', ')
}

/**
 * The five tasks of a day (mood and notes live outside the board: they're
 * optional and never "done"). The open ones are tiles, quickest to finish
 * first, each opening its sheet on tap; the done ones fold into a row of
 * chips above them. Late in the evening the tiles get an edge, red on what
 * no longer fits before midnight.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data, completion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, minutesLeft, onOpen } = props
  const reduceMotion = useReducedMotion()
  const tiles = TASK_IDS.filter((task) => !completion[task]).sort(
    (a, b) => minutesToFinish(a, data, rules) - minutesToFinish(b, data, rules),
  )
  const chips = TASK_IDS.filter((task) => completion[task])
  const layout = reduceMotion ? false : 'position'
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft

  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

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
                aria-label={`${TASK_TITLES[task]}, ${spoken(statusOf(task))}, done`}
                className="flex min-h-touch items-center gap-1.5 rounded-full bg-surface px-3 font-rounded text-sm font-semibold text-ink-muted ring-1 ring-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:ring-0"
              >
                {task === 'photo' && photo ? (
                  <BlobImage blob={photo} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <Icon name={TASK_ICONS[task]} size={16} />
                )}
                {TASK_TITLES[task]}
                <span aria-hidden="true" className="text-green-ink">
                  ✓
                </span>
              </motion.button>
            ))}
          </div>
        )}
        {tiles.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((task, i) => {
              // An odd tile out at the end takes the whole row.
              const lastOdd = i === tiles.length - 1 && tiles.length % 2 === 1
              return (
                <motion.div key={task} layout={layout} className={lastOdd ? 'col-span-2' : undefined}>
                  <TaskTile
                    task={task}
                    urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
                    status={statusOf(task)}
                    progress={taskProgress(task, data, rules)}
                    quick={quickActions?.[task]}
                    controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
                    onOpen={() => onOpen(task)}
                  />
                </motion.div>
              )
            })}
          </div>
        )}
      </LayoutGroup>
    </section>
  )
}

interface TaskTileProps {
  task: TaskId
  /** Late in the evening: 'late' when it no longer fits before midnight (a red edge), 'open' otherwise (a stronger edge). */
  urgency: 'none' | 'open' | 'late'
  status: string
  /** 0–1 for a measurable task; null otherwise. */
  progress: number | null
  quick?: QuickAction
  /** Controls on the tile's right (the diet switches). */
  controls?: ReactNode
  onOpen: () => void
}

function TaskTile({ task, urgency, status, progress, quick, controls, onOpen }: TaskTileProps) {
  const statusColor = urgency !== 'none' ? 'font-bold text-ink' : 'text-ink-muted'
  const edge = urgency === 'late' ? 'ring-2 ring-danger-ink' : urgency === 'open' ? 'ring-2 ring-ink/30' : 'ring-1 ring-ink/10 dark:ring-0'

  return (
    <div className={`relative min-h-[7.5rem] overflow-hidden rounded-card bg-surface ${edge}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${TASK_TITLES[task]}, ${spoken(status)}`}
        className="relative flex min-h-[7.5rem] w-full flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TASK_TONE.tint} ${TASK_TONE.ink}`}>
          <Icon name={TASK_ICONS[task]} size={20} />
        </span>
        <span className="mt-auto pt-3 font-rounded font-bold leading-tight text-ink">{TASK_TITLES[task]}</span>
        <span className={`mt-0.5 text-xs font-semibold leading-tight ${statusColor}`}>{status}</span>
      </button>
      {controls}
      {/* A full 48 px touch target around a small chip, so the shortcut never outshines the tile's title. */}
      {quick && (
        <button
          type="button"
          aria-label={quick.label}
          onClick={quick.onPress}
          className="group absolute top-1 right-1 flex min-h-touch min-w-touch touch-manipulation items-center justify-center rounded-full font-rounded text-xs font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="flex h-8 items-center gap-1 rounded-full border border-ink/15 px-2.5 motion-safe:transition-transform motion-safe:group-active:scale-90">
            <Icon name={quick.icon} size={14} />
            {quick.text}
          </span>
        </button>
      )}
      {progress !== null && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-black/5 dark:bg-white/10">
          <span
            data-testid="progress"
            className={`block h-full ${TASK_TONE.bar} motion-safe:transition-[width]`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </div>
  )
}
