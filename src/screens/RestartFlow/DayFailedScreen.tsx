import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import type { Challenge } from '../../db/types'
import { missingTasks } from '../../logic/dayCompletion'
import { buildRestartedChallenge, findFirstIncompleteDayNumber } from '../../logic/restart'
import type { DayTaskData, TaskId } from '../../logic/types'
import { todayISO } from '../../lib/dates'

const TASK_LABELS: Record<TaskId, string> = {
  workouts: 'Two 45+ min workouts, one outdoors',
  diet: 'Diet followed, no alcohol',
  water: '3.8 L of water',
  reading: '10 pages read',
  photo: 'Progress photo',
}

interface DayFailedScreenProps {
  challenge: Challenge
  dayEntries: { dayNumber: number; completed: boolean }[]
  todayDayNumber: number
}

export function DayFailedScreen({ challenge, dayEntries, todayDayNumber }: DayFailedScreenProps) {
  const failedDayNumber = findFirstIncompleteDayNumber(dayEntries, todayDayNumber)

  const failedDayDetail = useLiveQuery(async () => {
    if (failedDayNumber === undefined) return undefined
    const entry = await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, failedDayNumber)
    if (!entry) return { missing: Object.keys(TASK_LABELS) as TaskId[] }

    const workouts = await workoutRepo.getForDayEntry(entry.id)
    const data: DayTaskData = {
      water_ml: entry.water_ml,
      pages_read: entry.pages_read,
      dietFollowed: entry.dietFollowed,
      noAlcohol: entry.noAlcohol,
      hasPhoto: entry.photoId != null,
      workouts: workouts.map((w) => ({ durationMin: w.durationMin, isOutdoor: w.isOutdoor })),
    }
    return { missing: missingTasks(data) }
  }, [challenge.id, failedDayNumber])

  const confirmRestart = async () => {
    const restarted = buildRestartedChallenge(challenge, todayISO())
    await challengeRepo.restart(challenge.id, restarted)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot state="sad" />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">
        Day {failedDayNumber ?? todayDayNumber} wasn't completed
      </h1>
      <p className="max-w-xs font-rounded text-ink-muted">
        75 Hard is all-or-nothing on every task, every day. This attempt (#{challenge.attemptNumber}) ends here —
        but every photo and stat you logged is saved for good.
      </p>

      {failedDayDetail && failedDayDetail.missing.length > 0 && (
        <ul className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
          {failedDayDetail.missing.map((task) => (
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

      <Button variant="primary" className="mt-2" onClick={() => void confirmRestart()}>
        Restart from Day 1
      </Button>
    </div>
  )
}
