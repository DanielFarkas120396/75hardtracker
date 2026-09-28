# Welcome Flow and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a mobile-style welcome flow on first launch (name, challenge, reason, start date) and use the name and the reason throughout the app.

**Architecture:**
- **Data:** a `profile` settings row (`{ name, why, onboardedAt }`), read and written through `profileRepo`.
- **Gate:** `OnboardingGate` wraps the app. It shows `OnboardingFlow` until a profile exists (new or returning mode), then provides the profile through `ProfileContext`.
- **Consumers:** screens read the profile with `useProfile()` or the small `ProfileLines` components, and fall back to today's text without one.
- **Start picker:** `NewChallengeSheet`'s picker is extracted, so the flow can reuse it.

**Tech Stack:** React 19, TypeScript 6, Dexie 4 with dexie-react-hooks, framer-motion, Tailwind 4, Vitest with Testing Library and fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-28-welcome-flow-design.md`

## Global Constraints

- **Copy:** the UI copy is English and uses the spec's strings exactly (spec §5, §6, §7).
- **Target:** an iPhone Safari PWA, so touch only.
  - Nothing may depend on hover, and nothing may vibrate.
  - Text fields use at least a 16 px font (`text-base` or larger), so iOS doesn't zoom in on them.
- **Data:**
  - No Dexie version bump.
  - The owner's pre-variants 75 Hard attempt (no `variant` field) must never be written by the welcome flow.
  - Only `profileRepo.completeOnboarding` may create an attempt, and only when there are no attempts at all.
- **Gates:** every gate passes before each commit: `npx tsc -b`, `npm run lint`, `npm run test` and `npm run build`. The test run must exit with code 0: Vitest fails a run on any unhandled error, even when every test passes. `tsc -b` type-checks the test files too.
- **Tests:** they follow the existing patterns:
  - `freshDatabase` and `addChallenge` from `src/db/__tests__/fixtures.ts`;
  - `MotionGlobalConfig.skipAnimations = true` in UI tests;
  - the repository test files already run under `// @vitest-environment node`.
- **Style:**
  - Match the surrounding code's style, naming and comment density.
  - `react/only-export-components` is on, so component files export only components. Hooks and helpers go in `.ts` files.
- **Commits:** every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Untracked folders:** leave `animations/` and `inspo/` alone, and `git add` only the task's files.

---

### Task 1: The profile engine — data, repository, steps, scenarios

**Files:**
- Create: `src/logic/profile.ts`, `src/logic/onboarding.ts`, `src/db/repositories/profileRepo.ts`, `src/logic/__tests__/profile.test.ts`, `src/logic/__tests__/onboarding.test.ts`
- Modify: `src/db/repositories/settingsRepo.ts`, `src/dev/scenarios.ts`, `README.md`, `src/db/__tests__/repositories.test.ts`, `src/db/__tests__/goldenHard.test.ts`

**Interfaces:**
- Produces (later tasks rely on these exact names):
  - `src/logic/profile.ts`:
    - `interface Profile { name: string; why: string; onboardedAt: string }`;
    - `NAME_MAX_LENGTH = 20` and `WHY_MAX_LENGTH = 140`;
    - `cleanText(raw)`, `isValidName(raw)`, `isValidWhy(raw)`, `parseProfile(value)`.
  - `src/logic/onboarding.ts`:
    - `type OnboardingStep = 'welcome' | 'name' | 'challenge' | 'why' | 'start' | 'ready'`;
    - `type OnboardingMode = 'new' | 'returning'`;
    - `onboardingSteps(mode)`.
  - `src/db/repositories/profileRepo.ts`:
    - `profileRepo.get(): Promise<Profile | undefined>`;
    - `profileRepo.save(input: ProfileInput, now?: Date): Promise<ProfileResult>`;
    - `profileRepo.completeOnboarding(input: ProfileInput, firstAttempt?: { startDate: string; variant: ChallengeVariant }, now?: Date): Promise<ProfileResult>`;
    - `interface ProfileInput { name: string; why: string }`;
    - `type ProfileResult = { ok: true } | { ok: false; reason: 'invalid' }`.
  - `SETTING_KEYS.profile = 'profile'`.
  - The dev scenarios `seedFreshInstall()` and `seedReturningWithoutProfile()`.

- [ ] **Step 1: Write the failing tests**

Create `src/logic/__tests__/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, parseProfile, WHY_MAX_LENGTH } from '../profile'

describe('cleanText', () => {
  it('trims and collapses inner whitespace', () => {
    expect(cleanText('  Daniel   F.  ')).toBe('Daniel F.')
    expect(cleanText('Get\n fit')).toBe('Get fit')
  })
})

describe('isValidName', () => {
  it('needs 1 to 20 characters once cleaned', () => {
    expect(isValidName('Daniel')).toBe(true)
    expect(isValidName('   ')).toBe(false)
    expect(isValidName('x'.repeat(NAME_MAX_LENGTH))).toBe(true)
    expect(isValidName('x'.repeat(NAME_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('isValidWhy', () => {
  it('needs 1 to 140 characters once cleaned', () => {
    expect(isValidWhy('A fresh start')).toBe(true)
    expect(isValidWhy('')).toBe(false)
    expect(isValidWhy('x'.repeat(WHY_MAX_LENGTH))).toBe(true)
    expect(isValidWhy('x'.repeat(WHY_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('parseProfile', () => {
  const onboardedAt = '2026-09-28T08:00:00.000Z'

  it('returns a stored profile, cleaned', () => {
    expect(parseProfile({ name: ' Daniel ', why: 'Build  real discipline', onboardedAt })).toEqual({
      name: 'Daniel',
      why: 'Build real discipline',
      onboardedAt,
    })
  })

  it('ignores anything unusable', () => {
    expect(parseProfile(undefined)).toBeUndefined()
    expect(parseProfile('Daniel')).toBeUndefined()
    expect(parseProfile({ name: '', why: 'x', onboardedAt })).toBeUndefined()
    expect(parseProfile({ name: 'Daniel', why: 'x' })).toBeUndefined()
    expect(parseProfile({ name: 'Daniel', why: 'x'.repeat(WHY_MAX_LENGTH + 1), onboardedAt })).toBeUndefined()
  })
})
```

Create `src/logic/__tests__/onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { onboardingSteps } from '../onboarding'

describe('onboardingSteps', () => {
  it('walks a new player through the challenge and its start', () => {
    expect(onboardingSteps('new')).toEqual(['welcome', 'name', 'challenge', 'why', 'start', 'ready'])
  })

  it('skips the challenge and the start for a returning player, whose attempts stay as they are', () => {
    expect(onboardingSteps('returning')).toEqual(['welcome', 'name', 'why', 'ready'])
  })
})
```

In `src/db/__tests__/repositories.test.ts`:
- add `import { profileRepo } from '../repositories/profileRepo'` to the imports;
- add this block at the end of the file (`today`, `addDaysISO`, `addChallenge` and `db` are already in scope):

