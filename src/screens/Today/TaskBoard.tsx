import { useReducedMotion } from 'framer-motion'
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
  onOpen: (task: BoardTask) => void
}

/** The six tiles of a day: the five tasks and the mood, each opening its sheet on tap. */
export function TaskBoard({ entry, data, completion, rules, bookTitle, photo, quickActions, socialToday, onOpen }: TaskBoardProps) {
  return (
    <section aria-label="Tasks">
      <div className="grid grid-cols-2 gap-3">
        {BOARD_TASKS.map((task) => {
          const done = task !== 'notes' && completion[task]
          const status = task === 'notes' ? notesStatusLine(entry) : taskStatusLine(task, data, rules, done, bookTitle)
          const progress = task === 'notes' || done ? null : taskProgress(task, data, rules)
          return (
            <TaskTile
              key={task}
              task={task}
              done={done}
              status={status}
              progress={progress}
              photo={task === 'photo' && done ? photo : undefined}
              quick={done ? undefined : quickActions?.[task]}
              controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
              onOpen={() => onOpen(task)}
            />
          )
        })}
      </div>
    </section>
  )
}

interface TaskTileProps {
  task: BoardTask
  done: boolean
  status: string
  /** 0–1 for a measurable, unfinished task; null otherwise. */
  progress: number | null
  photo?: Blob
  quick?: QuickAction
  /** Controls under the title, on the tile itself (the diet switches); they stand in for the status line. */
  controls?: ReactNode
  onOpen: () => void
}

function TaskTile({ task, done, status, progress, photo, quick, controls, onOpen }: TaskTileProps) {
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

  const onPhoto = photo !== undefined
  const titleColor = onPhoto ? 'text-white' : 'text-ink'
  const statusColor = onPhoto ? 'text-white/90' : done ? 'text-world-ink' : tone.ink
  const iconBox = onPhoto ? 'bg-black/40 text-white' : done ? 'bg-world text-on-world' : `bg-surface ${tone.ink}`

  return (
    <div className={`relative min-h-[7.5rem] overflow-hidden rounded-card shadow-sm ${done ? 'bg-world-soft' : tone.tint}`}>
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
        className={`relative flex w-full flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${controls ? 'pb-0' : 'min-h-[7.5rem]'}`}
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBox}`}>
          <Icon name={TASK_ICONS[task]} size={20} />
        </span>
        <span className={`mt-auto pt-3 font-rounded font-extrabold leading-tight ${titleColor}`}>{TASK_TITLES[task]}</span>
        {!controls && <span className={`mt-0.5 text-xs font-semibold leading-tight ${statusColor}`}>{status}</span>}
      </button>
      {controls}
      {done && (
        <span className="absolute top-2 right-2">
          <DoneBadge pop={pops > 0} />
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
