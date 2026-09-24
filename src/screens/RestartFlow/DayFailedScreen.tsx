import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { toDayTaskData } from '../../db/mappers'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Challenge } from '../../db/types'
import { TASK_IDS, missingTasks } from '../../logic/dayCompletion'
import type { TaskId } from '../../logic/types'

const TASK_LABELS: Record<TaskId, string> = {
  workouts: 'Two 45+ min workouts, one outdoors',
  diet: 'Diet followed, no alcohol',
  water: '3.8 L of water',
  reading: '10 pages read',
  photo: 'Progress photo',
}

interface DayFailedScreenProps {
  challenge: Challenge
  failedDayNumber: number
  today: string
}

/** Blocks the app after a missed day: shows what was missed, then restarts from Day 1 on confirmation. */
export function DayFailedScreen({ challenge, failedDayNumber, today }: DayFailedScreenProps) {
  const [restarting, setRestarting] = useState(false)

  const missing = useLiveQuery(async (): Promise<TaskId[]> => {
    const entry = await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, failedDayNumber)
    if (!entry) return [...TASK_IDS]
    return missingTasks(toDayTaskData(entry, await workoutRepo.getForDayEntry(entry.id)))
  }, [challenge.id, failedDayNumber])

  const confirmRestart = async () => {
    setRestarting(true)
    try {
      await challengeRepo.restart(challenge.id, today)
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot state="sad" />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">Day {failedDayNumber} wasn't completed</h1>
      <p className="max-w-xs font-rounded text-ink-muted">
        75 Hard is all-or-nothing on every task, every day. This attempt (#{challenge.attemptNumber}) ends here —
        but every photo and stat you logged is saved for good.
      </p>

      {missing && missing.length > 0 && (
        <ul className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
          {missing.map((task) => (
            <li
              key={task}
              className="rounded-xl bg-danger/10 px-4 py-2 font-rounded text-sm font-bold text-danger-dark"
            >
              ✕ {TASK_LABELS[task]}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 font-rounded font-bold text-ink">You've got this — let's go again.</p>

      <Button variant="primary" className="mt-2" onClick={() => void confirmRestart()} disabled={restarting}>
        {restarting ? 'Restarting…' : 'Restart from Day 1'}
      </Button>
    </div>
  )
}
