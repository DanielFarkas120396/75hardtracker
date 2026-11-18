import { cleanText, isValidName, isValidWhy, parseProfile, type Profile } from '@logic/profile'
import { buildNextChallenge } from '@logic/restart'
import type { ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import type { Db } from '../driver'
import { getDb, transaction } from '../open'
import { challengeToParams, INSERT_CHALLENGE } from '../rows'

export interface ProfileInput {
  name: string
  why: string
}

export type ProfileResult = { ok: true } | { ok: false; reason: 'invalid' }

async function readProfile(db: Db): Promise<Profile | undefined> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.profile])
  return row ? parseProfile(JSON.parse(row.value)) : undefined
}

function writeProfile(db: Db, profile: Profile) {
  return db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
    SETTING_KEYS.profile,
    JSON.stringify(profile),
  ])
}

/**
 * The player's profile. Same calls and behaviour as the web app's profileRepo
 * (src/db/repositories/profileRepo.ts). `save` arrives with Settings → Profile.
 */
export const profileRepo = {
  /** The player's profile, or undefined before the welcome flow is done (or when the stored one is unusable). */
  async get(): Promise<Profile | undefined> {
    return readProfile(getDb())
  },

  /**
   * Finishes the welcome flow: saves the profile and, for a new player
   * (`firstAttempt` given and no attempts at all yet), creates attempt #1
   * with the chosen challenge and start date — in one transaction. Existing
   * attempts are never touched.
   */
  async completeOnboarding(
    input: ProfileInput,
    firstAttempt?: { startDate: string; variant: ChallengeVariant },
    now: Date = new Date(),
  ): Promise<ProfileResult> {
    if (!isValidName(input.name) || !isValidWhy(input.why)) return { ok: false, reason: 'invalid' }
    await transaction(async (db) => {
      const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM challenges')
      if (firstAttempt && (count?.n ?? 0) === 0) {
        await db.runAsync(
          INSERT_CHALLENGE,
          challengeToParams(buildNextChallenge([], firstAttempt.startDate, firstAttempt.variant)),
        )
      }
      await writeProfile(db, { name: cleanText(input.name), why: cleanText(input.why), onboardedAt: now.toISOString() })
    })
    return { ok: true }
  },
}