```ts
describe('the profile', () => {
  const now = new Date('2026-09-28T08:00:00.000Z')

  it('is undefined until the welcome flow is done', async () => {
    expect(await profileRepo.get()).toBeUndefined()
  })

  it('completes the flow for a new player: attempt #1 with the chosen challenge and start, then the profile', async () => {
    const result = await profileRepo.completeOnboarding(
      { name: ' Daniel ', why: 'A fresh start' },
      { startDate: addDaysISO(today, 1), variant: 'medium' },
      now,
    )

    expect(result).toEqual({ ok: true })
    expect(await db.challenges.toArray()).toMatchObject([
      { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
    ])
    expect(await profileRepo.get()).toEqual({ name: 'Daniel', why: 'A fresh start', onboardedAt: now.toISOString() })
  })

  it('never adds an attempt when one exists already, and never touches it', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)

    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: today, variant: 'soft' }, now)

    expect(await db.challenges.toArray()).toEqual([before])
  })

  it('saves only the profile for a returning player', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)

    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, undefined, now)

    expect(await db.challenges.toArray()).toEqual([before])
    expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' })
  })

  it('writes nothing when the name or the reason is unusable', async () => {
    const firstAttempt = { startDate: today, variant: 'hard' as const }
    expect(await profileRepo.completeOnboarding({ name: '  ', why: 'A fresh start' }, firstAttempt)).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await profileRepo.completeOnboarding({ name: 'Daniel', why: '' }, firstAttempt)).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await db.challenges.count()).toBe(0)
    expect(await profileRepo.get()).toBeUndefined()
  })

  it('updates the name and the reason, keeping when the flow was done', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, undefined, now)

    expect(await profileRepo.save({ name: 'Dan', why: 'Clear my head' }, new Date('2026-10-01T08:00:00.000Z'))).toEqual({
      ok: true,
    })
    expect(await profileRepo.get()).toEqual({ name: 'Dan', why: 'Clear my head', onboardedAt: now.toISOString() })

    expect(await profileRepo.save({ name: 'x'.repeat(21), why: 'Clear my head' })).toEqual({ ok: false, reason: 'invalid' })
    expect(await profileRepo.get()).toMatchObject({ name: 'Dan' })
  })
})
```

In `src/db/__tests__/goldenHard.test.ts`:
- add `import { profileRepo } from '../repositories/profileRepo'` to the imports;
- add this test at the end of `describe('a pre-variants 75 Hard attempt', …)`:

```ts
  it('comes through the returning welcome flow untouched', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, -11) // today is Day 12
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)

    const challengesSnapshot = await db.challenges.toArray()
    const dayEntriesSnapshot = await db.dayEntries.toArray()
    const workoutsSnapshot = await db.workouts.toArray()

    // The returning flow passes no first attempt: only the profile is written.
    expect(await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })).toEqual({ ok: true })

    expect(await db.challenges.toArray()).toEqual(challengesSnapshot)
    expect(await db.challenges.get(challengeId)).not.toHaveProperty('variant')
    expect(await db.dayEntries.toArray()).toEqual(dayEntriesSnapshot)
    expect(await db.workouts.toArray()).toEqual(workoutsSnapshot)
  })
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/logic/__tests__/profile.test.ts src/logic/__tests__/onboarding.test.ts src/db/__tests__/repositories.test.ts src/db/__tests__/goldenHard.test.ts`

Expected: the modules `../profile`, `../onboarding` and `../repositories/profileRepo` can't be resolved.

- [ ] **Step 3: Implement**

Create `src/logic/profile.ts`:

```ts
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
```

Create `src/logic/onboarding.ts`:

```ts
/** A screen of the welcome flow. */
export type OnboardingStep = 'welcome' | 'name' | 'challenge' | 'why' | 'start' | 'ready'

/** 'new': no attempts yet, so the flow also picks the challenge and its start. 'returning': attempts exist already. */
export type OnboardingMode = 'new' | 'returning'

/**
 * The welcome flow's screens, in order. A returning player keeps the attempts
 * they have, so they skip the challenge and its start date. A paywall, one
 * day, would go right before 'ready'.
 */
export function onboardingSteps(mode: OnboardingMode): OnboardingStep[] {
  return mode === 'new'
    ? ['welcome', 'name', 'challenge', 'why', 'start', 'ready']
    : ['welcome', 'name', 'why', 'ready']
}
```

In `src/db/repositories/settingsRepo.ts`, add this key after `bedtime` in `SETTING_KEYS`:

```ts
  /** The player's profile from the welcome flow — { name, why, onboardedAt }; read and write it with profileRepo. */
  profile: 'profile',
```

Create `src/db/repositories/profileRepo.ts`:

```ts
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
```

In `src/dev/scenarios.ts`:
- add the imports `import { SETTING_KEYS } from '../db/repositories/settingsRepo'` and `import type { Profile } from '../logic/profile'`;
- in the file's header comment, add this line after "Every function refuses to run against the default database, …":

```ts
 * Every scenario also writes a default profile (Sam), so it opens straight on
 * the app — except the two that are about the welcome flow.
```

Add this helper above `replaceDatabase`:

```ts
/** The profile every scenario gets unless it's about the welcome flow, so it opens straight on the app. */
function scenarioProfile(): Profile {
  return { name: 'Sam', why: 'Prove I can finish what I start.', onboardedAt: new Date().toISOString() }
}
```

Change `replaceDatabase`'s signature, and write the profile right after the tables are cleared (inside the transaction):

```ts
async function replaceDatabase(seeds: SeedChallenge[], { withProfile = true }: { withProfile?: boolean } = {}): Promise<void> {
```

```ts
    await Promise.all(db.tables.map((table) => table.clear()))
    if (withProfile) await db.settings.put({ key: SETTING_KEYS.profile, value: scenarioProfile() })
```

Add these at the end of the file:

```ts
/** An empty database with no profile: opens on the welcome flow for a new player. */
export async function seedFreshInstall(): Promise<void> {
  await replaceDatabase([], { withProfile: false })
}

/**
 * 75 Hard on Day 4 with Days 1–3 done, but no profile yet — like the owner's
 * phone right after the welcome flow shipped: opens on the returning flow
 * (name and reason only).
 */
export async function seedReturningWithoutProfile(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= 3; day++) days.push(await perfectDay(day))

  await replaceDatabase(
    [{ challenge: { startDate: addDaysISO(todayISO(), -3), attemptNumber: 1, status: 'active' }, days }],
    { withProfile: false },
  )
}
```

`README.md`, in the "Dev scenarios" table:
- add these two rows after the `seedGaveUp()` row:

```md
| `seedFreshInstall()` | An empty database with no profile: opens on the welcome flow for a new player. |
| `seedReturningWithoutProfile()` | 75 Hard on Day 4 (Days 1–3 done) with no profile yet: opens on the returning welcome flow (name and reason only). |
```

- add this sentence right before "Every scenario refuses to run against the default database.":

```md
Every other scenario also writes a default profile (Sam), so it opens straight on the app.
```

- [ ] **Step 4: Run the new tests to see them pass**

Run the Step 2 command. Expected: every test passes.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/logic/profile.ts src/logic/onboarding.ts src/db/repositories/profileRepo.ts src/db/repositories/settingsRepo.ts src/dev/scenarios.ts README.md src/logic/__tests__/profile.test.ts src/logic/__tests__/onboarding.test.ts src/db/__tests__/repositories.test.ts src/db/__tests__/goldenHard.test.ts
git commit -m "feat: store the player's profile, and finish the welcome flow in one transaction" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extract the start picker from NewChallengeSheet

**Files:**
- Create: `src/hooks/useStartDateChoice.ts`, `src/components/StartDateChoice.tsx`, `src/hooks/__tests__/useStartDateChoice.test.ts`
- Modify: `src/screens/Victory/NewChallengeSheet.tsx`
- Must keep passing unchanged: `src/screens/Victory/__tests__/NewChallengeSheet.test.tsx`

