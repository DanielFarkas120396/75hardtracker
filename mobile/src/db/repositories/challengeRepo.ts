import { parseProfile } from '@logic/profile'
import { buildNextChallenge } from '@logic/restart'
import type { ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import type { Db } from '../driver'
import { getDb, transaction } from '../open'
import { challengeFromRow, challengeToParams, INSERT_CHALLENGE, type ChallengeRow } from '../rows'
import type { Challenge } from '../types'

/**
 * The attempts. Same calls and behaviour as the web app's challengeRepo
 * (src/db/repositories/challengeRepo.ts); the methods the first screens don't
 * need yet (restart, give up, start date, variant, social days, jokers)
 * arrive with those screens.
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

  /** Starts a fresh attempt after a completed or given-up one. Reuses the active attempt if one already exists. */
  async startNew(startDate: string, variant: ChallengeVariant): Promise<number> {
    return transaction((db) => activeOrNextAttempt(db, startDate, variant))
  },
}
