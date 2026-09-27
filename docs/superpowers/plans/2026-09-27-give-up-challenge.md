# Giving Up a Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player give up the running attempt from Settings, behind four confirmations, then start the next challenge from a "You gave up" screen.

**Architecture:**
- Only `challengeRepo.giveUp` writes the new `'abandoned'` status and its `abandonedOn` date.
- The gate turns that status into a new `abandoned` kind. App renders it as a full-screen `GaveUpScreen`, which reuses Victory's `NewChallengeSheet`.
- The four-step `GiveUpFlow` modal opens from Settings → Danger zone.

**Tech Stack:** React 19, TypeScript 6, Dexie 4 with dexie-react-hooks, framer-motion, Tailwind 4, Vitest with Testing Library and fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-27-give-up-challenge-design.md`

## Global Constraints

- **Copy:** the UI copy is English and uses the spec's strings exactly (§7).
- **Target:** an iPhone Safari PWA, so touch only: nothing that depends on hover, and no vibration.
- **Data:**
  - No Dexie version bump.
  - `challengeRepo.giveUp` writes exactly `{ status: 'abandoned', abandonedOn: today }`, and nothing is ever backfilled.
  - A challenge without `variant` is the owner's pre-variants 75 Hard attempt, and it must stay variant-less.
- **Gates:** every gate passes before each commit: `npx tsc -b`, `npm run lint`, `npm run test` and `npm run build`. The test run must exit with code 0: Vitest fails a run on any unhandled error, even when every test passes.
- **Tests:** they follow the existing patterns:
  - `freshDatabase` and `addChallenge` from `src/db/__tests__/fixtures.ts`;
  - `MotionGlobalConfig.skipAnimations = true` in UI tests;
  - the repository and import test files already run under `// @vitest-environment node`.
- **Style:**
  - Match the surrounding code's style, naming and comment density.
  - `react/only-export-components` is on, so component files export only components.
- **Commits:** every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Untracked folders:** leave `animations/` and `inspo/` alone.

---

### Task 1: The engine — the abandoned status, `giveUp`, the gate and the summaries

**Files:**
- Modify: `src/db/types.ts`, `src/logic/types.ts`, `src/db/exportImport.ts`, `src/db/repositories/challengeRepo.ts`, `src/logic/restart.ts`, `src/hooks/useChallengeGate.ts`, `src/hooks/useBadgeUnlocks.ts`, `src/logic/attempts.ts`, `src/hooks/useAttemptSummaries.ts`, `src/screens/Settings/AttemptHistorySection.tsx` (one style line)
- Test: `src/logic/__tests__/restart.test.ts`, `src/hooks/__tests__/useChallengeGate.test.ts`, `src/logic/__tests__/attempts.test.ts`, `src/db/__tests__/repositories.test.ts`, `src/db/__tests__/exportImport.test.ts`
- Create test: `src/hooks/__tests__/useBadgeUnlocks.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ChallengeStatus` (in both `src/db/types.ts` and `src/logic/types.ts`) = `'active' | 'failed' | 'completed' | 'abandoned'`
  - `Challenge.abandonedOn?: string`
  - `challengeRepo.giveUp(id: number, today: string): Promise<GiveUpResult>`, with `export type GiveUpResult = { ok: true } | { ok: false; reason: 'locked' }`
  - `GateKind` gains `'abandoned'`, and `ChallengeGate` gains `GateBase & { kind: 'abandoned' }`
  - `givenUpDay(startDate: string, abandonedOn: string | undefined): number | undefined`, exported from `src/logic/attempts.ts`
  - `summarizeAttempt` params gain `abandonedOn?: string`

- [ ] **Step 1: Write the failing tests**

In `src/logic/__tests__/restart.test.ts`, inside `describe('resolveChallengeGate', …)`, add this after the test `'is active before the challenge has started'`:

```ts
  it('reports a given-up attempt as abandoned, whatever its days say', () => {
    expect(
      resolveChallengeGate({ currentStatus: 'abandoned', dayEntries: completeDays(3), todayDayNumber: 9, jokers: 0 }),
    ).toEqual({ kind: 'abandoned', missed: [4, 5, 6, 7, 8] })
  })
```

In `src/hooks/__tests__/useChallengeGate.test.ts`, add these two tests at the end of `describe('resolveGate', …)`:

```ts
  it('is abandoned for a given-up attempt, even with a day missed beyond its jokers', () => {
    const gate = resolveGate(challenge({ status: 'abandoned', abandonedOn: today }), oneMissingDay, today)
    expect(gate.kind).toBe('abandoned')
  })

  it('never announces a joker on a given-up attempt', () => {
    const gate = resolveGate(
      challenge({ status: 'abandoned', variant: 'medium', abandonedOn: today }),
      oneMissingDay,
      today,
    )
    expect(gate.kind).toBe('abandoned')
  })
```

In `src/logic/__tests__/attempts.test.ts`:
- change the import to `import { attemptDayRows, givenUpDay, summarizeAttempt } from '../attempts'`;
- add these two tests at the end of `describe('summarizeAttempt', …)`;
- add the new `describe` block right after it.

```ts
  it('reaches the day a given-up attempt ended on, and ends that day', () => {
    const summary = summarizeAttempt({
      startDate: '2026-09-01',
      status: 'abandoned',
      abandonedOn: '2026-09-12',
      days: perfectDays(1, 11),
      todayDayNumber: 20,
      rules: RULESETS.hard,
    })
    expect(summary).toMatchObject({ reachedDay: 12, completedDays: 11, endDate: '2026-09-12' })
  })

  it('falls back to the last logged day when a given-up attempt has no give-up date', () => {
    const summary = summarizeAttempt({
      startDate: '2026-09-01',
      status: 'abandoned',
      days: [...perfectDays(1, 4), { dayNumber: 5, data: waterAndReadingOnly }],
      todayDayNumber: 20,
      rules: RULESETS.hard,
    })
    expect(summary).toMatchObject({ reachedDay: 5, completedDays: 4, endDate: '2026-09-05' })
  })
```

