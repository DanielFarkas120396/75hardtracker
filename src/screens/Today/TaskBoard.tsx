import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { spoken, TASK_TITLES, taskStatusLine, type BoardTask } from '../../content/taskStatus'
import type { DayEntry } from '../../db/types'
import { TASK_IDS } from '../../logic/dayCompletion'
import { minutesToFinish } from '../../logic/menace'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { DietSwitches } from './DietSwitches'
import { FillEngineContext, useFillEngine } from './fills/useFillEngine'
import { TASK_ICONS } from './taskTones'
import { TaskTile, type QuickAction } from './TaskTile'

export type { QuickAction } from './TaskTile'

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

/** A day with nothing logged: the tiles sort by what a task takes in full, so they never move as it progresses. */
const FRESH_DAY: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

/**
 * The five tasks of a day (mood and notes live outside the board: they're
 * optional and never "done"). The open ones are tiles, the quickest kind of
 * task first, each opening its sheet on tap; the done ones fold into a row
 * of chips above them. A tile only ever leaves the grid, never changes place. Late in the evening the tiles get an edge, red on what
 * no longer fits before midnight.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data, completion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, minutesLeft, onOpen } = props
  const reduceMotion = useReducedMotion()
  const engine = useFillEngine()
  const tiles = TASK_IDS.filter((task) => !completion[task]).sort(
    (a, b) => minutesToFinish(a, FRESH_DAY, rules) - minutesToFinish(b, FRESH_DAY, rules),
  )
  const chips = TASK_IDS.filter((task) => completion[task])
  const layout = reduceMotion ? false : 'position'
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft

  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

  return (
    <FillEngineContext.Provider value={engine}>
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
                      data={data}
                      rules={rules}
                      complete={completion[task]}
                      bookTitle={bookTitle}
                      urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
                      quick={quickActions?.[task]}
                      controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
                      image={task === 'photo' ? photo : undefined}
                      onSettledAt={() => {}}
                      onOpen={() => onOpen(task)}
                    />
                  </motion.div>
                )
              })}
            </div>
          )}
        </LayoutGroup>
      </section>
    </FillEngineContext.Provider>
  )
}
