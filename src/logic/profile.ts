/** Who the player is, from the welcome flow. Stored in the settings table under SETTING_KEYS.profile. */
export interface Profile {
  name: string
  why: string
  /** ISO datetime the welcome flow was finished. */
  onboardedAt: string
}

export const NAME_MAX_LENGTH = 20
export const WHY_MAX_LENGTH = 140

/** Trims and collapses inner whitespace (new lines included), as names and reasons are stored. */
export function cleanText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidName(raw: string): boolean {
  const name = cleanText(raw)
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH
}

export function isValidWhy(raw: string): boolean {
  const why = cleanText(raw)
  return why.length >= 1 && why.length <= WHY_MAX_LENGTH
}

/** The stored profile, cleaned, when it's usable (a valid name and reason); undefined otherwise. */
export function parseProfile(value: unknown): Profile | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { name, why, onboardedAt } = value as Record<string, unknown>
  if (typeof name !== 'string' || typeof why !== 'string' || typeof onboardedAt !== 'string') return undefined
  if (!isValidName(name) || !isValidWhy(why)) return undefined
  return { name: cleanText(name), why: cleanText(why), onboardedAt }
}