```ts
describe('givenUpDay', () => {
  it('turns the give-up date into its day number', () => {
    expect(givenUpDay('2026-09-01', '2026-09-12')).toBe(12)
  })

  it('is undefined without a date, with a broken one, or outside Days 1–75', () => {
    expect(givenUpDay('2026-09-01', undefined)).toBeUndefined()
    expect(givenUpDay('2026-09-01', 'not-a-date')).toBeUndefined()
    expect(givenUpDay('2026-09-01', '2026-08-31')).toBeUndefined()
    expect(givenUpDay('2026-09-01', '2026-11-15')).toBeUndefined() // Day 76
  })
})
```

In `src/db/__tests__/repositories.test.ts`, add this block right after `describe('starting attempts', …)`. `addPerfectDays`, `addDaysISO`, `CHALLENGE_LENGTH` and `today` are already imported or defined in that file.

```ts
describe('giving up', () => {
  it('changes only the status and the give-up date, leaving a pre-variants attempt variant-less', async () => {
    const startDate = addDaysISO(today, -11)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)
    const before = await db.challenges.get(challengeId)
    const entriesBefore = await db.dayEntries.where('challengeId').equals(challengeId).toArray()

    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: true })

    expect(await db.challenges.get(challengeId)).toEqual({ ...before, status: 'abandoned', abandonedOn: today })
    expect(await db.challenges.get(challengeId)).not.toHaveProperty('variant')
    expect(await db.dayEntries.where('challengeId').equals(challengeId).toArray()).toEqual(entriesBefore)
  })

  it('works from Day 1 to Day 75', async () => {
    const dayOne = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'soft' })
    expect(await challengeRepo.giveUp(dayOne, today)).toEqual({ ok: true })

    const lastDay = await addChallenge({
      startDate: addDaysISO(today, -(CHALLENGE_LENGTH - 1)),
      attemptNumber: 2,
      status: 'active',
    })
    expect(await challengeRepo.giveUp(lastDay, today)).toEqual({ ok: true })
  })

  it('is locked before Day 1 and after Day 75', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, 1), attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: false, reason: 'locked' })

    await db.challenges.update(challengeId, { startDate: addDaysISO(today, -CHALLENGE_LENGTH) }) // today is Day 76
    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('is locked on an attempt that is no longer active, or that does not exist', async () => {
    const completed = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'completed' })
    expect(await challengeRepo.giveUp(completed, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await db.challenges.get(completed))?.status).toBe('completed')
    expect(await challengeRepo.giveUp(completed + 1, today)).toEqual({ ok: false, reason: 'locked' })
  })

  it('stays the current attempt until startNew begins the next one, numbered after it', async () => {
    const givenUp = await addChallenge({ startDate: addDaysISO(today, -4), attemptNumber: 3, status: 'active' })
    await challengeRepo.giveUp(givenUp, today)
    expect(await challengeRepo.getCurrent()).toMatchObject({ id: givenUp, status: 'abandoned', abandonedOn: today })

    const nextId = await challengeRepo.startNew(addDaysISO(today, 1), 'medium')

    expect(await db.challenges.get(nextId)).toMatchObject({
      attemptNumber: 4,
      status: 'active',
      variant: 'medium',
      startDate: addDaysISO(today, 1),
    })
    expect((await challengeRepo.getCurrent())?.id).toBe(nextId)
  })
})
```

In `src/db/__tests__/exportImport.test.ts`, add this test right after `'keeps a challenge’s social days, its acknowledged jokers, and a day’s rest day through a backup'`:

```ts
  it('keeps a given-up attempt and its give-up date through a backup', async () => {
    await seedEverything()
    const [challenge] = await db.challenges.toArray()
    await db.challenges.update(challenge.id, { status: 'abandoned', abandonedOn: challenge.startDate })

    await roundTrip()

    expect(await db.challenges.get(challenge.id)).toMatchObject({
      status: 'abandoned',
      abandonedOn: challenge.startDate,
    })
  })
```

Then add this one right after `'rejects a negative count of acknowledged jokers'`:

```ts
  it('rejects a give-up date that is not a real date', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].abandonedOn = '2026-02-30'
    expect(validateExportPayload(payload).ok).toBe(false)
  })
```

Create `src/hooks/__tests__/useBadgeUnlocks.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Challenge } from '../../db/types'
import { addDaysISO, todayISO } from '../../lib/dates'
import { useBadgeUnlocks } from '../useBadgeUnlocks'
import type { ChallengeGate } from '../useChallengeGate'

// Stands in for the badge data load, so the test sees whether an attempt gets evaluated at all.
const { loadBadgeEvaluation } = vi.hoisted(() => ({ loadBadgeEvaluation: vi.fn() }))
vi.mock('../../db/badgeEvaluation', () => ({ loadBadgeEvaluation }))

/** A gate on Day 12 of an attempt that is running, or was given up today. */
function gate(kind: 'active' | 'abandoned'): ChallengeGate {
  const today = todayISO()
  const challenge: Challenge = { id: 1, startDate: addDaysISO(today, -11), attemptNumber: 1, status: 'active' }
  const base = { dayEntries: [], today, todayDayNumber: 12, streak: 11, missedDays: [], jokersLeft: 0 }
  return kind === 'active'
    ? { ...base, kind, challenge }
    : { ...base, kind, challenge: { ...challenge, status: 'abandoned', abandonedOn: today } }
}

describe('useBadgeUnlocks', () => {
  beforeEach(() => {
    loadBadgeEvaluation.mockReset()
    loadBadgeEvaluation.mockResolvedValue(undefined)
  })

  it("evaluates the running attempt's badges", async () => {
    renderHook(() => useBadgeUnlocks(gate('active')))
    await waitFor(() => expect(loadBadgeEvaluation).toHaveBeenCalled())
  })

  it('never evaluates a given-up attempt, whose day number keeps growing after it ended', async () => {
    renderHook(() => useBadgeUnlocks(gate('abandoned')))
    // Give the live query time to run, if it's going to.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(loadBadgeEvaluation).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/logic/__tests__/restart.test.ts src/hooks/__tests__/useChallengeGate.test.ts src/logic/__tests__/attempts.test.ts src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts src/hooks/__tests__/useBadgeUnlocks.test.ts`

