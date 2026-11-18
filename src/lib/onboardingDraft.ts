import { parseDraft, type OnboardingDraft } from '../logic/onboardingDraft'

export type { OnboardingDraft }

/** One draft per database, so a `?db=` scratch database keeps its own. */
export function draftKey(dbName: string): string {
  return `onboarding-draft:${dbName}`
}

export function loadDraft(dbName: string): OnboardingDraft | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(dbName)))
  } catch {
    return null
  }
}

export function saveDraft(dbName: string, draft: OnboardingDraft): void {
  try {
    localStorage.setItem(draftKey(dbName), JSON.stringify(draft))
  } catch {
    // Storage unavailable (private mode, full): the flow still works, it just won't survive a restart.
  }
}

export function clearDraft(dbName: string): void {
  try {
    localStorage.removeItem(draftKey(dbName))
  } catch {
    // Nothing to clear.
  }
}
