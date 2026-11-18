import { journeyLog as sharedJourneyLog, type Chapter as SharedChapter, type Log as SharedLog, type LogInput } from '../../logic/journeyLog'
import { WORLDS, type World } from './worlds'

// The logbook's rule is shared with the native app (src/logic/journeyLog.ts); here it reads the web's worlds, covers included.

export type { DayStatus, LogDay } from '../../logic/journeyLog'
export type Chapter = SharedChapter<World>
export type Log = SharedLog<World>

/** Element id of a world's cover, so the altitude rail can jump to it. */
export const coverId = (world: World) => `journey-world-${world.id}`

/** The Journey's logbook: the worlds as chapters, newest day first. */
export const journeyLog = (input: LogInput): Log => sharedJourneyLog(WORLDS, input)