Expected failures:
- the abandoned gate tests get `needsRestart` or `jokerUsed`;
- `givenUpDay` and `challengeRepo.giveUp` are not functions;
- the backup round trip fails validation on `'abandoned'`;
- the badge hook evaluates the given-up attempt.

- [ ] **Step 3: Implement**

`src/db/types.ts`: replace the status type:

```ts
export type ChallengeStatus = 'active' | 'failed' | 'completed' | 'abandoned'
```

Then add this as the last field of `Challenge`, after `jokersAcknowledged`:

```ts
  /** The local ISO date the attempt was given up on (status 'abandoned'). Set only by challengeRepo.giveUp. */
  abandonedOn?: string
```

`src/logic/types.ts`, line 32: replace it with the same union:

```ts
export type ChallengeStatus = 'active' | 'failed' | 'completed' | 'abandoned'
```

`src/db/exportImport.ts`:
- change the first import to `import { isValidISODate, todayISO } from '../lib/dates'`;
- in `ROW_CHECKS.challenges`, replace the `status` line and add an `abandonedOn` line after `jokersAcknowledged`:

```ts
    status: (v) => v === 'active' || v === 'failed' || v === 'completed' || v === 'abandoned',
```

```ts
    abandonedOn: isOptional((v) => isString(v) && isValidISODate(v)),
```

`src/db/repositories/challengeRepo.ts`:
- add the import `import { isChallengeDay } from '../../logic/days'`;
- add the result type under `VariantChangeResult`:

```ts
export type GiveUpResult = { ok: true } | { ok: false; reason: 'locked' }
```

Reword two doc comments:

```ts
  /** The active challenge or, when none is active, the most recent attempt (completed, failed or given up). */
```

```ts
  /** Starts a fresh attempt after a completed or given-up one. Reuses the active attempt if one already exists. */
```

Then add this method right after `markCompleted`:

```ts
  /**
   * Gives up the active attempt for good (Settings → Danger zone, after four
   * confirmations). Only from Day 1 to Day 75: before Day 1 its challenge and
   * start date can still be changed instead. Only `status` and `abandonedOn`
   * change, so the attempt keeps its days, photos and badges, and an attempt
   * made before variants existed still gets no `variant`. The app then shows
   * the "You gave up" screen, which starts the next attempt with startNew.
   */
  async giveUp(id: number, today: string): Promise<GiveUpResult> {
    return db.transaction('rw', db.challenges, async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active') return { ok: false, reason: 'locked' } as const
      if (!isChallengeDay(dayNumberForDate(challenge.startDate, today))) return { ok: false, reason: 'locked' } as const
      await db.challenges.update(id, { status: 'abandoned', abandonedOn: today })
      return { ok: true } as const
    })
  },
```

`src/logic/restart.ts`: replace `GateKind`:

```ts
export type GateKind = 'active' | 'needsRestart' | 'completed' | 'abandoned'
```

Replace the doc comment of `resolveChallengeGate`:

```ts
/**
 * What the app should show for the current challenge: the normal screens
 * ('active', which includes the days before Day 1), the restart flow
 * ('needsRestart' — a day was missed beyond the ruleset's jokers, or the
 * attempt is already archived as failed), the victory screen
 * ('completed'), or the "You gave up" screen ('abandoned').
 */
```

In its body, add this line after the `'active'` line:

```ts
  if (evaluation.status === 'abandoned') return { kind: 'abandoned', missed: evaluation.missed }
```

`src/hooks/useChallengeGate.ts`: replace the `ChallengeGate` doc comment and type:

```ts
/**
 * What the app should show right now:
 * - `active`: the normal screens (including the countdown before Day 1);
 * - `needsRestart`: a miss beyond the ruleset's jokers, so the restart flow blocks the app;
 * - `jokerUsed`: a miss that a joker forgave, not yet announced;
 * - `completed`: all 75 days are done — the victory screen;
 * - `abandoned`: the attempt was given up — the "You gave up" screen, until the next one starts.
 */
export type ChallengeGate =
  | (GateBase & { kind: 'active' })
  | (GateBase & { kind: 'needsRestart'; failedDayNumber: number })
  | (GateBase & { kind: 'jokerUsed'; newlyMissed: number[] })
  | (GateBase & { kind: 'completed' })
  | (GateBase & { kind: 'abandoned' })
```

`resolveGate` needs no change: its final `return { ...base, kind: resolution.kind }` now also covers `'abandoned'`, and the joker check only applies to `'active'`.

`src/hooks/useBadgeUnlocks.ts`: replace the line `const challenge = gate && gate.kind !== 'needsRestart' ? gate.challenge : undefined` with:

```ts
  // A failed or given-up attempt isn't evaluated: its day number keeps growing after it ended.
  const challenge = gate && gate.kind !== 'needsRestart' && gate.kind !== 'abandoned' ? gate.challenge : undefined
```

`src/logic/attempts.ts`:
- change the imports to `import { dateForDayNumber, dayNumberForDate } from '../lib/dates'`, and add `import { isChallengeDay } from './days'`;
- in `AttemptSummary`, reword the `reachedDay` doc comment:

```ts
  /**
   * How far the attempt got: the day it failed on, 75 once completed, the
   * day it was given up on, or today's day while it's running (0 before Day 1).
   */
```

Replace `summarizeAttempt`'s parameter type and its first three lines:

```ts
export function summarizeAttempt(params: {
  startDate: string
  status: ChallengeStatus
  /** When a given-up attempt ended (Challenge.abandonedOn). */
  abandonedOn?: string
  days: readonly ChallengeDayData[]
  todayDayNumber: number
  rules: Ruleset
}): AttemptSummary {
  const { startDate, status, abandonedOn, days, todayDayNumber, rules } = params
  const summaries = days.map((d) => ({ dayNumber: d.dayNumber, completed: isDayComplete(d.data, rules) }))
  const reachedDay = reachedDayOf(status, summaries, todayDayNumber, rules.jokers, givenUpDay(startDate, abandonedOn))
```

