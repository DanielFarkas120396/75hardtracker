import { CHALLENGE_LENGTH } from './constants'
import type { WorldSpan } from './worlds'

/**
 * The Journey's logbook as both apps show it: the worlds reached as chapters,
 * newest day first, and the next world waiting. Each app passes its own
 * worlds (the shared spans plus its cover pictures).
 */

/** How a day reads in the logbook. */
export type DayStatus = 'today' | 'done' | 'joker' | 'restored' | 'open'

export interface LogDay {
  dayNumber: number
  status: DayStatus
}

/** A world reached so far: its days, newest first, under its cover. */
export interface Chapter<W extends WorldSpan = WorldSpan> {
  world: W
  /** Cleared once its last day is behind you (or the whole challenge is done). */
  cleared: boolean
  /** Days counted done: logged complete, or kept from a backup. */
  done: number
  jokers: number
  days: LogDay[]
}

export interface Log<W extends WorldSpan = WorldSpan> {
  /** The world after the one you're in, waiting locked; none once you're in Heaven or it's all done. */
  next: { world: W; inDays: number } | null
  /** Newest first: the current world, then each one below it, down to Hell. */
  chapters: Chapter<W>[]
}

export interface LogInput {
  /** Today's day number: 0 or less before the start, past 75 once it's over. */
  todayDayNumber: number
  completed: boolean
  completedDays: ReadonlySet<number>
  missedDays: ReadonlySet<number>
  restoredDays: ReadonlySet<number>
}

/** The Journey's logbook: the worlds as chapters, newest day first. */
export function journeyLog<W extends WorldSpan>(worlds: readonly W[], { todayDayNumber, completed, completedDays, missedDays, restoredDays }: LogInput): Log<W> {
  const reached = completed ? CHALLENGE_LENGTH : Math.min(CHALLENGE_LENGTH, Math.max(0, todayDayNumber))

  const statusOf = (dayNumber: number): DayStatus => {
    if (!completed && dayNumber === todayDayNumber) return 'today'
    if (restoredDays.has(dayNumber)) return 'restored'
    if (completedDays.has(dayNumber)) return 'done'
    if (missedDays.has(dayNumber)) return 'joker'
    return 'open'
  }

  const chapters = worlds
    .filter((world) => world.firstDay <= reached)
    .reverse()
    .map((world): Chapter<W> => {
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

  const nextWorld = completed ? undefined : worlds.find((world) => world.firstDay > reached)
  return {
    next: nextWorld ? { world: nextWorld, inDays: nextWorld.firstDay - todayDayNumber } : null,
    chapters,
  }
}
