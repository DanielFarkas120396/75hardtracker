import { useLiveQuery } from 'dexie-react-hooks'
import { taskRule } from '../../content/microcopy'
import { toDayTaskData } from '../../db/mappers'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Challenge } from '../../db/types'
import { TASK_IDS, missingTasks } from '../../logic/dayCompletion'
import { rulesFor, type Ruleset } from '../../logic/rulesets'
import type { TaskId } from '../../logic/types'

interface MissedTasksListProps {
  challenge: Challenge
  dayNumber: number
}

/** What a given day was missing, as a list of rule lines — for the restart and joker-used screens. */
export function MissedTasksList({ challenge, dayNumber }: MissedTasksListProps) {
  const result = useLiveQuery(async (): Promise<{ rules: Ruleset; missing: TaskId[] }> => {
    // Re-read the row instead of trusting the prop's closure, which can go stale.
    const current = (await challengeRepo.getById(challenge.id)) ?? challenge
    const rules = rulesFor(current)
    const entry = await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, dayNumber)
    if (!entry) return { rules, missing: [...TASK_IDS] }
    const missing = missingTasks(toDayTaskData(entry, await workoutRepo.getForDayEntry(entry.id), current.socialDays), rules)
    return { rules, missing }
  }, [challenge.id, dayNumber])

  if (!result || result.missing.length === 0) return null

  return (
    <ul className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
      {result.missing.map((task) => (
        <li key={task} className="rounded-xl bg-danger/10 px-4 py-2 font-rounded text-sm font-bold text-danger-ink">
          ✕ {taskRule(task, result.rules)}
        </li>
      ))}
    </ul>
  )
}