Replace `reachedDayOf` and add `givenUpDay` after it:

```ts
function reachedDayOf(
  status: ChallengeStatus,
  summaries: DayCompletionSummary[],
  todayDayNumber: number,
  jokers: number,
  givenUp: number | undefined,
): number {
  if (status === 'completed') return CHALLENGE_LENGTH
  if (status === 'active') {
    return Number.isFinite(todayDayNumber) ? Math.min(Math.max(todayDayNumber, 0), CHALLENGE_LENGTH) : 0
  }
  // Given up: that day, or the last logged day when its date is missing (a hand-edited backup).
  if (status === 'abandoned') return givenUp ?? summaries.reduce((last, s) => Math.max(last, s.dayNumber), 0)
  // Failed: the miss that used up the jokers, the first miss if there weren't that many, or Day 75 if none at all.
  const missed = missedDayNumbers(summaries, CHALLENGE_LENGTH + 1)
  return missed[jokers] ?? missed[0] ?? CHALLENGE_LENGTH
}

/**
 * The day an attempt was given up on: its `abandonedOn` date as a day
 * number, or undefined when that date is missing or isn't a challenge day.
 */
export function givenUpDay(startDate: string, abandonedOn: string | undefined): number | undefined {
  if (!abandonedOn) return undefined
  const day = dayNumberForDate(startDate, abandonedOn)
  return isChallengeDay(day) ? day : undefined
}
```

`src/hooks/useAttemptSummaries.ts`: in the `summarizeAttempt({ … })` call, add this line after `status: challenge.status,`:

```ts
        abandonedOn: challenge.abandonedOn,
```

`src/screens/Settings/AttemptHistorySection.tsx`: add the fourth status style, so `Record<ChallengeStatus, string>` stays complete:

```ts
const STATUS_STYLES: Record<ChallengeStatus, string> = {
  active: 'bg-green-light text-green-ink',
  completed: 'bg-yellow-light text-yellow-ink',
  failed: 'bg-danger/10 text-danger-ink',
  abandoned: 'bg-ink/10 text-ink',
}
```

- [ ] **Step 4: Run the new tests to see them pass**

Run the Step 2 command. Expected: every test passes.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/db/types.ts src/logic/types.ts src/db/exportImport.ts src/db/repositories/challengeRepo.ts src/logic/restart.ts src/hooks/useChallengeGate.ts src/hooks/useBadgeUnlocks.ts src/logic/attempts.ts src/hooks/useAttemptSummaries.ts src/screens/Settings/AttemptHistorySection.tsx src/logic/__tests__/restart.test.ts src/hooks/__tests__/useChallengeGate.test.ts src/logic/__tests__/attempts.test.ts src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts src/hooks/__tests__/useBadgeUnlocks.test.ts
git commit -m "feat: let an attempt be given up: the abandoned status, challengeRepo.giveUp and the gate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The "You gave up" screen, its route, the history's give-up day and the scenario

**Files:**
- Create: `src/screens/RestartFlow/GaveUpScreen.tsx`
- Modify: `src/App.tsx`, `src/screens/Settings/AttemptHistorySection.tsx`, `src/dev/scenarios.ts`, `README.md`
- Create tests: `src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx`, `src/screens/Settings/__tests__/AttemptHistorySection.test.tsx`

**Interfaces:**
- Consumes, from Task 1:
  - `ChallengeGate`'s `{ kind: 'abandoned' }`;
  - `givenUpDay(startDate, abandonedOn)` from `src/logic/attempts.ts`;
  - `Challenge.abandonedOn`, and the `'abandoned'` status.
- Also consumes, already existing:
  - `NewChallengeSheet({ open, onClose, defaultVariant, today })` from `src/screens/Victory/NewChallengeSheet.tsx`;
  - `VARIANT_NAMES` from `src/content/variants.ts`;
  - `variantOf` from `src/logic/rulesets.ts`.
- Produces:
  - `GaveUpScreen({ challenge, today })`;
  - the dev scenario `seedGaveUp()`.

- [ ] **Step 1: Write the failing tests**

Create `src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { GaveUpScreen } from '../GaveUpScreen'

const today = todayISO()

/** A 75 Medium attempt #2 that started 11 days ago and was given up (today, on Day 12, unless no date is given). */
async function setup(abandonedOn: string | undefined = today) {
  const challengeId = await addChallenge({
    startDate: addDaysISO(today, -11),
    attemptNumber: 2,
    status: 'abandoned',
    variant: 'medium',
    ...(abandonedOn ? { abandonedOn } : {}),
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<GaveUpScreen challenge={challenge} today={today} />)
}

describe('GaveUpScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('names the day, the challenge and the attempt', async () => {
    await setup()

    expect(screen.getByRole('heading', { name: 'You gave up on Day 12' })).toBeInTheDocument()
    expect(screen.getByText('75 Medium, attempt #2. It stays in your history.')).toBeInTheDocument()
    expect(screen.getByText("Fine. Pick something. I'm still watching.")).toBeInTheDocument()
  })

  it('says only "You gave up" when the give-up date is missing', async () => {
    await setup(undefined)

    expect(screen.getByRole('heading', { name: 'You gave up' })).toBeInTheDocument()
  })

  it('starts the next attempt from the sheet, with the same challenge picked by default', async () => {
    await setup()

    fireEvent.click(screen.getByRole('button', { name: 'Start a new challenge' }))
    expect(await screen.findByRole('heading', { name: 'Start a new challenge' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^75 Medium/ })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(async () =>
      expect(await db.challenges.where('status').equals('active').toArray()).toMatchObject([
        { attemptNumber: 3, variant: 'medium', startDate: today },
      ]),
    )
  })
})
```