**Interfaces:**
- Produces (Task 3 relies on these):
  - `useStartDateChoice(today: string): StartDateChoiceState`;
  - `type StartChoice = 'today' | 'tomorrow' | 'pick'`;
  - `interface StartDateChoiceState { choice; setChoice; pickedDate; setPickedDate; startDate: string; dateError: string | null }`;
  - `<StartDateChoice state={…} today={…} />`, which renders the radiogroup "When to start" and, while picking, the date field "Start date".

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useStartDateChoice.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addDaysISO } from '../../lib/dates'
import { useStartDateChoice } from '../useStartDateChoice'

const today = '2026-09-28'

describe('useStartDateChoice', () => {
  it('starts today by default', () => {
    const { result } = renderHook(() => useStartDateChoice(today))
    expect(result.current).toMatchObject({ choice: 'today', startDate: today, dateError: null })
  })

  it('starts tomorrow, or on a picked date', () => {
    const { result } = renderHook(() => useStartDateChoice(today))

    act(() => result.current.setChoice('tomorrow'))
    expect(result.current.startDate).toBe(addDaysISO(today, 1))

    act(() => {
      result.current.setChoice('pick')
      result.current.setPickedDate('2026-10-05')
    })
    expect(result.current).toMatchObject({ startDate: '2026-10-05', dateError: null })
  })

  it('refuses a picked date in the past, or none at all', () => {
    const { result } = renderHook(() => useStartDateChoice(today))

    act(() => {
      result.current.setChoice('pick')
      result.current.setPickedDate('2026-09-27')
    })
    expect(result.current.dateError).toBe("The start can't be in the past.")

    act(() => result.current.setPickedDate(''))
    expect(result.current.dateError).toBe('Pick a start date.')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/hooks/__tests__/useStartDateChoice.test.ts`

Expected: `../useStartDateChoice` can't be resolved.

- [ ] **Step 3: Implement**

Create `src/hooks/useStartDateChoice.ts`:

```ts
import { useState } from 'react'
import { addDaysISO, isValidISODate } from '../lib/dates'

export type StartChoice = 'today' | 'tomorrow' | 'pick'

export interface StartDateChoiceState {
  choice: StartChoice
  setChoice: (choice: StartChoice) => void
  pickedDate: string
  setPickedDate: (date: string) => void
  /** The start date the choice gives (ISO). */
  startDate: string
  /** Why that date can't start an attempt, or null when it can. */
  dateError: string | null
}

/** When an attempt starts: today, tomorrow or a picked date, never in the past. */
export function useStartDateChoice(today: string): StartDateChoiceState {
  const [choice, setChoice] = useState<StartChoice>('today')
  const [pickedDate, setPickedDate] = useState(today)

  const startDate = choice === 'today' ? today : choice === 'tomorrow' ? addDaysISO(today, 1) : pickedDate
  // ISO strings compare chronologically.
  const dateError = !isValidISODate(startDate)
    ? 'Pick a start date.'
    : startDate < today
      ? "The start can't be in the past."
      : null

  return { choice, setChoice, pickedDate, setPickedDate, startDate, dateError }
}
```

Create `src/components/StartDateChoice.tsx`:

```tsx
import type { StartChoice, StartDateChoiceState } from '../hooks/useStartDateChoice'

const START_CHOICES: ReadonlyArray<{ id: StartChoice; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'pick', label: 'Pick a date' },
]

interface StartDateChoiceProps {
  /** From useStartDateChoice. */
  state: StartDateChoiceState
  today: string
}

/** Today / Tomorrow / Pick a date, with a date field while picking. */
export function StartDateChoice({ state, today }: StartDateChoiceProps) {
  return (
    <>
      <div role="radiogroup" aria-label="When to start" className="flex gap-1 rounded-2xl bg-canvas p-1">
        {START_CHOICES.map(({ id, label }) => {
          const selected = state.choice === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => state.setChoice(id)}
              className={`min-h-touch flex-1 rounded-xl px-2 font-rounded text-sm font-bold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected ? 'bg-surface text-ink shadow-sm ring-1 ring-ink-muted' : 'text-ink-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {state.choice === 'pick' && (
        <input
          type="date"
          aria-label="Start date"
          min={today}
          value={state.pickedDate}
          onChange={(e) => state.setPickedDate(e.target.value)}
          className="mt-2 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      )}
    </>
  )
}
```

In `src/screens/Victory/NewChallengeSheet.tsx`:
- remove the `StartChoice` type and `START_CHOICES`;
- change the dates import to `import { formatDisplayDate } from '../../lib/dates'`;
- add `import { StartDateChoice } from '../../components/StartDateChoice'` and `import { useStartDateChoice } from '../../hooks/useStartDateChoice'`;
- replace `NewChallengeForm` with the following. Its markup and behaviour are the same as before; only the start picker comes from the shared hook and component.

```tsx
/** Mounted each time the sheet opens, so the variant and start choice reset to their defaults. */
function NewChallengeForm({ defaultVariant, today, onClose }: NewChallengeSheetProps) {
  const [variant, setVariant] = useState<ChallengeVariant>(defaultVariant)
  const start = useStartDateChoice(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const begin = async () => {
    if (start.dateError) return
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.startNew(start.startDate, variant)
      onClose()
    } catch {
      setError("Couldn't start it — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className="font-rounded text-lg font-extrabold text-ink">Start a new challenge</h3>

      <div className="mt-3">
        <VariantPicker value={variant} onChange={setVariant} />
      </div>

      <div className="mt-3">
        <StartDateChoice state={start} today={today} />
      </div>

      {!start.dateError && (
        <p className="mt-3 text-sm text-ink-muted">
          A new attempt starts on {formatDisplayDate(start.startDate)}. Every photo and stat from this one stays saved.
        </p>
      )}

      {(start.dateError ?? error) && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {start.dateError ?? error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void begin()} disabled={busy || start.dateError !== null}>
          {busy ? 'Starting…' : 'Start'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/hooks/__tests__/useStartDateChoice.test.ts src/screens/Victory`

Expected: all pass, including the unchanged `NewChallengeSheet` and `VictoryScreen` tests.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useStartDateChoice.ts src/components/StartDateChoice.tsx src/screens/Victory/NewChallengeSheet.tsx src/hooks/__tests__/useStartDateChoice.test.ts
git commit -m "refactor: share the start-date picker, so the welcome flow can use it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The welcome flow screens

**Files:**
- Create: `src/content/onboarding.ts`, `src/screens/Onboarding/OnboardingFlow.tsx`, `src/screens/Onboarding/OnboardingSteps.tsx`, `src/content/__tests__/onboarding.test.ts`, `src/screens/Onboarding/__tests__/OnboardingFlow.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `onboardingSteps`, `OnboardingMode`, `OnboardingStep`, `cleanText`, `isValidName`, `isValidWhy`, `NAME_MAX_LENGTH`, `WHY_MAX_LENGTH` and `profileRepo.completeOnboarding`;
  - from Task 2: `useStartDateChoice` and `StartDateChoice`;
  - already existing:
    - `GateHeading` (`src/screens/RestartFlow/GateHeading.tsx`), an `h1` that focuses itself on mount;
    - `VariantPicker`, `Mascot` (moods `content`, `watching`, `tapping`, `judging`, `waiting` and `triumphant`), `Button` and `VARIANT_NAMES`.
- Produces:
  - `<OnboardingFlow mode={'new' | 'returning'} today={iso} />`;
  - `WHY_IDEAS` and `startsWhen(startDate, today)` in `src/content/onboarding.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/content/__tests__/onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDisplayDate } from '../../lib/dates'
import { startsWhen } from '../onboarding'

describe('startsWhen', () => {
  it('says today, tomorrow, or the date', () => {
    expect(startsWhen('2026-09-28', '2026-09-28')).toBe('today')
    expect(startsWhen('2026-09-29', '2026-09-28')).toBe('tomorrow')
    expect(startsWhen('2026-10-03', '2026-09-28')).toBe(`on ${formatDisplayDate('2026-10-03')}`)
  })
})
```

Create `src/screens/Onboarding/__tests__/OnboardingFlow.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { OnboardingFlow } from '../OnboardingFlow'

const today = todayISO()

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const heading = (name: string) => screen.findByRole('heading', { name })
const nameField = () => screen.getByRole('textbox', { name: 'Your name' })
const whyField = () => screen.getByRole('textbox', { name: 'Your why' })

/** From the welcome screen, past the name step with `name`. */
async function passWelcomeAndName(name = 'Daniel') {
  click('Get started')
  await heading('What should the duck call you?')
  fireEvent.change(nameField(), { target: { value: name } })
  click('Continue')
}

describe('OnboardingFlow', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks a new player through every step and creates attempt #1 with the profile', async () => {
    render(<OnboardingFlow mode="new" today={today} />)

    expect(await heading('75 days. 5 tasks. One duck with a knife.')).toHaveFocus()
    click('Get started')

    expect(await heading('What should the duck call you?')).toHaveFocus()
    fireEvent.change(nameField(), { target: { value: '  Daniel ' } })
    click('Continue')

    await heading('Pick your challenge')
    fireEvent.click(screen.getByRole('radio', { name: /^75 Medium/ }))
    click('Continue')

    await heading('Why are you doing this?')
    click('A fresh start')
    expect(whyField()).toHaveValue('A fresh start')
    click('Continue')

    await heading('When do you start?')
    fireEvent.click(screen.getByRole('radio', { name: 'Tomorrow' }))
    click('Continue')

    expect(await heading('Deal, Daniel.')).toBeInTheDocument()
    expect(screen.getByText('75 Medium starts tomorrow.')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
    click("Let's go")

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' }))
    expect(await db.challenges.toArray()).toMatchObject([
      { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
    ])
  })

  it('asks a returning player only for a name and a reason, and leaves the attempts alone', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)
    render(<OnboardingFlow mode="returning" today={today} />)

    await passWelcomeAndName()
    await heading('Why are you doing this?')
    fireEvent.change(whyField(), { target: { value: 'Clear my head' } })
    click('Continue')

    expect(await heading('Welcome back, Daniel.')).toBeInTheDocument()
    expect(screen.getByText('Your challenge is right where you left it.')).toBeInTheDocument()
    click("Let's go")

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'Clear my head' }))
    expect(await db.challenges.toArray()).toEqual([before])
  })

  it('moves on only with a usable name, and Enter moves on too', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    click('Get started')
    await heading('What should the duck call you?')

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.change(nameField(), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    fireEvent.change(nameField(), { target: { value: 'Daniel' } })
    fireEvent.keyDown(nameField(), { key: 'Enter' })
    expect(await heading('Pick your challenge')).toBeInTheDocument()
  })

  it('keeps what was entered when going back', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    fireEvent.click(screen.getByRole('radio', { name: /^75 Soft/ }))

    click('Back')
    expect(await heading('What should the duck call you?')).toBeInTheDocument()
    expect(nameField()).toHaveValue('Daniel')

    click('Continue')
    await heading('Pick your challenge')
    expect(screen.getByRole('radio', { name: /^75 Soft/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('needs a reason, which the ideas fill and the player can still edit', async () => {
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    click('Build real discipline')
    expect(screen.getByRole('button', { name: 'Build real discipline' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(whyField(), { target: { value: 'Build real discipline, finally' } })
    expect(screen.getByRole('button', { name: 'Build real discipline' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('refuses a start date in the past', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    click('Continue')
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: addDaysISO(today, -1) } })

    expect(screen.getByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('says so, and lets the player try again, when saving fails', async () => {
    vi.spyOn(profileRepo, 'completeOnboarding').mockRejectedValueOnce(new Error('quota'))
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('Welcome back, Daniel.')

    click("Let's go")

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that — try again.")
    expect(screen.getByRole('button', { name: "Let's go" })).toBeEnabled()
  })

  it('shows how far along the flow is, with Back from the second screen on', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    const progress = () => screen.getByRole('progressbar', { name: 'Welcome progress' })

    expect(progress()).toHaveAttribute('aria-valuetext', 'Step 1 of 6')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    click('Get started')
    await heading('What should the duck call you?')
    expect(progress()).toHaveAttribute('aria-valuetext', 'Step 2 of 6')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/content/__tests__/onboarding.test.ts src/screens/Onboarding`

Expected: `../onboarding` and `../OnboardingFlow` can't be resolved.

- [ ] **Step 3: Implement**

Create `src/content/onboarding.ts`:

```ts
import { addDaysISO, formatDisplayDate } from '../lib/dates'

/** Reasons the welcome flow suggests; a tap fills the field, which stays editable. */
export const WHY_IDEAS = [
  'Prove I can finish what I start',
  'Get in the best shape of my life',
  'Build real discipline',
  'Clear my head',
  'A fresh start',
] as const

/** When a new attempt starts, for the ready step: "today", "tomorrow" or "on 3 Oct 2026". */
export function startsWhen(startDate: string, today: string): string {
  if (startDate === today) return 'today'
  if (startDate === addDaysISO(today, 1)) return 'tomorrow'
  return `on ${formatDisplayDate(startDate)}`
}
```

Create `src/screens/Onboarding/OnboardingSteps.tsx`:

```tsx
import type { KeyboardEvent, ReactNode } from 'react'
import { StartDateChoice } from '../../components/StartDateChoice'
import { Button } from '../../components/ui/Button'
import { VariantPicker } from '../../components/VariantPicker'
import { startsWhen, WHY_IDEAS } from '../../content/onboarding'
import { VARIANT_NAMES } from '../../content/variants'
import type { StartDateChoiceState } from '../../hooks/useStartDateChoice'
import type { OnboardingMode } from '../../logic/onboarding'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH } from '../../logic/profile'
import type { ChallengeVariant } from '../../logic/rulesets'
import { GateHeading } from '../RestartFlow/GateHeading'

/** Enter moves on when the step's answer is valid; it never inserts a new line. */
function enterMovesOn(valid: boolean, onNext: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (valid) onNext()
  }
}

/** A step's title: it takes focus as the step appears, so VoiceOver reads the new question. */
function StepTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4">
      <GateHeading>{children}</GateHeading>
    </div>
  )
}

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <StepTitle>75 days. 5 tasks. One duck with a knife.</StepTitle>
      <p className="mt-3 text-ink-muted">
        Workouts, diet, water, reading and a progress photo, every single day. I'll be watching.
      </p>
      <Button className="mt-8 w-full" onClick={onNext}>
        Get started
      </Button>
    </>
  )
}

interface NameStepProps {
  name: string
  onChange: (name: string) => void
  onNext: () => void
}

export function NameStep({ name, onChange, onNext }: NameStepProps) {
  const valid = isValidName(name)
  return (
    <>
      <StepTitle>What should the duck call you?</StepTitle>
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-label="Your name"
        placeholder="Your name"
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="next"
        className="mt-6 min-h-touch w-full rounded-xl bg-canvas px-4 text-center font-rounded text-lg font-bold text-ink"
      />
      <p className="mt-2 text-sm text-ink-muted">Up to {NAME_MAX_LENGTH} characters.</p>
      <Button className="mt-6 w-full" onClick={onNext} disabled={!valid}>
        Continue
      </Button>
    </>
  )
}

interface ChallengeStepProps {
  variant: ChallengeVariant
  onChange: (variant: ChallengeVariant) => void
  onNext: () => void
}

export function ChallengeStep({ variant, onChange, onNext }: ChallengeStepProps) {
  return (
    <>
      <StepTitle>Pick your challenge</StepTitle>
      <p className="mt-2 text-ink-muted">You can switch until the end of Day 1.</p>
      <div className="mt-4 w-full text-left">
        <VariantPicker value={variant} onChange={onChange} />
      </div>
      <Button className="mt-6 w-full" onClick={onNext}>
        Continue
      </Button>
    </>
  )
}

interface WhyStepProps {
  why: string
  onChange: (why: string) => void
  onNext: () => void
}

export function WhyStep({ why, onChange, onNext }: WhyStepProps) {
  const valid = isValidWhy(why)
  return (
    <>
      <StepTitle>Why are you doing this?</StepTitle>
      <p className="mt-2 text-ink-muted">I'll remind you when it gets hard.</p>
      <textarea
        value={why}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-label="Your why"
        placeholder="Because…"
        maxLength={WHY_MAX_LENGTH}
        rows={3}
        enterKeyHint="next"
        className="mt-4 w-full resize-none rounded-xl bg-canvas p-4 font-rounded text-lg font-bold text-ink"
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {WHY_IDEAS.map((idea) => {
          const chosen = cleanText(why) === idea
          return (
            <button
              key={idea}
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(idea)}
              className={`min-h-touch rounded-full px-4 font-rounded text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                chosen ? 'bg-green-light text-green-ink ring-2 ring-green-ink' : 'bg-canvas text-ink'
              }`}
            >
              {idea}
            </button>
          )
        })}
      </div>
      <Button className="mt-6 w-full" onClick={onNext} disabled={!valid}>
        Continue
      </Button>
    </>
  )
}

interface StartStepProps {
  start: StartDateChoiceState
  today: string
  onNext: () => void
}

export function StartStep({ start, today, onNext }: StartStepProps) {
  return (
    <>
      <StepTitle>When do you start?</StepTitle>
      <p className="mt-2 text-ink-muted">Day 1 is the first day you log.</p>
      <div className="mt-4 w-full">
        <StartDateChoice state={start} today={today} />
      </div>
      {start.dateError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {start.dateError}
        </p>
      )}
      <Button className="mt-6 w-full" onClick={onNext} disabled={start.dateError !== null}>
        Continue
      </Button>
    </>
  )
}

interface ReadyStepProps {
  mode: OnboardingMode
  name: string
  why: string
  variant: ChallengeVariant
  startDate: string
  today: string
  /** The start step's error when the chosen date can't be used any more (new mode only). */
  dateError: string | null
  busy: boolean
  error: string | null
  onFinish: () => void
}

export function ReadyStep({ mode, name, why, variant, startDate, today, dateError, busy, error, onFinish }: ReadyStepProps) {
  const alert = dateError ?? error
  return (
    <>
      <StepTitle>{mode === 'new' ? `Deal, ${cleanText(name)}.` : `Welcome back, ${cleanText(name)}.`}</StepTitle>
      <p className="mt-3 text-ink-muted">
        {mode === 'new'
          ? `${VARIANT_NAMES[variant]} starts ${startsWhen(startDate, today)}.`
          : 'Your challenge is right where you left it.'}
      </p>
      <p className="mt-4 font-rounded italic text-ink">“{cleanText(why)}”</p>
      <p className="mt-4 font-rounded font-bold text-ink">I'm watching.</p>
      {alert && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {alert}
        </p>
      )}
      <Button className="mt-6 w-full" onClick={onFinish} disabled={busy || dateError !== null}>
        {busy ? 'Starting…' : "Let's go"}
      </Button>
    </>
  )
}
```

Create `src/screens/Onboarding/OnboardingFlow.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Mascot, type DuckMood } from '../../components/mascot/Mascot'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useStartDateChoice } from '../../hooks/useStartDateChoice'
import { onboardingSteps, type OnboardingMode, type OnboardingStep } from '../../logic/onboarding'
import type { ChallengeVariant } from '../../logic/rulesets'
import { ChallengeStep, NameStep, ReadyStep, StartStep, WelcomeStep, WhyStep } from './OnboardingSteps'

interface OnboardingFlowProps {
  mode: OnboardingMode
  today: string
}

const STEP_MOODS: Record<OnboardingStep, DuckMood> = {
  welcome: 'content',
  name: 'watching',
  challenge: 'tapping',
  why: 'judging',
  start: 'waiting',
  ready: 'triumphant',
}

/**
 * The welcome flow: one question per screen, shown until the player has a
 * profile. A new player also picks the challenge and its start, and "Let's
 * go" creates attempt #1 with the profile (profileRepo.completeOnboarding).
 */
export function OnboardingFlow({ mode, today }: OnboardingFlowProps) {
  const steps = onboardingSteps(mode)
  const [index, setIndex] = useState(0)
  const [name, setName] = useState('')
  const [variant, setVariant] = useState<ChallengeVariant>('hard')
  const [why, setWhy] = useState('')
  const start = useStartDateChoice(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = steps[index]
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1))
  const back = () => setIndex((i) => Math.max(i - 1, 0))

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await profileRepo.completeOnboarding(
        { name, why },
        mode === 'new' ? { startDate: start.startDate, variant } : undefined,
      )
      // On success the profile appears, and the app takes over from this flow.
      if (!result.ok) {
        setError("Couldn't save that — try again.")
        setBusy(false)
      }
    } catch {
      setError("Couldn't save that — try again.")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <TopBar index={index} total={steps.length} onBack={back} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col items-center pt-6 text-center"
        >
          <Mascot mood={STEP_MOODS[step]} size={96} />
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'name' && <NameStep name={name} onChange={setName} onNext={next} />}
          {step === 'challenge' && <ChallengeStep variant={variant} onChange={setVariant} onNext={next} />}
          {step === 'why' && <WhyStep why={why} onChange={setWhy} onNext={next} />}
          {step === 'start' && <StartStep start={start} today={today} onNext={next} />}
          {step === 'ready' && (
            <ReadyStep
              mode={mode}
              name={name}
              why={why}
              variant={variant}
              startDate={start.startDate}
              today={today}
              dateError={mode === 'new' ? start.dateError : null}
              busy={busy}
              error={error}
              onFinish={() => void finish()}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Back (from the second screen on) and how far along the flow is. */
function TopBar({ index, total, onBack }: { index: number; total: number; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {index > 0 ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-3 min-h-touch min-w-touch rounded-2xl font-rounded text-3xl font-extrabold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          ‹
        </button>
      ) : (
        <span aria-hidden="true" className="-ml-3 min-h-touch min-w-touch" />
      )}
      <div
        role="progressbar"
        aria-label="Welcome progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-valuetext={`Step ${index + 1} of ${total}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full rounded-full bg-green motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the new tests to see them pass**

Run the Step 2 command. Expected: all pass, with no `act()` warnings in the output.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/content/onboarding.ts src/screens/Onboarding/OnboardingFlow.tsx src/screens/Onboarding/OnboardingSteps.tsx src/content/__tests__/onboarding.test.ts src/screens/Onboarding/__tests__/OnboardingFlow.test.tsx
git commit -m "feat: the welcome flow — name, challenge, reason and start, one screen at a time" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gate the app behind the welcome flow

**Files:**
- Create: `src/hooks/useProfile.ts`, `src/screens/Onboarding/OnboardingGate.tsx`, `src/screens/Onboarding/__tests__/OnboardingGate.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `profileRepo.get` and `profileRepo.completeOnboarding`;
  - from Task 3: `OnboardingFlow({ mode, today })`.
- Produces (Tasks 5 and 6 rely on these):
  - `ProfileContext` (`createContext<Profile | undefined>`) and `useProfile(): Profile | undefined`, both in `src/hooks/useProfile.ts`;
  - `<OnboardingGate today loading>{children}</OnboardingGate>`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Onboarding/__tests__/OnboardingGate.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { useProfile } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { OnboardingGate } from '../OnboardingGate'

const today = todayISO()

/** Stands in for the main app, showing the profile it's given. */
function MainAppProbe() {
  const profile = useProfile()
  return <p>Main app for {profile?.name}</p>
}

function renderGate() {
  render(
    <OnboardingGate today={today} loading={<p>Loading…</p>}>
      <MainAppProbe />
    </OnboardingGate>,
  )
}

/** Past the welcome and name steps; the step that follows tells the two modes apart. */
async function passWelcomeAndName() {
  fireEvent.click(await screen.findByRole('button', { name: 'Get started' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Your name' }), { target: { value: 'Daniel' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('OnboardingGate', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('welcomes a new player, who picks a challenge next', async () => {
    renderGate()
    await passWelcomeAndName()

    expect(await screen.findByRole('heading', { name: 'Pick your challenge' })).toBeInTheDocument()
    expect(screen.queryByText(/Main app/)).not.toBeInTheDocument()
  })

  it('welcomes a returning player, who goes straight to the reason', async () => {
    await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    renderGate()
    await passWelcomeAndName()

    expect(await screen.findByRole('heading', { name: 'Why are you doing this?' })).toBeInTheDocument()
  })

  it('opens the app, with the profile provided, once the player has one', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    renderGate()

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
  })

  it('swaps to the app as soon as the flow is finished', async () => {
    renderGate()
    await passWelcomeAndName()
    // Each step's heading is awaited first: until then, the previous step may still be leaving.
    await screen.findByRole('heading', { name: 'Pick your challenge' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // 75 Hard
    await screen.findByRole('heading', { name: 'Why are you doing this?' })
    fireEvent.click(screen.getByRole('button', { name: 'A fresh start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'When do you start?' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // today
    await screen.findByRole('heading', { name: 'Deal, Daniel.' })
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Onboarding/__tests__/OnboardingGate.test.tsx`

Expected: `../OnboardingGate` and `../../../hooks/useProfile` can't be resolved.

- [ ] **Step 3: Implement**

Create `src/hooks/useProfile.ts`:

```ts
import { createContext, useContext } from 'react'
import type { Profile } from '../logic/profile'

/** The player's profile, provided around the main app once the welcome flow is done (see OnboardingGate). */
export const ProfileContext = createContext<Profile | undefined>(undefined)

/** The player's profile, or undefined where none is provided (a screen's own tests). */
export function useProfile(): Profile | undefined {
  return useContext(ProfileContext)
}
```

Create `src/screens/Onboarding/OnboardingGate.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, type ReactNode } from 'react'
import { db } from '../../db/db'
import { profileRepo } from '../../db/repositories/profileRepo'
import { ProfileContext } from '../../hooks/useProfile'

// Only shown once per install, so it loads on demand; the service worker precaches the chunk.
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })))

interface OnboardingGateProps {
  today: string
  /** Shown while the profile loads, and while the flow's code does. */
  loading: ReactNode
  children: ReactNode
}

/**
 * Shows the welcome flow until the player has a profile, then the app with
 * the profile provided. The flow is for a new player when there are no
 * attempts at all, and for a returning one (name and reason only) otherwise.
 */
export function OnboardingGate({ today, loading, children }: OnboardingGateProps) {
  const state = useLiveQuery(
    async () => ({ profile: await profileRepo.get(), hasAttempts: (await db.challenges.count()) > 0 }),
    [],
  )

  if (!state) return loading
  if (!state.profile) {
    return (
      <Suspense fallback={loading}>
        <OnboardingFlow mode={state.hasAttempts ? 'returning' : 'new'} today={today} />
      </Suspense>
    )
  }
  return <ProfileContext.Provider value={state.profile}>{children}</ProfileContext.Provider>
}
```

In `src/App.tsx`:
- add `import { OnboardingGate } from './screens/Onboarding/OnboardingGate'`;
- turn today's `App` into `MainApp`, with `today` as a prop (it no longer calls `useApplyTheme` or `useToday`);
- add the new `App` above it:

```tsx
function App() {
  useApplyTheme()
  const today = useToday()

  return (
    <OnboardingGate today={today} loading={<LoadingScreen />}>
      <MainApp today={today} />
    </OnboardingGate>
  )
}

/** The app once the player has a profile: the challenge gate, the screens and the bottom nav. */
function MainApp({ today }: { today: string }) {
  const [screen, setScreen] = useState<ScreenId>('today')
  const gate = useChallengeGate(today)
  // …the rest of the former App body, unchanged…
}
```

`export default App` stays at the end of the file.

- [ ] **Step 4: Run the new test to see it pass**

Run the Step 2 command. Expected: all pass.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0. The build now emits an `OnboardingFlow` chunk.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useProfile.ts src/screens/Onboarding/OnboardingGate.tsx src/screens/Onboarding/__tests__/OnboardingGate.test.tsx src/App.tsx
git commit -m "feat: show the welcome flow until the player has a profile, then provide it to the app" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The name and the reason in the app

**Files:**
- Create: `src/components/ProfileLines.tsx`
- Modify:
  - `src/db/__tests__/fixtures.ts` (adds `TEST_PROFILE`);
  - `src/content/microcopy.ts`;
  - `src/screens/Today/DuckHeader.tsx`, `src/screens/Today/TodayScreen.tsx` and `src/screens/Today/PreStartView.tsx`;
  - `src/screens/RestartFlow/DayFailedScreen.tsx`, `src/screens/RestartFlow/JokerUsedScreen.tsx` and `src/screens/RestartFlow/GaveUpScreen.tsx`;
  - `src/screens/Settings/GiveUpFlow.tsx`.
- Tests: `src/content/__tests__/microcopy.test.ts`, `src/screens/Today/__tests__/DuckHeader.test.tsx`, `src/screens/Today/__tests__/TodayScreen.test.tsx`, `src/screens/Today/__tests__/PreStartView.test.tsx`, `src/screens/RestartFlow/__tests__/DayFailedScreen.test.tsx`, `src/screens/RestartFlow/__tests__/JokerUsedScreen.test.tsx`, `src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx`, `src/screens/Settings/__tests__/GiveUpFlow.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 4: `ProfileContext` and `useProfile()`;
  - from Task 1: `Profile`.
- Produces:
  - `Greeting`, `WhyQuote` and `YouSaid` (each takes an optional `className`, and renders nothing without a profile);
  - `duckLine({ …, name?: string })`;
  - `DuckHeader`'s new prop `name?: string`;
  - `TEST_PROFILE` in `src/db/__tests__/fixtures.ts`.

- [ ] **Step 1: Write the failing tests**

In `src/db/__tests__/fixtures.ts`, add `import type { Profile } from '../../logic/profile'` and this export:

```ts
/** A finished welcome flow, for tests that render screens with a profile. */
export const TEST_PROFILE: Profile = { name: 'Daniel', why: 'A fresh start', onboardedAt: '2026-09-28T08:00:00.000Z' }
```

In `src/content/__tests__/microcopy.test.ts`, inside `describe('duckLine', …)`, add:

```ts
  it("starts an untouched day with the player's name, when known", () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1, name: 'Daniel' })).toBe(
      "New day, Daniel. I'm watching.",
    )
  })
```

In `src/screens/Today/__tests__/DuckHeader.test.tsx`, inside `describe('DuckHeader', …)`, add:

```ts
  it("says the player's name when the day starts", () => {
    render(
      <DuckHeader
        menace={{ level: 'watching', reason: 'plenty' }}
        missing={[...TASK_IDS]}
        completion={completionOf([...TASK_IDS])}
        dayNumber={3}
        name="Daniel"
        onLunge={vi.fn()}
      />,
    )
    expect(screen.getByText("New day, Daniel. I'm watching.")).toBeInTheDocument()
  })
```

In `src/screens/Today/__tests__/TodayScreen.test.tsx`:
- add the imports `import { TEST_PROFILE } from '../../../db/__tests__/fixtures'` (merge it into the existing fixtures import), `import { ProfileContext } from '../../../hooks/useProfile'` and `import type { Profile } from '../../../logic/profile'`;
- give `setup` an optional `profile?: Profile` in its options object, and wrap the render in `<ProfileContext.Provider value={profile}>…</ProfileContext.Provider>`;
- add these tests:

```ts
  it('greets the player by name and keeps their reason in view', async () => {
    await setup({ todayDayNumber: 3, profile: TEST_PROFILE })

    expect(await screen.findByText('Hey Daniel')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
  })

  it('shows no greeting or reason without a profile', async () => {
    await setup({ todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard · Attempt #1')).toBeInTheDocument()
    expect(screen.queryByText(/^Hey /)).not.toBeInTheDocument()
    expect(screen.queryByText('“A fresh start”')).not.toBeInTheDocument()
  })
```

In `src/screens/Today/__tests__/PreStartView.test.tsx`:
- add the imports `TEST_PROFILE` (merged into the fixtures import) and `ProfileContext`;
- add:

```ts
  it('greets the player by name and quotes their reason before Day 1 too', async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: addDaysISO(today, 3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge

    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <PreStartView challenge={challenge} todayDayNumber={-2} today={today} />
      </ProfileContext.Provider>,
    )

    expect(screen.getByText('Hey Daniel')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
  })
```

In `src/screens/RestartFlow/__tests__/DayFailedScreen.test.tsx`:
- add the imports `TEST_PROFILE` and `ProfileContext`;
- in the existing test, after its focus assertion, add:

```ts
    expect(screen.getByText("Again. From Day 1. I'm watching.")).toBeInTheDocument()
    expect(screen.queryByText(/You said/)).not.toBeInTheDocument()
```

- then add:

```ts
  it("calls the player by name and quotes their reason back", async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <DayFailedScreen challenge={challenge} failedDayNumber={1} today={today} />
      </ProfileContext.Provider>,
    )
    // Let the missed-task list load, so nothing updates after the test.
    await screen.findAllByRole('listitem')

    expect(screen.getByText("Again, Daniel. From Day 1. I'm watching.")).toBeInTheDocument()
    expect(screen.getByText('You said: “A fresh start”')).toBeInTheDocument()
  })
```

In `src/screens/RestartFlow/__tests__/JokerUsedScreen.test.tsx`:
- add the imports `TEST_PROFILE` and `ProfileContext`;
- add:

```ts
  it('quotes the reason back when a joker is spent', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'medium' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <JokerUsedScreen challenge={challenge} newlyMissed={[3]} missedCount={1} jokersLeft={0} />
      </ProfileContext.Provider>,
    )
    await screen.findAllByRole('listitem')

    expect(screen.getByText('You said: “A fresh start”')).toBeInTheDocument()
  })
```

In `src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx`:
- add the imports `TEST_PROFILE` and `ProfileContext`;
- add:

```ts
  it('calls the player by name', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -11),
      attemptNumber: 1,
      status: 'abandoned',
      variant: 'hard',
      abandonedOn: today,
    })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <GaveUpScreen challenge={challenge} today={today} />
      </ProfileContext.Provider>,
    )

    expect(screen.getByText("Fine, Daniel. Pick something. I'm still watching.")).toBeInTheDocument()
  })
