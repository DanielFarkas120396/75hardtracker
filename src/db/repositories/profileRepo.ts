import { cleanText, isValidName, isValidWhy, parseProfile, type Profile } from '../../logic/profile'
import { buildNextChallenge } from '../../logic/restart'
import type { ChallengeVariant } from '../../logic/rulesets'
import { db } from '../db'
import type { Challenge } from '../types'
import { SETTING_KEYS } from './settingsRepo'

export interface ProfileInput {
  name: string
  why: string
}

export type ProfileResult = { ok: true } | { ok: false; reason: 'invalid' }

export const profileRepo = {
  /** The player's profile, or undefined before the welcome flow is done (or when the stored one is unusable). */
  async get(): Promise<Profile | undefined> {
    return parseProfile((await db.settings.get(SETTING_KEYS.profile))?.value)
  },

  /** Updates the name and the reason (Settings → Profile), keeping when the welcome flow was done. */
  async save(input: ProfileInput, now: Date = new Date()): Promise<ProfileResult> {
    if (!isValidName(input.name) || !isValidWhy(input.why)) return { ok: false, reason: 'invalid' }
    await db.transaction('rw', db.settings, async () => {
      const current = parseProfile((await db.settings.get(SETTING_KEYS.profile))?.value)
      const profile: Profile = {
        name: cleanText(input.name),
        why: cleanText(input.why),
        onboardedAt: current?.onboardedAt ?? now.toISOString(),
      }
      await db.settings.put({ key: SETTING_KEYS.profile, value: profile })
    })
    return { ok: true }
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
    await db.transaction('rw', [db.settings, db.challenges], async () => {
      if (firstAttempt && (await db.challenges.count()) === 0) {
        await db.challenges.add(buildNextChallenge([], firstAttempt.startDate, firstAttempt.variant) as Challenge)
      }
      const profile: Profile = { name: cleanText(input.name), why: cleanText(input.why), onboardedAt: now.toISOString() }
      await db.settings.put({ key: SETTING_KEYS.profile, value: profile })
    })
    return { ok: true }
  },
}