Create `src/screens/Settings/__tests__/AttemptHistorySection.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { addDaysISO, formatDisplayDate, todayISO } from '../../../lib/dates'
import { AttemptHistorySection } from '../AttemptHistorySection'

describe('AttemptHistorySection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('lists a given-up attempt as abandoned, and marks the day it ended instead of calling it missed', async () => {
    const today = todayISO()
    // Given up today, on Day 3, with nothing logged: Days 1 and 2 were missed.
    await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'abandoned',
      variant: 'hard',
      abandonedOn: today,
    })
    render(<AttemptHistorySection today={today} />)

    const attempt = await screen.findByRole('button', { name: /Attempt #1 · Reached Day 3/ })
    expect(within(attempt).getByText('abandoned')).toBeInTheDocument()

    fireEvent.click(attempt)

    expect(await screen.findByText(`· ${formatDisplayDate(today)} · gave up`)).toBeInTheDocument()
    expect(screen.getAllByText(/· missed /)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx src/screens/Settings/__tests__/AttemptHistorySection.test.tsx`

Expected:
- `GaveUpScreen` can't be imported yet;
- the history test fails at "gave up", because Day 3 still reads "✗ … missed …", so three rows match `· missed ` instead of two.

- [ ] **Step 3: Implement**

Create `src/screens/RestartFlow/GaveUpScreen.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { VARIANT_NAMES } from '../../content/variants'
import type { Challenge } from '../../db/types'
import { givenUpDay } from '../../logic/attempts'
import { variantOf } from '../../logic/rulesets'
import { NewChallengeSheet } from '../Victory/NewChallengeSheet'

interface GaveUpScreenProps {
  challenge: Challenge
  today: string
}

/** Shown once the attempt was given up (Settings → Danger zone), until the next one starts. */
export function GaveUpScreen({ challenge, today }: GaveUpScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const day = givenUpDay(challenge.startDate, challenge.abandonedOn)
  const variant = variantOf(challenge)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot mood="judging" />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">
        {day === undefined ? 'You gave up' : `You gave up on Day ${day}`}
      </h1>
      <p className="max-w-xs font-rounded text-ink-muted">
        {VARIANT_NAMES[variant]}, attempt #{challenge.attemptNumber}. It stays in your history.
      </p>
      <p className="mt-2 font-rounded font-bold text-ink">Fine. Pick something. I'm still watching.</p>

      <Button variant="primary" className="mt-2" onClick={() => setSheetOpen(true)}>
        Start a new challenge
      </Button>
      <p className="max-w-xs font-rounded text-xs text-ink-muted">Pick your next challenge and when it starts.</p>

      <NewChallengeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultVariant={variant}
        today={today}
      />
    </div>
  )
}
```

`src/App.tsx`:
- add the lazy import after `JokerUsedScreen`'s:

```tsx
const GaveUpScreen = lazy(() => import('./screens/RestartFlow/GaveUpScreen').then((m) => ({ default: m.GaveUpScreen })))
```

- add this block right after the `if (gate.kind === 'jokerUsed') { … }` block:

```tsx
  if (gate.kind === 'abandoned') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <GaveUpScreen challenge={gate.challenge} today={today} />
      </Suspense>
    )
  }
```

`src/screens/Settings/AttemptHistorySection.tsx`: in `AttemptDetail`, pass a `givenUp` prop to `DayRow`, right after `inProgress`:

```tsx
                // The running attempt's current day isn't missed yet — it's in progress.
                inProgress={challenge.status === 'active' && row.kind === 'incomplete' && row.dayNumber === summary.reachedDay}
                // A given-up attempt's last day wasn't missed either: it's the day it ended.
                givenUp={challenge.status === 'abandoned' && row.kind === 'incomplete' && row.dayNumber === summary.reachedDay}
```

Change `DayRow`'s signature, then add the give-up branch right after the `if (row.kind === 'complete') { … }` block:

```tsx
function DayRow({
  row,
  startDate,
  inProgress,
  givenUp,
}: {
  row: AttemptDayRow
  startDate: string
  inProgress: boolean
  givenUp: boolean
}) {
```

```tsx
  if (givenUp) {
    return (
      <li className="flex gap-2 text-sm">
        <span aria-hidden="true">🏳️</span>
        <span>
          <span className="font-bold text-ink">Day {row.dayNumber}</span>
          <span className="text-ink-muted"> · {dateOf(row.dayNumber)} · gave up</span>
        </span>
      </li>
    )
  }
```

`src/dev/scenarios.ts`: add this at the end of the file:

```ts
/** A 75 Hard attempt with Days 1–11 perfect, given up today on Day 12: opens on the "You gave up" screen. */
export async function seedGaveUp(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= 11; day++) days.push(await perfectDay(day))

  await replaceDatabase([
    {
      challenge: {
        startDate: addDaysISO(todayISO(), -11),
        attemptNumber: 1,
        status: 'abandoned',
        variant: 'hard',
        abandonedOn: todayISO(),
      },
      days,
    },
  ])
}
```

`README.md`: in the "Dev scenarios" table, add this row after the `seedDay77Complete()` row:

```md
| `seedGaveUp()` | A 75 Hard attempt given up today on Day 12, after 11 perfect days: opens on the "You gave up" screen. |
```

- [ ] **Step 4: Run the new tests to see them pass**

Run the Step 2 command. Expected: all pass.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/screens/RestartFlow/GaveUpScreen.tsx src/App.tsx src/screens/Settings/AttemptHistorySection.tsx src/dev/scenarios.ts README.md src/screens/RestartFlow/__tests__/GaveUpScreen.test.tsx src/screens/Settings/__tests__/AttemptHistorySection.test.tsx
git commit -m "feat: show a \"You gave up\" screen that starts the next challenge, and mark the give-up day in the history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The four-step give-up flow in Settings

