import { CHALLENGE_LENGTH } from '@logic/constants'
import { dayNumberForDate } from '@logic/dates'
import { isChallengeDay } from '@logic/days'
import { parseProfile } from '@logic/profile'
import { buildNextChallenge } from '@logic/restart'
import { challengeWeek, rulesFor, variantOf, type ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { syncDayCompletion } from '../completion'
import type { Db } from '../driver'
import { getDb, transaction } from '../open'
import { challengeFromRow, challengeToParams, INSERT_CHALLENGE, type ChallengeRow } from '../rows'
import { allRows, getRow, updateRow } from '../table'
import type { Challenge } from '../types'

export type SocialDayResult =
  | { ok: true }
  | { ok: false; reason: 'not-allowed' | 'out-of-range' | 'too-late' }
  | { ok: false; reason: 'week-taken'; dayNumber: number }
export type GiveUpResult = { ok: true } | { ok: false; reason: 'locked' }

/**
 * The attempts. Same calls and behaviour as the web app's challengeRepo
 * (src/db/repositories/challengeRepo.ts); the methods the first screens don't
 * need yet (start date, variant) arrive with those screens.
 */

async function first(db: Db, where: string): Promise<Challenge | undefined> {
  const row = await db.getFirstAsync<ChallengeRow>(`SELECT * FROM challenges ${where} LIMIT 1`)
  return row ? challengeFromRow(row) : undefined
}

const ACTIVE = "WHERE status = 'active'"

/** Returns the active challenge's id, or creates the next attempt. Must run inside a transaction. */
async function activeOrNextAttempt(db: Db, startDate: string, variant: ChallengeVariant): Promise<number> {
  const active = await first(db, ACTIVE)
  if (active) return active.id
  const attempts = await db.getAllAsync<{ attemptNumber: number }>('SELECT attemptNumber FROM challenges')
  const next = buildNextChallenge(
    attempts.map((attempt) => attempt.attemptNumber),
    startDate,
    variant,
  )
  return (await db.runAsync(INSERT_CHALLENGE, challengeToParams(next))).lastInsertRowId
}

export const challengeRepo = {
  async getActiveChallenge(): Promise<Challenge | undefined> {
    return first(getDb(), ACTIVE)
  },

  /** The active challenge or, when none is active, the most recent attempt (completed, failed or given up). */
  async getCurrent(): Promise<Challenge | undefined> {
    return (await first(getDb(), ACTIVE)) ?? first(getDb(), 'ORDER BY attemptNumber DESC')
  },

  async getById(id: number): Promise<Challenge | undefined> {
    const row = await getDb().getFirstAsync<ChallengeRow>('SELECT * FROM challenges WHERE id = ?', [id])
    return row ? challengeFromRow(row) : undefined
  },

  async getAll(): Promise<Challenge[]> {
    const rows = await getDb().getAllAsync<ChallengeRow>('SELECT * FROM challenges ORDER BY attemptNumber')
    return rows.map(challengeFromRow)
  },

  /**
   * Creates attempt #1 when there are no challenges at all — but only once the
   * player has a profile. Without one the welcome flow is due, and it creates
   * attempt #1 itself. The checks and the insert share one transaction, so
   * concurrent calls can't create two.
   */
  async bootstrapIfEmpty(startDate: string): Promise<void> {
    await transaction(async (db) => {
      const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM challenges')
      if ((count?.n ?? 0) > 0) return
      const profile = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
        SETTING_KEYS.profile,
      ])
      if (!profile || !parseProfile(JSON.parse(profile.value))) return
      await db.runAsync(INSERT_CHALLENGE, challengeToParams(buildNextChallenge([], startDate, 'hard')))
    })
  },

  /**
   * Archives an attempt as `failed` and starts the next one (attempt number
   * = highest + 1) in a single transaction, keeping the failed attempt's
   * variant (75 Hard if it had none). If an active attempt already exists —
   * e.g. the restart button was tapped twice — it's reused, so there's never
   * more than one active challenge. Only the old row's `status` is touched.
   */
  async restart(failedChallengeId: number, startDate: string): Promise<number> {
    return transaction(async (db) => {
      const failed = await getRow(db, 'challenges', failedChallengeId)
      if (failed?.status === 'active') await updateRow(db, 'challenges', failedChallengeId, { status: 'failed' })
      return activeOrNextAttempt(db, startDate, variantOf(failed ?? {}))
    })
  },

  /** Starts a fresh attempt after a completed or given-up one. Reuses the active attempt if one already exists. */
  async startNew(startDate: string, variant: ChallengeVariant): Promise<number> {
    return transaction((db) => activeOrNextAttempt(db, startDate, variant))
  },

  /** Marks an active attempt as completed. A no-op for attempts that aren't active. */
  async markCompleted(id: number): Promise<void> {
    await transaction(async (db) => {
      const challenge = await getRow(db, 'challenges', id)
      if (challenge?.status === 'active') await updateRow(db, 'challenges', id, { status: 'completed' })
    })
  },

  /**
   * Gives up the active attempt for good (Settings, after four confirmations).
   * Only from Day 1 to Day 75: before Day 1 its challenge and start date can
   * still be changed instead. Only `status` and `abandonedOn` change, so the
   * attempt keeps its days, photos and badges. The app then shows the "You
   * gave up" screen, which starts the next attempt with startNew.
   */
  async giveUp(id: number, today: string): Promise<GiveUpResult> {
    return transaction(async (db): Promise<GiveUpResult> => {
      const challenge = await getRow(db, 'challenges', id)
      if (!challenge || challenge.status !== 'active') return { ok: false, reason: 'locked' }
      if (!isChallengeDay(dayNumberForDate(challenge.startDate, today))) return { ok: false, reason: 'locked' }
      await updateRow(db, 'challenges', id, { status: 'abandoned', abandonedOn: today })
      return { ok: true }
    })
  },

  /** Records that the player has seen `count` used jokers announced. Never lowers the count. */
  async acknowledgeJokers(id: number, count: number): Promise<void> {
    await transaction(async (db) => {
      const challenge = await getRow(db, 'challenges', id)
      if (challenge && count > (challenge.jokersAcknowledged ?? 0)) await updateRow(db, 'challenges', id, { jokersAcknowledged: count })
    })
  },

  /**
   * Declares (or cancels) a social occasion. It must be declared the day
   * before at the latest, with at most one per challenge week, and only in
   * challenges that allow them. A past occasion can't be cancelled; cancelling
   * today's re-judges today.
   */
  async setSocialDay(id: number, dayNumber: number, on: boolean, today: string): Promise<SocialDayResult> {
    return transaction(async (db): Promise<SocialDayResult> => {
      const challenge = await getRow(db, 'challenges', id)
      if (!challenge || challenge.status !== 'active' || rulesFor(challenge).socialDaysPerWeek === 0) {
        return { ok: false, reason: 'not-allowed' }
      }
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > CHALLENGE_LENGTH) {
        return { ok: false, reason: 'out-of-range' }
      }
      const todayDayNumber = dayNumberForDate(challenge.startDate, today)
      const days = challenge.socialDays ?? []

      if (on) {
        if (!(dayNumber > todayDayNumber)) return { ok: false, reason: 'too-late' }
        if (days.includes(dayNumber)) return { ok: true }
        const taken = days.find((day) => challengeWeek(day) === challengeWeek(dayNumber))
        if (taken !== undefined) return { ok: false, reason: 'week-taken', dayNumber: taken }
        await updateRow(db, 'challenges', id, { socialDays: [...days, dayNumber].sort((a, b) => a - b) })
        return { ok: true }
      }

      if (!days.includes(dayNumber)) return { ok: true }
      if (dayNumber < todayDayNumber) return { ok: false, reason: 'too-late' }
      const rest = days.filter((day) => day !== dayNumber)
      await updateRow(db, 'challenges', id, { socialDays: rest.length > 0 ? rest : undefined })
      if (dayNumber === todayDayNumber) {
        const [entry] = await allRows(db, 'dayEntries', 'WHERE challengeId = ? AND dayNumber = ?', [id, dayNumber])
        if (entry) await syncDayCompletion(db, entry.id)
      }
      return { ok: true }
    })
  },
}
