import type { StartChoice } from '../hooks/useStartDateChoice'
import type { OnboardingStep } from '../logic/onboarding'
import { isChallengeVariant, type ChallengeVariant } from '../logic/rulesets'
import { isValidISODate } from './dates'

/**
 * The welcome flow's answers so far. iOS often closes a Home Screen app in the
 * background; the draft brings the player back to the same step. It lives on
 * this device only, apart from the database and its backups.
 */
export interface OnboardingDraft {
  step: OnboardingStep
  name: string
  variant: ChallengeVariant
  why: string
  startChoice: StartChoice
  pickedDate: string
}

const STEPS: readonly OnboardingStep[] = ['welcome', 'name', 'challenge', 'why', 'start', 'ready']
const START_CHOICES: readonly StartChoice[] = ['today', 'tomorrow', 'pick']

/** One draft per database, so a `?db=` scratch database keeps its own. */
export function draftKey(dbName: string): string {
  return `onboarding-draft:${dbName}`
}

function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const d = value as Record<string, unknown>
  if (
    !STEPS.includes(d.step as OnboardingStep) ||
    typeof d.name !== 'string' ||
    !isChallengeVariant(d.variant) ||
    typeof d.why !== 'string' ||
    !START_CHOICES.includes(d.startChoice as StartChoice) ||
    typeof d.pickedDate !== 'string' ||
    (d.pickedDate !== '' && !isValidISODate(d.pickedDate))
  ) {
    return null
  }
  return {
    step: d.step as OnboardingStep,
    name: d.name,
    variant: d.variant,
    why: d.why,
    startChoice: d.startChoice as StartChoice,
    pickedDate: d.pickedDate,
  }
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