**Files:**
- Create: `src/screens/Settings/GiveUpFlow.tsx`
- Modify: `src/screens/Settings/SettingsScreen.tsx`, `src/App.tsx`, `README.md`
- Create tests: `src/screens/Settings/__tests__/GiveUpFlow.test.tsx`, `src/screens/Settings/__tests__/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `challengeRepo.giveUp(id, today)`, which returns `{ ok: true } | { ok: false; reason: 'locked' }` (Task 1);
  - `useChallengeStats(challengeId)`, which returns `{ xp, perfectDays, water_ml, pages, workoutMinutes }`;
  - `Modal`, `Button` and `Mascot` (its moods include `'judging'` and `'hunting'`, and its `size` prop defaults to 120);
  - `VARIANT_NAMES`, `variantOf`, `CHALLENGE_LENGTH`;
  - `isChallengeDay` from `src/logic/days.ts`.
- Produces:
  - `GiveUpFlow({ open, onClose, challenge, today, todayDayNumber, streak })`;
  - `SettingsScreen` props gain `streak: number` and `canGiveUp: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/screens/Settings/__tests__/GiveUpFlow.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { challengeRepo } from '../../../db/repositories/challengeRepo'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { GiveUpFlow } from '../GiveUpFlow'

// Step 2's numbers, without seeding a whole attempt's days.
const { stats } = vi.hoisted(() => ({ stats: { xp: 935, perfectDays: 11, water_ml: 0, pages: 0, workoutMinutes: 0 } }))
vi.mock('../../../hooks/useChallengeStats', () => ({ useChallengeStats: () => stats }))

const today = todayISO()

