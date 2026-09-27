import { useLiveQuery } from 'dexie-react-hooks'
import { TASK_RULES } from '../../content/microcopy'
import { toDayTaskData } from '../../db/mappers'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Challenge } from '../../db/types'
import { TASK_IDS, missingTasks } from '../../logic/dayCompletion'
import { rulesFor } from '../../logic/rulesets'
import type { TaskId } from '../../logic/types'

interface MissedTasksListProps {
  challenge: Challenge
  dayNumber: number
}

/** What a given day was missing, as a list of rule lines — for the restart and joker-used screens. */
export function MissedTasksList({ challenge, dayNumber }: MissedTasksListProps) {
  const missing = useLiveQuery(async (): Promise<TaskId[]> => {
    const entry = await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, dayNumber)
    if (!entry) return [...TASK_IDS]
    return missingTasks(
      toDayTaskData(entry, await workoutRepo.getForDayEntry(entry.id), challenge.socialDays),
      rulesFor(challenge),
    )
  }, [challenge.id, dayNumber])

  if (!missing || missing.length === 0) return null

  return (
    <ul className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
      {missing.map((task) => (
        <li key={task} className="rounded-xl bg-danger/10 px-4 py-2 font-rounded text-sm font-bold text-danger-ink">
          ✕ {TASK_RULES[task]}
        </li>
      ))}
    </ul>
  )
}
