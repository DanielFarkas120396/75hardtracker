import { parseDraft, type OnboardingDraft } from '@logic/onboardingDraft'
import { getDb, transaction } from '../db/open'
import { settingsRepo } from '../db/repositories/settingsRepo'

/**
 * The welcome flow's answers so far, kept on the phone so that closing the app
 * comes back to the same step (the web keeps them in localStorage). One row of
 * the settings table. It belongs to this phone: never put it in a backup.
 */
const KEY = 'onboardingDraft'

export async function loadDraft(): Promise<OnboardingDraft | null> {
  return parseDraft(await settingsRepo.get<string | null>(KEY, null))
}

export function saveDraft(draft: OnboardingDraft): Promise<void> {
  return settingsRepo.set(KEY, JSON.stringify(draft))
}

export async function clearDraft(): Promise<void> {
  if (!(await getDb().getFirstAsync('SELECT 1 FROM settings WHERE key = ?', [KEY]))) return
  await transaction(async (db) => {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [KEY])
  })
}