```

In `src/screens/Settings/__tests__/GiveUpFlow.test.tsx`:
- add the imports `TEST_PROFILE` and `ProfileContext`;
- add:

```ts
  it('quotes the reason back on step 2', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -11),
      attemptNumber: 1,
      status: 'active',
      variant: 'hard',
    })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <GiveUpFlow open onClose={vi.fn()} challenge={challenge} today={today} todayDayNumber={12} streak={11} />
      </ProfileContext.Provider>,
    )
    click('Give up')

    expect(screen.getByText('You said: “A fresh start”')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/content/__tests__/microcopy.test.ts src/screens/Today src/screens/RestartFlow src/screens/Settings/__tests__/GiveUpFlow.test.tsx`

Expected: the new tests fail. There is no greeting, reason or "You said" line yet, and the duck lines don't use the name.

- [ ] **Step 3: Implement**

Create `src/components/ProfileLines.tsx`:

```tsx
import { useProfile } from '../hooks/useProfile'

interface LineProps {
  className?: string
}

/** "Hey {name}": the first line of Today's header. Nothing without a profile. */
export function Greeting({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`font-rounded text-sm font-extrabold text-ink ${className}`}>Hey {profile.name}</p>
}

/** The player's reason, quoted: a discreet daily reminder on Today. Nothing without a profile. */
export function WhyQuote({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`line-clamp-2 font-rounded text-sm italic text-ink-muted ${className}`}>“{profile.why}”</p>
}

/** "You said: “…”": the reason, quoted back at a hard moment. Nothing without a profile. */
export function YouSaid({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`font-rounded text-sm italic text-ink-muted ${className}`}>You said: “{profile.why}”</p>
}
```

`src/content/microcopy.ts`: give `watchingLine` and `duckLine` an optional name.

```ts
function watchingLine(missing: readonly TaskId[], name?: string): string {
  const done = TASK_IDS.length - missing.length
  if (missing.length === 1) return ONE_LEFT_LINES[missing[0]]
  if (done === 0) return name ? `New day, ${name}. I'm watching.` : "New day. I'm watching."
  return `${done} down, ${missing.length} to go. I'm watching.`
}

/** The duck's speech bubble on Today, from his menace and the tasks still missing; the player's name starts the day. */
export function duckLine({
  menace,
  missing,
  dayNumber,
  name,
}: {
  menace: Menace
  missing: readonly TaskId[]
  dayNumber: number
  name?: string
}): string {
```

Inside `duckLine`, the three `watchingLine(missing)` calls become `watchingLine(missing, name)`. Nothing else changes.

`src/screens/Today/DuckHeader.tsx`:
- add `name?: string` to `DuckHeaderProps`, with the doc comment `/** The player's name, for the line that starts the day. */`;
- add `name` to the destructured props;
- change the line computation to `duckLine({ menace, missing, dayNumber, name })`.

`src/screens/Today/TodayScreen.tsx`:
- add the imports `import { Greeting, WhyQuote } from '../../components/ProfileLines'` and `import { useProfile } from '../../hooks/useProfile'`;
- in `TodayTasks`, add `const profile = useProfile()` next to the other hooks;
- in the header's left column, add `<Greeting />` as the first child, above the `{VARIANT_NAMES[rules.variant]} · Attempt #…` line;
- right after `</header>`, add `<WhyQuote className="px-4 pb-3" />`;
- pass `name={profile?.name}` to `<DuckHeader …>`.

`src/screens/Today/PreStartView.tsx`:
- import `Greeting` and `WhyQuote` from `'../../components/ProfileLines'`;
- right after the `<Mascot … />`, render `<Greeting />`;
- right after the `{VARIANT_NAMES[rules.variant]} · Attempt #…` line, render `<WhyQuote className="max-w-xs" />`.

`src/screens/RestartFlow/DayFailedScreen.tsx`:
- import `YouSaid` from `'../../components/ProfileLines'` and `useProfile` from `'../../hooks/useProfile'`;
- add `const profile = useProfile()` at the top of the component;
- render `<YouSaid className="max-w-xs" />` right after the explanation paragraph;
- replace the duck line paragraph's text with:

```tsx
      <p className="mt-2 font-rounded font-bold text-ink">
        {profile ? `Again, ${profile.name}. From Day 1. I'm watching.` : "Again. From Day 1. I'm watching."}
      </p>
```

`src/screens/RestartFlow/JokerUsedScreen.tsx`:
- import `YouSaid`;
- render `<YouSaid className="max-w-xs" />` right after the "Your streak starts over. Your challenge doesn't." paragraph.

`src/screens/RestartFlow/GaveUpScreen.tsx`:
- import `useProfile`, and add `const profile = useProfile()`;
- replace the duck line paragraph's text with:

```tsx
      <p className="mt-2 font-rounded font-bold text-ink">
        {profile ? `Fine, ${profile.name}. Pick something. I'm still watching.` : "Fine. Pick something. I'm still watching."}
      </p>
```

`src/screens/Settings/GiveUpFlow.tsx`:
- import `YouSaid` from `'../../components/ProfileLines'`;
- at step 2, render `<YouSaid className="mt-3" />` between the tally paragraph and `perfectDaysLine`'s paragraph.

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 command. Expected: every test passes, and the existing tests are unchanged.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileLines.tsx src/db/__tests__/fixtures.ts src/content/microcopy.ts src/screens/Today/DuckHeader.tsx src/screens/Today/TodayScreen.tsx src/screens/Today/PreStartView.tsx src/screens/RestartFlow/DayFailedScreen.tsx src/screens/RestartFlow/JokerUsedScreen.tsx src/screens/RestartFlow/GaveUpScreen.tsx src/screens/Settings/GiveUpFlow.tsx src/content/__tests__/microcopy.test.ts src/screens/Today/__tests__/DuckHeader.test.tsx src/screens/Today/__tests__/TodayScreen.test.tsx src/screens/Today/__tests__/PreStartView.test.tsx src/screens/RestartFlow/__tests__/DayFailedScreen.test.tsx src/screens/RestartFlow/__tests__/JokerUsedScreen.test.tsx src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx src/screens/Settings/__tests__/GiveUpFlow.test.tsx
git commit -m "feat: greet the player by name, keep their reason in view, and quote it back when it gets hard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Settings → Profile, and the README

**Files:**
- Create: `src/screens/Settings/ProfileSection.tsx`, `src/screens/Settings/__tests__/ProfileSection.test.tsx`
- Modify: `src/screens/Settings/SettingsScreen.tsx`, `README.md`

**Interfaces:**
- Consumes:
  - from Task 1: `profileRepo.save`, `profileRepo.completeOnboarding`, `cleanText`, `isValidName`, `isValidWhy`, `NAME_MAX_LENGTH`, `WHY_MAX_LENGTH` and `Profile`;
  - from Task 4: `useProfile` and `ProfileContext`;
  - from Task 5: `TEST_PROFILE`.
- Produces: `<ProfileSection />`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Settings/__tests__/ProfileSection.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { ProfileContext } from '../../../hooks/useProfile'
import { ProfileSection } from '../ProfileSection'

/** A stored profile, with the section rendered inside the context the app provides. */
async function setup() {
  await profileRepo.completeOnboarding({ name: TEST_PROFILE.name, why: TEST_PROFILE.why })
  render(
    <ProfileContext.Provider value={await profileRepo.get()}>
      <ProfileSection />
    </ProfileContext.Provider>,
  )
}

describe('ProfileSection', () => {
  beforeEach(freshDatabase)

  it('shows the name and the reason, ready to edit', async () => {
    await setup()

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Daniel')
    expect(screen.getByLabelText("Why you're doing this")).toHaveValue('A fresh start')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves a new name and reason', async () => {
    await setup()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dan' } })
    fireEvent.change(screen.getByLabelText("Why you're doing this"), { target: { value: 'Clear my head' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(await profileRepo.get()).toMatchObject({ name: 'Dan', why: 'Clear my head' })
  })

  it('refuses an empty name', async () => {
    await setup()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('renders nothing without a profile', () => {
    const { container } = render(<ProfileSection />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Settings/__tests__/ProfileSection.test.tsx`

Expected: `../ProfileSection` can't be resolved.

- [ ] **Step 3: Implement**

Create `src/screens/Settings/ProfileSection.tsx`:

```tsx
import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useProfile } from '../../hooks/useProfile'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH, type Profile } from '../../logic/profile'

/** Settings → Profile: the name the duck uses and the reason he quotes back. */
export function ProfileSection() {
  const profile = useProfile()
  return profile ? <ProfileForm profile={profile} /> : null
}

function ProfileForm({ profile }: { profile: Profile }) {
  const nameId = useId()
  const whyId = useId()
  const [name, setName] = useState(profile.name)
  const [why, setWhy] = useState(profile.why)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const changed = cleanText(name) !== profile.name || cleanText(why) !== profile.why
  const valid = isValidName(name) && isValidWhy(why)

  const save = async () => {
    setSaving(true)
    try {
      const result = await profileRepo.save({ name, why })
      setStatus(result.ok ? 'Saved.' : "Couldn't save that — try again.")
    } catch {
      setStatus("Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Profile</h2>

      <label htmlFor={nameId} className="mt-3 block font-rounded text-sm font-bold text-ink">
        Name
      </label>
      <input
        id={nameId}
        type="text"
        value={name}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        onChange={(e) => {
          setName(e.target.value)
          setStatus(null)
        }}
        className="mt-1 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
      />
      <p className="mt-1 text-xs text-ink-muted">Up to {NAME_MAX_LENGTH} characters.</p>

      <label htmlFor={whyId} className="mt-3 block font-rounded text-sm font-bold text-ink">
        Why you're doing this
      </label>
      <textarea
        id={whyId}
        rows={2}
        value={why}
        maxLength={WHY_MAX_LENGTH}
        onChange={(e) => {
          setWhy(e.target.value)
          setStatus(null)
        }}
        className="mt-1 w-full resize-none rounded-xl bg-canvas p-3 font-rounded font-bold text-ink"
      />

      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => void save()}
        disabled={saving || !changed || !valid}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {status && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink-muted">
          {status}
        </p>
      )}
    </section>
  )
}
```

`src/screens/Settings/SettingsScreen.tsx`:
- add `import { ProfileSection } from './ProfileSection'`;
- render `<ProfileSection />` as the first child of `<main>`, above the Challenge section.

`README.md`, under "Features":
- add this bullet first:

```md
- **Welcome** — on first launch, one question per screen: your name, your challenge, why you're doing it, and when you start. The duck then greets you by name on Today, keeps your reason in view, and quotes it back when it gets hard (a missed day, a joker, giving up). Settings → Profile edits both.
```

- in the **Settings** bullet, insert "Profile (your name and your reason), " right after "— ".

- [ ] **Step 4: Run the test to see it pass**

Run the Step 2 command. Expected: all pass. Also run `npx vitest run src/screens/Settings` to confirm that the SettingsScreen tests still pass.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Settings/ProfileSection.tsx src/screens/Settings/__tests__/ProfileSection.test.tsx src/screens/Settings/SettingsScreen.tsx README.md
git commit -m "feat: edit your name and your reason in Settings → Profile" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
