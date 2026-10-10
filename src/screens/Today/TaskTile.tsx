import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'
import { countedData, spoken, TASK_TITLES, taskFill, taskProgress, taskStatusLine } from '../../content/taskStatus'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { TASK_PAINTER } from './fills/painter'
import { TileFill } from './fills/TileFill'
import { useBoardFills } from './fills/useFillEngine'
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

/** How finely a tile's status counts up with its fill: water in 50 ml, pages one by one. */
function countSteps(task: TaskId, rules: Ruleset): number | undefined {
  if (task === 'water') return Math.round(rules.waterTargetMl / 50)
  if (task === 'reading') return rules.pagesTarget
  return undefined
}

interface TaskTileProps {
  task: TaskId
  data: DayTaskData
  rules: Ruleset
  complete: boolean
  bookTitle?: string
  /** Late in the evening: 'late' when it no longer fits before midnight (a red edge), 'open' otherwise (a stronger edge). */
  urgency: 'none' | 'open' | 'late'
  quick?: QuickAction
  /** Controls on the tile's right (the diet switches). */
  controls?: ReactNode
  /** The day's photo, for the iris. */
  image?: Blob
  /** Shrinking into its chip: the tile follows its box down to chip size. */
  morphing?: boolean
  onSettledAt: (level: number | null) => void
  onOpen: () => void
}

/** An open task: a tile that fills as the task progresses, opening its sheet on tap. */
export function TaskTile({ task, data, rules, complete, bookTitle, urgency, quick, controls, image, morphing = false, onSettledAt, onOpen }: TaskTileProps) {
  const engine = useBoardFills()
  const kind = TASK_PAINTER[task]
  const hasFill = engine?.supports(kind) ?? false
  const level = taskFill(task, data, rules)
  const [shown, setShown] = useState<number | null>(null)
  const [settledAt, setSettledAt] = useState<number | null>(null)

  // While the fill moves, water and pages count up with it; at rest the line tells the day as it is.
  // The engine reports a new level a frame late: until it has settled at this one, the line keeps counting.
  const counting = hasFill && shown !== null && settledAt !== level
  const status = taskStatusLine(task, counting ? countedData(task, data, rules, shown) : data, rules, complete && !counting, bookTitle)
  // The line that needs no slide-in: the first one, and the one a count-up lands on.
  const [quiet, setQuiet] = useState(status)
  const [wasCounting, setWasCounting] = useState(counting)
  if (counting !== wasCounting) {
    setWasCounting(counting)
    if (!counting) setQuiet(status)
  }
  const progress = taskProgress(task, data, rules)
  // Over a fill (a draining one too) the muted grey would drop under 4.5:1: the line takes the ink colour.
  // The book draws its open pages and their shaded gutter at 0 too, so its line is always over a fill.
  const statusColor = urgency !== 'none' ? 'font-bold text-ink' : hasFill && (kind === 'book' || level > 0 || (shown ?? 0) > 0) ? 'text-ink' : 'text-ink-muted'
  const edge = urgency === 'late' ? 'ring-2 ring-danger-ink' : urgency === 'open' ? 'ring-2 ring-ink/30' : 'ring-1 ring-ink/10 dark:ring-0'
  const statusClass = `mt-0.5 text-xs font-semibold leading-tight ${statusColor}`

  return (
    <div className={`relative overflow-hidden rounded-card bg-surface ${morphing ? 'h-full' : 'min-h-[7.5rem]'} ${edge}`}>
      {hasFill && (
        <TileFill
          kind={kind}
          level={level}
          steps={countSteps(task, rules)}
          image={image}
          onShown={setShown}
          onSettledAt={(at) => {
            setSettledAt(at)
            onSettledAt(at)
          }}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${TASK_TITLES[task]}, ${spoken(taskStatusLine(task, data, rules, complete, bookTitle))}`}
        className={`relative flex min-h-[7.5rem] w-full flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${hasFill ? '[text-shadow:0_1px_3px_var(--color-canvas)]' : ''}`}
      >
        <span data-fill-icon className={`flex h-9 w-9 items-center justify-center rounded-xl [text-shadow:none] ${TASK_TONE.tint} ${TASK_TONE.ink}`}>
          <Icon name={TASK_ICONS[task]} size={20} />
        </span>
        <span data-fill-title className="mt-auto pt-3 font-rounded font-bold leading-tight text-ink">
          {TASK_TITLES[task]}
        </span>
        {/* A change slides in; a count-up just ticks. */}
        {counting ? (
          <span className={statusClass}>{status}</span>
        ) : (
          <motion.span
            key={status}
            initial={status !== quiet ? { opacity: 0.2, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className={statusClass}
          >
            {status}
          </motion.span>
        )}
      </button>
      {controls}
      {/* A full 48 px touch target around a small chip, so the shortcut never outshines the tile's title. A shortcut no longer needed shrinks away. */}
      <AnimatePresence initial={false}>
        {quick && (
          <motion.button
            key="quick"
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            type="button"
            aria-label={quick.label}
            onClick={quick.onPress}
            className="group absolute top-1 right-1 flex min-h-touch min-w-touch touch-manipulation items-center justify-center rounded-full font-rounded text-xs font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span data-fill-anchor className="flex h-8 items-center gap-1 rounded-full border border-ink/15 bg-surface px-2.5 motion-safe:transition-transform motion-safe:group-active:scale-90">
              <Icon name={quick.icon} size={14} />
              {quick.text}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      {!hasFill && progress !== null && (
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