/** A 75 Hard attempt on `todayDayNumber`, with its 11-day streak and the flow open on step 1. */
async function setup(todayDayNumber = 12) {
  const challengeId = await addChallenge({
    startDate: addDaysISO(today, -(todayDayNumber - 1)),
    attemptNumber: 1,
    status: 'active',
    variant: 'hard',
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  const onClose = vi.fn()
  render(
    <GiveUpFlow
      open
      onClose={onClose}
      challenge={challenge}
      today={today}
      todayDayNumber={todayDayNumber}
      streak={11}
    />,
  )
  return { challengeId, onClose }
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

/** One second of step 3's lock, on the fake clock. */
const tick = () =>
  act(() => {
    vi.advanceTimersByTime(1000)
  })

/**
 * Steps 1 and 2, then step 3's five-second lock on a fake clock (only
 * setTimeout is faked, so IndexedDB keeps working), then on to step 4.
 */
function reachStepFour() {
  click('Give up')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  click("I'm sure")
  for (let second = 0; second < 5; second++) tick()
  vi.useRealTimers()
  click('Give up')
}

const typeConfirmation = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Type GIVE UP to confirm' }), { target: { value } })

describe('GiveUpFlow', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    Object.assign(stats, { xp: 935, perfectDays: 11 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens on what giving up means, and Keep going closes without giving up', async () => {
    const { challengeId, onClose } = await setup()

    expect(screen.getByRole('heading', { name: 'Give up 75 Hard?' })).toBeInTheDocument()
    expect(
      screen.getByText(
        "You're on Day 12 of 75. Giving up ends this attempt for good: you can't pick it back up. It stays in your history.",
      ),
    ).toBeInTheDocument()

    click('Keep going')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('shows what the attempt built on step 2, focusing its heading, and I’ll stay closes', async () => {
    const { onClose } = await setup()
    click('Give up')

    expect(screen.getByRole('heading', { name: 'Look at what you built.' })).toHaveFocus()
    expect(screen.getByText('🔥 11-day streak · 11 perfect days · ⭐ 935 XP')).toBeInTheDocument()
    expect(screen.getByText("11 perfect days. You'd throw them away?")).toBeInTheDocument()

    click("I'll stay")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('words step 2 for a single perfect day', async () => {
    stats.perfectDays = 1
    await setup()
    click('Give up')

    expect(screen.getByText('🔥 11-day streak · 1 perfect day · ⭐ 935 XP')).toBeInTheDocument()
    expect(screen.getByText("1 perfect day. You'd throw it away?")).toBeInTheDocument()
  })

  it('words step 2 for no perfect day at all', async () => {
    stats.perfectDays = 0
    await setup()
    click('Give up')

    expect(screen.getByText("Not one perfect day yet, and you're already out?")).toBeInTheDocument()
  })

  it('locks Give up on step 3 for five seconds, counting down', async () => {
    const { onClose } = await setup()
    click('Give up')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    click("I'm sure")

    expect(screen.getByRole('heading', { name: 'Last warning.' })).toBeInTheDocument()
    expect(screen.getByText("Tomorrow is Day 13. Quitters don't get a Day 13.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give up (5)' })).toBeDisabled()

    tick()
    expect(screen.getByRole('button', { name: 'Give up (4)' })).toBeDisabled()

    for (let second = 0; second < 4; second++) tick()
    expect(screen.getByRole('button', { name: 'Give up' })).toBeEnabled()

    click('Keep going')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('speaks of the finish line on Day 75', async () => {
    await setup(75)
    click('Give up')
    click("I'm sure")

    expect(screen.getByText("It's Day 75. Quitters don't get a finish line.")).toBeInTheDocument()
  })

  it('unlocks the last button only once GIVE UP is typed, then gives the attempt up', async () => {
    const { challengeId } = await setup()
    reachStepFour()

    expect(screen.getByRole('heading', { name: 'Type GIVE UP to confirm.' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Give up for good' })
    expect(confirm).toBeDisabled()

    typeConfirmation('give')
    expect(confirm).toBeDisabled()
    typeConfirmation('GIVEUP')
    expect(confirm).toBeDisabled()
    typeConfirmation('  give   up ')
    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)

    await waitFor(async () =>
      expect(await db.challenges.get(challengeId)).toMatchObject({ status: 'abandoned', abandonedOn: today }),
    )
  })

  it('closes on Cancel at the last step without giving up', async () => {
    const { challengeId, onClose } = await setup()
    reachStepFour()

    click('Cancel')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('says so when the attempt can no longer be given up', async () => {
    const { challengeId } = await setup()
    reachStepFour()
    await db.challenges.update(challengeId, { status: 'completed' })

    typeConfirmation('GIVE UP')
    click('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("This attempt can't be given up anymore.")
    expect(screen.getByRole('button', { name: 'Give up for good' })).toBeEnabled()
  })

  it('shows an error and re-enables the button when saving fails', async () => {
    vi.spyOn(challengeRepo, 'giveUp').mockRejectedValueOnce(new Error('quota'))
    await setup()
    reachStepFour()

    typeConfirmation('GIVE UP')
    click('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't give up — try again.")
    expect(screen.getByRole('button', { name: 'Give up for good' })).toBeEnabled()
  })
})
```

Create `src/screens/Settings/__tests__/SettingsScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { SettingsScreen } from '../SettingsScreen'

// Only the danger zone is under test; the other sections stand aside.
vi.mock('../StartDateSection', () => ({ StartDateSection: () => null }))
vi.mock('../InstallSection', () => ({ InstallSection: () => null }))
vi.mock('../AppearanceSection', () => ({ AppearanceSection: () => null }))
vi.mock('../BooksSection', () => ({ BooksSection: () => null }))
vi.mock('../BadgesSection', () => ({ BadgesSection: () => null }))
vi.mock('../CompanionSection', () => ({ CompanionSection: () => null }))
vi.mock('../ExportImportSection', () => ({ ExportImportSection: () => null }))
vi.mock('../AttemptHistorySection', () => ({ AttemptHistorySection: () => null }))

/** A 75 Hard attempt on Day 12, with Settings open. */
async function setup(canGiveUp: boolean) {
  const today = todayISO()
  const challengeId = await addChallenge({ startDate: addDaysISO(today, -11), attemptNumber: 1, status: 'active' })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<SettingsScreen challenge={challenge} today={today} todayDayNumber={12} streak={11} canGiveUp={canGiveUp} />)
}

describe('SettingsScreen danger zone', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('offers giving up while the attempt can be given up, opening the flow', async () => {
    await setup(true)

    expect(screen.getByText('Stop this attempt for good. It stays in your history.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Give up this challenge' }))

    expect(await screen.findByRole('heading', { name: 'Give up 75 Hard?' })).toBeInTheDocument()
  })

  it('offers only the reset otherwise', async () => {
    await setup(false)

    expect(screen.queryByRole('button', { name: 'Give up this challenge' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset everything' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `npx vitest run src/screens/Settings/__tests__/GiveUpFlow.test.tsx src/screens/Settings/__tests__/SettingsScreen.test.tsx`

Expected:
- `GiveUpFlow` can't be imported yet;
- Settings has no "Give up this challenge" button.

- [ ] **Step 3: Implement**

Create `src/screens/Settings/GiveUpFlow.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Mascot } from '../../components/mascot/Mascot'
import { VARIANT_NAMES } from '../../content/variants'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { variantOf } from '../../logic/rulesets'

interface GiveUpFlowProps {
  open: boolean
  onClose: () => void
  challenge: Challenge
  today: string
  todayDayNumber: number
  streak: number
}

/** How long step 3's "Give up" stays locked. */
const LOCK_SECONDS = 5

/** What step 4 asks the player to type. */
const CONFIRM_PHRASE = 'GIVE UP'

/** Ignores case, surrounding spaces and repeated spaces between the words. */
function matchesConfirmPhrase(typed: string): boolean {
  return typed.trim().replace(/\s+/g, ' ').toUpperCase() === CONFIRM_PHRASE
}

/** The duck's answer to how many perfect days the attempt has. */
function perfectDaysLine(perfectDays: number): string {
  if (perfectDays === 0) return "Not one perfect day yet, and you're already out?"
  if (perfectDays === 1) return "1 perfect day. You'd throw it away?"
  return `${perfectDays} perfect days. You'd throw them away?`
}

/**
 * "Give up this challenge": four confirmations before the attempt ends for
 * good. Every step's first button is the way out, and closing changes
 * nothing; only step 4's "Give up for good" calls challengeRepo.giveUp.
 */
export function GiveUpFlow({ open, onClose, ...rest }: GiveUpFlowProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <GiveUpSteps onClose={onClose} {...rest} />
    </Modal>
  )
}

/** Mounted each time the flow opens, so it always starts at step 1. */
function GiveUpSteps({ onClose, challenge, today, todayDayNumber, streak }: Omit<GiveUpFlowProps, 'open'>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // Loaded as the flow opens, so step 2 has its numbers by the time it shows.
  const { perfectDays, xp } = useChallengeStats(challenge.id)

  if (step === 1) {
    return (
      <>
        <StepHeading focusOnMount={false}>Give up {VARIANT_NAMES[variantOf(challenge)]}?</StepHeading>
        <p className="mt-2 text-sm text-ink-muted">
          You're on Day {todayDayNumber} of {CHALLENGE_LENGTH}. Giving up ends this attempt for good: you can't pick
          it back up. It stays in your history.
        </p>
        <StepButtons stay="Keep going" onStay={onClose}>
          <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
            Give up
          </Button>
        </StepButtons>
      </>
    )
  }

  if (step === 2) {
    return (
      <>
        <div className="flex justify-center">
          <Mascot mood="judging" size={96} />
        </div>
        <StepHeading>Look at what you built.</StepHeading>
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
          🔥 {streak}-day streak · {perfectDays} perfect {perfectDays === 1 ? 'day' : 'days'} · ⭐ {xp} XP
        </p>
        <p className="mt-3 font-rounded font-bold text-ink">{perfectDaysLine(perfectDays)}</p>
        <StepButtons stay="I'll stay" onStay={onClose}>
          <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
            I'm sure
          </Button>
        </StepButtons>
      </>
    )
  }

  if (step === 3) return <LastWarning todayDayNumber={todayDayNumber} onStay={onClose} onGoOn={() => setStep(4)} />
  return <TypeToConfirm challenge={challenge} today={today} onCancel={onClose} />
}

/** A step's heading. It takes focus when its step appears; step 1 leaves focus to the Modal's own panel. */
function StepHeading({ children, focusOnMount = true }: { children: ReactNode; focusOnMount?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusOnMount) heading.current?.focus()
  }, [focusOnMount])

  return (
    <h3 ref={heading} tabIndex={-1} className="font-rounded text-lg font-extrabold text-ink outline-none">
      {children}
    </h3>
  )
}

/** The way out (primary, first), then the way on. */
function StepButtons({
  stay,
  onStay,
  stayDisabled = false,
  children,
}: {
  stay: string
  onStay: () => void
  stayDisabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Button className="flex-1" onClick={onStay} disabled={stayDisabled}>
        {stay}
      </Button>
      {children}
    </div>
  )
}

/** Step 3: the duck's last warning, with "Give up" locked for LOCK_SECONDS. */
function LastWarning({
  todayDayNumber,
  onStay,
  onGoOn,
}: {
  todayDayNumber: number
  onStay: () => void
  onGoOn: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(LOCK_SECONDS)

  useEffect(() => {
    if (secondsLeft === 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const line =
    todayDayNumber < CHALLENGE_LENGTH
      ? `Tomorrow is Day ${todayDayNumber + 1}. Quitters don't get a Day ${todayDayNumber + 1}.`
      : `It's Day ${CHALLENGE_LENGTH}. Quitters don't get a finish line.`

  return (
    <>
      <div className="flex justify-center">
        <Mascot mood="hunting" size={96} />
      </div>
      <StepHeading>Last warning.</StepHeading>
      <p className="mt-3 font-rounded font-bold text-ink">{line}</p>
      <StepButtons stay="Keep going" onStay={onStay}>
        <Button variant="secondary" className="flex-1" onClick={onGoOn} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Give up (${secondsLeft})` : 'Give up'}
        </Button>
      </StepButtons>
    </>
  )
}

/** Step 4: typing GIVE UP unlocks the button that ends the attempt. */
function TypeToConfirm({ challenge, today, onCancel }: { challenge: Challenge; today: string; onCancel: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const giveUp = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await challengeRepo.giveUp(challenge.id, today)
      // On success the gate turns 'abandoned' and the app swaps to the "You gave up" screen.
      if (!result.ok) {
        setError("This attempt can't be given up anymore.")
        setBusy(false)
      }
    } catch {
      setError("Couldn't give up — try again.")
      setBusy(false)
    }
  }

  return (
    <>
      <StepHeading>Type {CONFIRM_PHRASE} to confirm.</StepHeading>
      <p className="mt-2 text-sm text-ink-muted">This can't be undone.</p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="mt-3 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <StepButtons stay="Cancel" onStay={onCancel} stayDisabled={busy}>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => void giveUp()}
          disabled={busy || !matchesConfirmPhrase(typed)}
        >
          {busy ? 'Giving up…' : 'Give up for good'}
        </Button>
      </StepButtons>
    </>
  )
}
```

`src/screens/Settings/SettingsScreen.tsx`:
- import `GiveUpFlow` from `'./GiveUpFlow'`;
- extend the props:

```tsx
interface SettingsScreenProps {
  challenge: Challenge
  today: string
  todayDayNumber: number
  /** The running attempt's streak, shown by the give-up flow. */
  streak: number
  /** True while the attempt can be given up: the gate is active and today is Day 1–75. */
  canGiveUp: boolean
}

export function SettingsScreen({ challenge, today, todayDayNumber, streak, canGiveUp }: SettingsScreenProps) {
```

- add the state `const [showGiveUp, setShowGiveUp] = useState(false)` next to `showResetConfirm`;
- replace the danger zone `<section>` with:

```tsx
        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Danger zone</h2>
          {canGiveUp && (
            <>
              <p className="mt-1 text-sm text-ink-muted">Stop this attempt for good. It stays in your history.</p>
              <Button variant="danger" className="mt-3 w-full" onClick={() => setShowGiveUp(true)}>
                Give up this challenge
              </Button>
            </>
          )}
          <p className={`${canGiveUp ? 'mt-4' : 'mt-1'} text-sm text-ink-muted`}>
            Permanently erase all attempts, photos, and badges.
          </p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setShowResetConfirm(true)}>
            Reset everything
          </Button>
        </section>
```

- render the flow right before the reset `<Modal …>`:

```tsx
      <GiveUpFlow
        open={showGiveUp}
        onClose={() => setShowGiveUp(false)}
        challenge={challenge}
        today={today}
        todayDayNumber={todayDayNumber}
        streak={streak}
      />
```

`src/App.tsx`:
- add `import { isChallengeDay } from './logic/days'`;
- pass the two new props to `SettingsScreen`:

```tsx
          {screen === 'settings' && (
            <SettingsScreen
              challenge={gate.challenge}
              today={today}
              todayDayNumber={gate.todayDayNumber}
              streak={gate.streak}
              canGiveUp={gate.kind === 'active' && isChallengeDay(gate.todayDayNumber)}
            />
          )}
```

`README.md`, under "Features":
- add this bullet right after the **Strict rules** bullet:

```md
- **Giving up** — Settings → Danger zone → Give up this challenge ends the running attempt for good (from Day 1), after four confirmations: what it means, what you built, a five-second last warning, and typing GIVE UP. The attempt stays in the history as Abandoned, and you pick your next challenge and when it starts.
```

- end the **Settings** bullet with "installing the app, backup & storage, and the danger zone (giving up the attempt, or erasing everything)." instead of "installing the app, and backup & storage.".

- [ ] **Step 4: Run the new tests to see them pass**

Run the Step 2 command. Expected: all pass.

- [ ] **Step 5: Run every gate**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`. Expected: all pass, and `npm run test` exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Settings/GiveUpFlow.tsx src/screens/Settings/SettingsScreen.tsx src/App.tsx README.md src/screens/Settings/__tests__/GiveUpFlow.test.tsx src/screens/Settings/__tests__/SettingsScreen.test.tsx
git commit -m "feat: give up the running attempt from Settings, behind four confirmations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
