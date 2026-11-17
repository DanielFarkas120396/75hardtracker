import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS, type World } from './worlds'

/** How a day reads in the logbook. */
export type DayStatus = 'today' | 'done' | 'joker' | 'restored' | 'open'

export interface LogDay {
  dayNumber: number
  status: DayStatus
}

/** A world reached so far: its days, newest first, under its cover. */
export interface Chapter {
  world: World
  /** Cleared once its last day is behind you (or the whole challenge is done). */
  cleared: boolean
  /** Days counted done: logged complete, or kept from a backup. */
  done: number
  jokers: number
  days: LogDay[]
}

export interface Log {
  /** The world after the one you're in, waiting locked; none once you're in Heaven or it's all done. */
  next: { world: World; inDays: number } | null
  /** Newest first: the current world, then each one below it, down to Hell. */
  chapters: Chapter[]
}

interface LogInput {
  /** Today's day number: 0 or less before the start, past 75 once it's over. */
  todayDayNumber: number
  completed: boolean
  completedDays: ReadonlySet<number>
  missedDays: ReadonlySet<number>
  restoredDays: ReadonlySet<number>
}

/** Element id of a world's cover, so the altitude rail can jump to it. */
export const coverId = (world: World) => `journey-world-${world.id}`

/** The Journey's logbook: the worlds as chapters, newest day first. */
export function journeyLog({ todayDayNumber, completed, completedDays, missedDays, restoredDays }: LogInput): Log {
  const reached = completed ? CHALLENGE_LENGTH : Math.min(CHALLENGE_LENGTH, Math.max(0, todayDayNumber))

  const statusOf = (dayNumber: number): DayStatus => {
    if (!completed && dayNumber === todayDayNumber) return 'today'
    if (restoredDays.has(dayNumber)) return 'restored'
    if (completedDays.has(dayNumber)) return 'done'
    if (missedDays.has(dayNumber)) return 'joker'
    return 'open'
  }

  const chapters = WORLDS.filter((world) => world.firstDay <= reached)
    .reverse()
    .map((world): Chapter => {
      const days: LogDay[] = []
      for (let day = Math.min(world.lastDay, reached); day >= world.firstDay; day--) days.push({ dayNumber: day, status: statusOf(day) })
      return {
        world,
        cleared: completed || reached > world.lastDay,
        done: days.filter((d) => d.status === 'done' || d.status === 'restored' || (d.status === 'today' && completedDays.has(d.dayNumber))).length,
        jokers: days.filter((d) => d.status === 'joker').length,
        days,
      }
    })

  const nextWorld = completed ? undefined : WORLDS.find((world) => world.firstDay > reached)
  return {
    next: nextWorld ? { world: nextWorld, inDays: nextWorld.firstDay - todayDayNumber } : null,
    chapters,
  }
}
