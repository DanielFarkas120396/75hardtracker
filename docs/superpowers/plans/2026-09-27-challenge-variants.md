# Challenge Variants (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 75 Strong, 75 Medium and 75 Soft playable, each with its own rules:
- recovery days (Soft);
- social occasions declared ahead (Strong, Medium and Soft);
- jokers (Medium: 1; Soft: 3);
- a variant picker, available until the end of Day 1 and when starting a new challenge;
- copy for each variant.

**Architecture:** This builds on PR 1's `src/logic/rulesets.ts`, and on the `rules` parameter that PR 1 threaded through the logic, the database and the screens.
- **Data:** optional, non-indexed fields on `Challenge` (`socialDays`, `jokersAcknowledged`) and on `DayEntry` (`restDay`).
- **Completion:** reads them through `toDayTaskData`.
- **Repository methods:** validate every rule inside one transaction.
- **The gate:** gains a `jokerUsed` kind.
- **Copy:** lives in `src/content/variants.ts`.

**Tech Stack:** React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnused*`), Dexie 4 with dexie-react-hooks, framer-motion, date-fns, Vitest 5 + jsdom + fake-indexeddb, Testing Library, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-26-challenge-variants-design.md`, §2–§10 and §11 (PR 2). Two amendments, made in Task 7:
- The social-occasion sheet uses a date picker plus the list of declared days, not one row per day. On an iPhone, 70 rows is too long, and the native date wheel reaches any future day.
- The water copy prints "3 L", not "3.0 L".

## Global Constraints

- **The owner's live 75 Hard attempt is untouched.**
  - A challenge with no `variant` is judged as 75 Hard.
  - No write path adds `variant`, `socialDays`, `jokersAcknowledged` or `restDay` to an existing row it wasn't asked to change.
  - `src/db/__tests__/goldenHard.test.ts` stays green, unchanged.
- **No Dexie version bump.** Every new field is optional and not indexed.
- **UI copy is English.** Use the exact strings in this plan. They come from spec §10 plus the amendments above.
- **iPhone:**
  - touch only, with no hover affordances;
  - every tappable control is at least 48 px tall (`min-h-touch`);
  - any new motion respects reduced motion, through framer's `MotionConfig` and `useReducedMotionConfig`.
- **Existing tests keep their expectations,** unless this plan names the change.
- **Every commit message ends with exactly:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Gates for every task:** `npx tsc -b`, `npm run lint` and `npm run test`. The last task also runs `npm run build`.

---

### Task 1: Recovery days and social occasions in the data and in completion

**Files:**
- Modify:
  - `src/db/types.ts`;
  - `src/logic/types.ts`;
  - `src/logic/dayCompletion.ts`;
  - `src/db/mappers.ts`, and every `toDayTaskData` caller: `src/db/completion.ts`, `src/db/challengeDays.ts`, `src/db/normalize.ts`, `src/db/repositories/dayEntryRepo.ts` (`hasLoggedProgress`), `src/hooks/useAttemptSummaries.ts`, `src/hooks/useDayCompletion.ts` and `src/screens/RestartFlow/DayFailedScreen.tsx`;
  - `src/db/exportImport.ts`;
  - `src/db/normalize.ts`;
  - `src/screens/Today/TodayScreen.tsx` (the `useDayCompletion` call).
- Test:
  - `src/logic/__tests__/dayCompletion.test.ts`;
  - `src/db/__tests__/exportImport.test.ts`;
  - `src/db/__tests__/normalize.test.ts` (or wherever the normalize tests live).

**Interfaces:**
- Produces:
  ```ts
  // src/db/types.ts
  interface Challenge { /* … */ socialDays?: number[]; jokersAcknowledged?: number }
  interface DayEntry { /* … */ restDay?: true }
  // src/logic/types.ts
  interface DayTaskData { /* … */ restDay?: boolean; socialDay?: boolean }
  // src/db/mappers.ts — socialDays is REQUIRED (pass undefined explicitly) so the compiler finds every caller
  toDayTaskData(entry: DayEntry, workouts: Workout[], socialDays: readonly number[] | undefined): DayTaskData
  // src/logic/dayCompletion.ts
  isDietTaskComplete(data: DayTaskData, rules: Ruleset): boolean   // gains rules
  useDayCompletion(entry, workouts, rules, socialDays)             // gains socialDays
  ```

- [ ] **Step 1: Write the failing tests** (in `src/logic/__tests__/dayCompletion.test.ts`)

```ts
describe('recovery days and social occasions', () => {
  const day = {
    water_ml: 3800,
    pages_read: 10,
    dietFollowed: true,
    noAlcohol: true,
    hasPhoto: true,
    workouts: [] as { durationMin: number; isOutdoor: boolean }[],
  }

  it('counts a recovery day as the workouts on 75 Soft only', () => {
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.soft)).toBe(true)
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.medium)).toBe(false)
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.hard)).toBe(false)
  })

  it('allows a drink on a declared social occasion, except on 75 Hard', () => {
    const drank = { ...day, noAlcohol: false, socialDay: true }
    expect(isDietTaskComplete(drank, RULESETS.strong)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.medium)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.soft)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.hard)).toBe(false)
  })

  it('still needs the diet itself on a social occasion', () => {
    expect(isDietTaskComplete({ ...day, dietFollowed: false, noAlcohol: false, socialDay: true }, RULESETS.strong)).toBe(false)
  })

  it('needs no alcohol on an ordinary day', () => {
    expect(isDietTaskComplete({ ...day, noAlcohol: false }, RULESETS.strong)).toBe(false)
  })
})
```

Run: `npx vitest run src/logic/__tests__/dayCompletion.test.ts`
Expected: FAIL. The rest-day and social cases are false, because the functions ignore the fields.

- [ ] **Step 2: Implement the types and completion**

- **`src/db/types.ts`:** add to `Challenge`:
  ```ts
  /** Day numbers declared ahead as social occasions (Strong, Medium, Soft): a drink is allowed that day. */
  socialDays?: number[]
  /** How many used jokers the player has seen announced. Only ever grows. */
  jokersAcknowledged?: number
  ```
  Add to `DayEntry`:
  ```ts
  /** 75 Soft's recovery day: the workouts task counts as done. Set only through dayEntryRepo.setRestDay. */
  restDay?: true
  ```
- **`src/logic/types.ts`:** add to `DayTaskData`:
  ```ts
  /** The attempt's recovery day for its week (75 Soft). */
  restDay?: boolean
  /** A social occasion declared ahead: a drink doesn't break the diet. */
  socialDay?: boolean
  ```
- **`src/logic/dayCompletion.ts`:**
  ```ts
  export function isWorkoutsTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
    if (rules.restDaysPerWeek > 0 && data.restDay === true) return true
    const qualifying = data.workouts.filter((workout) => isQualifyingWorkout(workout, rules))
    return qualifying.length >= rules.requiredWorkouts && (!rules.requireOutdoor || qualifying.some((w) => w.isOutdoor))
  }

  export function isDietTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
    return data.dietFollowed && (data.noAlcohol || (rules.socialDaysPerWeek > 0 && data.socialDay === true))
  }
  ```
  `taskCompletionMap` passes `rules` to `isDietTaskComplete`. `hasAnyProgress` also returns true for `data.restDay === true`.
- **`src/db/mappers.ts`:**
  ```ts
  /** Maps a DayEntry row, its Workout rows and its attempt's declared social days onto the logic module's data. */
  export function toDayTaskData(entry: DayEntry, workouts: Workout[], socialDays: readonly number[] | undefined): DayTaskData {
    return {
      water_ml: entry.water_ml,
      pages_read: entry.pages_read,
      dietFollowed: entry.dietFollowed,
      noAlcohol: entry.noAlcohol,
      hasPhoto: entry.photoId != null,
      workouts: workouts.map((w) => ({ durationMin: w.durationMin, isOutdoor: w.isOutdoor })),
      restDay: entry.restDay === true,
      socialDay: socialDays?.includes(entry.dayNumber) ?? false,
    }
  }
  ```
- **Callers** pass their attempt's `socialDays`:
  - `completion.ts`: `challenge?.socialDays`.
  - `challengeDays.ts`: `challenge?.socialDays`.
  - `normalize.ts`: the challenge's, from a map built next to `rulesByChallenge`.
  - `dayEntryRepo.hasLoggedProgress`: `undefined`, because progress doesn't depend on it.
  - `useAttemptSummaries`: `challenge.socialDays`.
  - `DayFailedScreen`: `challenge.socialDays`.
  - `useDayCompletion(entry, workouts, rules, socialDays)`: add `socialDays` to the `useMemo` deps. `TodayScreen` passes `challenge.socialDays`.

- [ ] **Step 3: Validate the fields on import, and clean them when repairing**

**`src/db/exportImport.ts`:**
- Add the validators:
  ```ts
  const isDayNumberList = (value: unknown): boolean =>
    Array.isArray(value) && value.every((d) => Number.isInteger(d) && d >= 1 && d <= CHALLENGE_LENGTH)
  const isNonNegativeInteger = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0
  ```
- Add to `ROW_CHECKS.challenges`: `socialDays: isOptional(isDayNumberList)` and `jokersAcknowledged: isOptional(isNonNegativeInteger)`.
- Add to `ROW_CHECKS.dayEntries`: `restDay: isOptional(isBoolean)`. Use the file's existing boolean check, or add `isBoolean` next to `isNumber` if there is none.

**`src/db/normalize.ts`:** after the challenges are normalized, before completion is recomputed:
- For each challenge, keep only the `socialDays` its rules allow:
  - none when `socialDaysPerWeek === 0`;
  - otherwise the sorted, de-duplicated days from 1 to 75, keeping the earliest in each `challengeWeek`.
  
  An empty result deletes the field (`undefined`).
- For each day entry with `restDay`, drop it when its attempt's rules have `restDaysPerWeek === 0`, or when an earlier-numbered entry of the same attempt already holds that week's rest day.
- Recompute `completed` (with `rulesFor` and the cleaned `socialDays`) for every entry whose `restDay` was dropped, or whose day was removed from its attempt's `socialDays`.
- Count what changed in the existing report object, adding a counter such as `invalidFlagsCleared` next to the existing ones.

**Tests:**
- Export/import:
  - a backup carrying `socialDays: [4]`, `jokersAcknowledged: 1` and a `restDay: true` entry round-trips;
  - `socialDays: [0]` is rejected;
  - `jokersAcknowledged: -1` is rejected.
- Normalize:
  - a Hard challenge with `socialDays: [5]` loses them;
  - a Soft attempt with rest days on Days 2 and 3 keeps only Day 2's, and Day 3's `completed` is recomputed to false when it has no workout;
  - a Strong challenge with `socialDays: [2, 3]` keeps `[2]`.

- [ ] **Step 4: Run the gates**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass. `goldenHard.test.ts` is unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -F - <<'EOF'
feat: recovery days and declared social occasions count toward completion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Repository operations for variants, social occasions, recovery days and jokers

**Files:**
- Modify: `src/logic/restart.ts` (`buildNextChallenge`), `src/db/repositories/challengeRepo.ts`, `src/db/repositories/dayEntryRepo.ts`
- Test: `src/db/__tests__/repositories.test.ts`, `src/logic/__tests__/restart.test.ts`, `src/db/__tests__/goldenHard.test.ts` (adding tests only)

**Interfaces:**
- Produces:
  ```ts
  // src/logic/restart.ts
  interface NewChallenge { startDate: string; attemptNumber: number; status: 'active'; variant: ChallengeVariant }
  buildNextChallenge(existingAttemptNumbers: readonly number[], startDate: string, variant: ChallengeVariant): NewChallenge

  // src/db/repositories/challengeRepo.ts
  export type SocialDayResult =
    | { ok: true }
    | { ok: false; reason: 'not-allowed' | 'too-late' | 'out-of-range' | 'week-taken'; dayNumber?: number }
  export type VariantChangeResult = { ok: true } | { ok: false; reason: 'locked' }
  challengeRepo.bootstrapIfEmpty(startDate)                       // writes variant 'hard'
  challengeRepo.restart(failedChallengeId, startDate)             // the new attempt keeps the failed one's variant
  challengeRepo.startNew(startDate, variant: ChallengeVariant)
  challengeRepo.changeVariant(id, variant, today): Promise<VariantChangeResult>
  challengeRepo.setSocialDay(id, dayNumber, on: boolean, today): Promise<SocialDayResult>
  challengeRepo.acknowledgeJokers(id, count): Promise<void>

  // src/db/repositories/dayEntryRepo.ts
  export type RestDayResult = { ok: true } | { ok: false; reason: 'not-allowed' | 'week-taken'; dayNumber?: number }
  dayEntryRepo.setRestDay(entryId, on: boolean): Promise<RestDayResult>
  ```

- [ ] **Step 1: Write the failing tests** (in `src/db/__tests__/repositories.test.ts`, using the existing fixtures)

**`describe('social occasions')`**, with a Strong challenge that started 2 days ago, so today is Day 3:
- declaring Day 4 works, and `socialDays` becomes `[4]`;
- declaring Day 3 (today) or Day 2 gives `{ ok: false, reason: 'too-late' }`;
- declaring Day 5 after Day 4 gives `{ ok: false, reason: 'week-taken', dayNumber: 4 }`;
- declaring Day 8 works, because it is week 2;
- declaring Day 76 gives `out-of-range`;
- on a Hard challenge, declaring gives `not-allowed`;
- declaring Day 4 twice is idempotent;
- cancelling Day 4 empties it, and the field is removed;
- cancelling Day 2 when it was declared gives `too-late`;
- **cancelling today's occasion re-syncs today.** Seed Day 3 with `socialDays: [3]` written directly, with every task done and `noAlcohol: false`, so it is `completed` true. `setSocialDay(id, 3, false, today)` makes Day 3 `completed` false.

**`describe('recovery days')`**, with a Soft challenge:
- `setRestDay(day2Id, true)` completes Day 2's workouts: with every other task done, `completed` is true;
- `setRestDay(day3Id, true)` then gives `week-taken` with `dayNumber: 2`;
- `setRestDay(day2Id, false)` clears the field and syncs;
- on a Medium challenge, `setRestDay` gives `not-allowed`.

**`describe('changing the variant')`:**
- On Day 1, `changeVariant(id, 'soft', today)` sets it. Switching back to `'hard'` removes `socialDays` and every entry's `restDay`, and recomputes Day 1's `completed`.
- On Day 2 it gives `{ ok: false, reason: 'locked' }`.

**`describe('starting attempts')`:**
- `bootstrapIfEmpty` writes `variant: 'hard'`;
- `startNew(today, 'medium')` writes `variant: 'medium'`;
- `restart` of a Soft attempt starts a Soft attempt;
- `restart` of a variant-less attempt starts a `'hard'` attempt, and the old row still has no `variant` key.

**`describe('acknowledging jokers')`:** `acknowledgeJokers(id, 1)` sets 1, and a later `acknowledgeJokers(id, 0)` keeps it at 1.

In `goldenHard.test.ts`, add one test: `challengeRepo.setSocialDay` on the variant-less challenge gives `not-allowed` and leaves the row deep-equal. Don't change the existing tests.

In `restart.test.ts`: `buildNextChallenge([1, 2], '2026-10-01', 'medium')` equals `{ startDate: '2026-10-01', attemptNumber: 3, status: 'active', variant: 'medium' }`.

Run: `npx vitest run src/db/__tests__/repositories.test.ts src/logic/__tests__/restart.test.ts`
Expected: FAIL, because the methods don't exist yet.

- [ ] **Step 2: Implement**

**`src/logic/restart.ts`:** `buildNextChallenge` takes and returns `variant`.

**`src/db/repositories/challengeRepo.ts`:**

```ts
/** Returns the active challenge's id, or creates the next attempt. Must run inside a rw transaction on challenges. */
async function activeOrNextAttempt(startDate: string, variant: ChallengeVariant): Promise<number> {
  const active = await db.challenges.where('status').equals('active').first()
  if (active) return active.id
  const all = await db.challenges.toArray()
  return db.challenges.add(buildNextChallenge(all.map((c) => c.attemptNumber), startDate, variant) as Challenge)
}
```

- `bootstrapIfEmpty` passes `'hard'`.
- `restart` reads the failed attempt and passes `variantOf(failed ?? {})`.
- `startNew(startDate, variant)` passes `variant`.

```ts
  /**
   * Switches an active attempt's challenge while its start date can still move
   * (before or on Day 1). Social occasions and recovery days the new rules
   * don't allow are cleared, and the attempt's days are re-judged.
   */
  async changeVariant(id: number, variant: ChallengeVariant, today: string): Promise<VariantChangeResult> {
    return db.transaction('rw', COMPLETION_TABLES, async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active') return { ok: false, reason: 'locked' } as const
      if (!isStartDateEditable(dayNumberForDate(challenge.startDate, today))) return { ok: false, reason: 'locked' } as const

      const rules = RULESETS[variant]
      await db.challenges.update(id, {
        variant,
        ...(rules.socialDaysPerWeek === 0 ? { socialDays: undefined } : {}),
      })
      const entries = await db.dayEntries.where('challengeId').equals(id).toArray()
      for (const entry of entries) {
        if (rules.restDaysPerWeek === 0 && entry.restDay) await db.dayEntries.update(entry.id, { restDay: undefined })
        await syncDayCompletion(entry.id)
      }
      return { ok: true } as const
    })
  },

  /**
   * Declares (or cancels) a social occasion. It must be declared the day
   * before at the latest, with at most one per challenge week, and only in
   * challenges that allow them. A past occasion can't be cancelled; cancelling
   * today's re-judges today.
   */
  async setSocialDay(id: number, dayNumber: number, on: boolean, today: string): Promise<SocialDayResult> {
    return db.transaction('rw', COMPLETION_TABLES, async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active' || rulesFor(challenge).socialDaysPerWeek === 0) {
        return { ok: false, reason: 'not-allowed' } as const
      }
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > CHALLENGE_LENGTH) {
        return { ok: false, reason: 'out-of-range' } as const
      }
      const todayDayNumber = dayNumberForDate(challenge.startDate, today)
      const days = challenge.socialDays ?? []

      if (on) {
        if (!(dayNumber > todayDayNumber)) return { ok: false, reason: 'too-late' } as const
        if (days.includes(dayNumber)) return { ok: true } as const
        const taken = days.find((d) => challengeWeek(d) === challengeWeek(dayNumber))
        if (taken !== undefined) return { ok: false, reason: 'week-taken', dayNumber: taken } as const
        await db.challenges.update(id, { socialDays: [...days, dayNumber].sort((a, b) => a - b) })
        return { ok: true } as const
      }

      if (!days.includes(dayNumber)) return { ok: true } as const
      if (dayNumber < todayDayNumber) return { ok: false, reason: 'too-late' } as const
      const rest = days.filter((d) => d !== dayNumber)
      await db.challenges.update(id, { socialDays: rest.length > 0 ? rest : undefined })
      if (dayNumber === todayDayNumber) {
        const entry = await db.dayEntries.where('[challengeId+dayNumber]').equals([id, dayNumber]).first()
        if (entry) await syncDayCompletion(entry.id)
      }
      return { ok: true } as const
    })
  },

  /** Records that the player has seen `count` used jokers announced. Never lowers the count. */
  async acknowledgeJokers(id: number, count: number): Promise<void> {
    await db.challenges
      .where('id')
      .equals(id)
      .modify((challenge) => {
        if (count > (challenge.jokersAcknowledged ?? 0)) challenge.jokersAcknowledged = count
      })
  },
```

Imports:
- `COMPLETION_TABLES` and `syncDayCompletion` from `../completion`;
- `RULESETS`, `rulesFor`, `variantOf`, `challengeWeek` and `type ChallengeVariant` from `../../logic/rulesets`;
- `isStartDateEditable` from `../../logic/startDate`;
- `CHALLENGE_LENGTH` from `../../logic/constants`.

Check how the file's other queries use the compound index `[challengeId+dayNumber]`, for example `dayEntryRepo.getByChallengeAndDayNumber`, and match it.

**`src/db/repositories/dayEntryRepo.ts`:**

```ts
  /**
   * Takes (or gives back) 75 Soft's recovery day on this entry: at most one
   * per challenge week, and only in challenges that allow one. The workouts
   * task counts as done that day.
   */
  async setRestDay(entryId: number, on: boolean): Promise<RestDayResult> {
    return db.transaction('rw', COMPLETION_TABLES, async () => {
      const entry = await db.dayEntries.get(entryId)
      if (!entry) return { ok: false, reason: 'not-allowed' } as const
      const challenge = await db.challenges.get(entry.challengeId)
      if (rulesFor(challenge ?? {}).restDaysPerWeek === 0) return { ok: false, reason: 'not-allowed' } as const

      if (on) {
        const siblings = await db.dayEntries.where('challengeId').equals(entry.challengeId).toArray()
        const taken = siblings.find(
          (e) => e.id !== entry.id && e.restDay && challengeWeek(e.dayNumber) === challengeWeek(entry.dayNumber),
        )
        if (taken) return { ok: false, reason: 'week-taken', dayNumber: taken.dayNumber } as const
      }
      await db.dayEntries.update(entryId, { restDay: on ? true : undefined })
      await syncDayCompletion(entryId)
      return { ok: true } as const
    })
  },
```

- [ ] **Step 3: Run the gates, then commit**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

```bash
git add -A src
git commit -F - <<'EOF'
feat: choose, switch and start challenge variants; declare social occasions and recovery days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: The joker gate, the joker screen and missed days on the Journey

**Files:**
- Modify:
  - `src/logic/restart.ts` (`GateResolution` gains `missed`);
  - `src/hooks/useChallengeGate.ts`;
  - `src/App.tsx`;
  - `src/hooks/useBadgeUnlocks.ts`;
  - `src/screens/RestartFlow/DayFailedScreen.tsx` (extract the list);
  - `src/screens/Journey/JourneyScreen.tsx`, `JourneyPath.tsx`, `JourneyNode.tsx`.
- Create:
  - `src/screens/RestartFlow/MissedTasksList.tsx`;
  - `src/screens/RestartFlow/JokerUsedScreen.tsx`.
- Test:
  - `src/logic/__tests__/restart.test.ts`;
  - `src/hooks/__tests__/useChallengeGate.test.ts` (new, for the exported pure `resolveGate`);
  - `src/screens/RestartFlow/__tests__/JokerUsedScreen.test.tsx` (new).

**Interfaces:**
- Produces:
  ```ts
  // src/logic/restart.ts
  interface GateResolution { kind: GateKind; failedDayNumber?: number; missed: number[] }
  // src/hooks/useChallengeGate.ts — exported for tests
  interface GateBase { /* … */ missedDays: number[]; jokersLeft: number }
  type ChallengeGate = … | (GateBase & { kind: 'jokerUsed'; newlyMissed: number[] })
  export function resolveGate(challenge: Challenge, dayEntries: DayEntry[], today: string): ChallengeGate
  // src/screens/RestartFlow/MissedTasksList.tsx
  MissedTasksList({ challenge, dayNumber }: { challenge: Challenge; dayNumber: number })
  // src/screens/RestartFlow/JokerUsedScreen.tsx
  JokerUsedScreen({ challenge, newlyMissed, missedCount, jokersLeft })
  ```

- [ ] **Step 1: Write the failing tests**

In `restart.test.ts`: `resolveChallengeGate` returns `missed`. With `jokers: 1` and one miss, the result is `{ kind: 'active', missed: [3] }`. Update the existing `resolveChallengeGate` expectations to include `missed`; this is the one allowed expectation change.

In `src/hooks/__tests__/useChallengeGate.test.ts`, test `resolveGate` as a pure function (no database). Use a Medium challenge that started 5 days ago, so today is Day 6, with Days 1, 2, 4 and 5 complete and Day 3 missing:
- `jokersAcknowledged` unset: `kind` is `'jokerUsed'`, `newlyMissed` is `[3]`, `missedDays` is `[3]` and `jokersLeft` is `0`;
- `jokersAcknowledged: 1`: `kind` is `'active'` and `jokersLeft` is `0`;
- a Hard challenge with the same days: `kind` is `'needsRestart'` and `failedDayNumber` is `3`;
- a variant-less challenge with every day complete: `kind` is `'active'`, `missedDays` is `[]` and `jokersLeft` is `0`.

In `JokerUsedScreen.test.tsx`, rendered with a Medium challenge seeded in fake-indexeddb, a missing Day 3 entry, `newlyMissed={[3]}`, `missedCount={1}` and `jokersLeft={0}`:
- shows "Day 3 wasn't completed";
- shows "Joker used. 0 left.";
- shows "That was your last joker. Next time, it's Day 1.";
- shows "Your streak starts over. Your challenge doesn't.";
- shows the missed tasks (all five rule lines, because the entry is missing);
- **Keep going** calls `acknowledgeJokers` with `(id, 1)`, checked through the stored row;
- with `newlyMissed={[12, 13]}`, `missedCount={2}` and `jokersLeft={1}`: shows "Days 12 and 13 weren't completed" and "2 jokers used. 1 left.", and the line "I'll let that one go. Once.".

Run the three files: they FAIL.

- [ ] **Step 2: Implement**

**`src/logic/restart.ts`:** `resolveChallengeGate` returns `missed: evaluation.missed` in every branch. For `needsRestart`, return the recomputed finite-today list it already builds.

**`src/hooks/useChallengeGate.ts`:** export `resolveGate`, and extend it:

```ts
  const rules = rulesFor(challenge)
  const resolution = resolveChallengeGate({ currentStatus: challenge.status, dayEntries: summaries, todayDayNumber, jokers: rules.jokers })
  const base: GateBase = { …existing, missedDays: resolution.missed, jokersLeft: Math.max(0, rules.jokers - resolution.missed.length) }
  if (resolution.kind === 'needsRestart') return { ...base, kind: 'needsRestart', failedDayNumber: resolution.failedDayNumber ?? 1 }
  const acknowledged = challenge.jokersAcknowledged ?? 0
  if (resolution.kind === 'active' && resolution.missed.length > acknowledged) {
    return { ...base, kind: 'jokerUsed', newlyMissed: resolution.missed.slice(acknowledged) }
  }
  return { ...base, kind: resolution.kind }
```

Update the `ChallengeGate` doc comment: `needsRestart` means a miss beyond the jokers, and `jokerUsed` means a miss that a joker forgave, not yet announced.

**`src/App.tsx`:** right after the `needsRestart` branch, add a `jokerUsed` branch that renders `<JokerUsedScreen challenge={gate.challenge} newlyMissed={gate.newlyMissed} missedCount={gate.missedDays.length} jokersLeft={gate.jokersLeft} />`. Lazy-load it like `DayFailedScreen`. Pass `missedDays={gate.missedDays}` to `JourneyScreen`.

**`src/hooks/useBadgeUnlocks.ts`:** treat `jokerUsed` like `active`. The existing check `gate.kind !== 'needsRestart'` already does. Check the other hooks for `kind === 'active'` checks, and include `jokerUsed` where "the attempt is running" is meant.

**`MissedTasksList`:** the live query and the `<ul>` from `DayFailedScreen`, moved as they are, with rules from `rulesFor(challenge)` and `challenge.socialDays`. `DayFailedScreen` renders `<MissedTasksList challenge={challenge} dayNumber={failedDayNumber} />`, with its current markup unchanged.

**`JokerUsedScreen`** uses the same layout as `DayFailedScreen`:
- the judging `Mascot`;
- the `h1`: `newlyMissed.length === 1 ? \`Day ${d} wasn't completed\` : \`Days ${list} weren't completed\``. The list reads "12 and 13", or "3, 4 and 5";
- one `MissedTasksList` per day in `newlyMissed`. When there are several days, put a small "Day N" label above each list;
- a `<p>`: `newlyMissed.length === 1 ? \`Joker used. ${jokersLeft} left.\` : \`${newlyMissed.length} jokers used. ${jokersLeft} left.\``;
- a `<p>`: "Your streak starts over. Your challenge doesn't.";
- the duck's line in bold: `jokersLeft === 0 ? "That was your last joker. Next time, it's Day 1." : "I'll let that one go. Once."`;
- a `Button variant="primary"` reading "Keep going" (or "Keeping going…" while busy) that calls `challengeRepo.acknowledgeJokers(challenge.id, missedCount)`. On failure, re-enable the button and show `Couldn't save that — try again.` in a `role="alert"` line.

**Journey:**
- `JourneyScreen` gains `missedDays: number[]` and passes `missedDayNumbers={new Set(missedDays)}` to `JourneyPath`.
- `JourneyPath` gives state `'missed'` to a day in that set that isn't today.
- `JourneyNode`'s `NodeState` gains `'missed'`:
  - fill `var(--color-orange-light)`, stroke `var(--color-orange)`, full opacity;
  - the label is the text `🃏` at `fontSize` 18, instead of the day number;
  - no lock badge.

- [ ] **Step 3: Run the gates, then commit**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

```bash
git add -A src
git commit -F - <<'EOF'
feat: announce a used joker, and mark forgiven days on the Journey

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Copy for each variant

**Files:**
- Create: `src/content/variants.ts`
- Test: `src/content/__tests__/variants.test.ts`
- Modify:
  - `src/content/microcopy.ts`: `TASK_RULES` is replaced by `taskRule(task, rules)`, and `taskCheer` gains `rules`;
  - every caller of those two, including `MissedTasksList.tsx` and `TodayScreen.tsx`;
  - `src/screens/Today/WorkoutCard.tsx`, `WaterCard.tsx`, `ReadingCard.tsx` and `DietCard.tsx` (which gains a `rules` prop);
  - `src/screens/Victory/VictoryScreen.tsx`, `src/screens/RestartFlow/DayFailedScreen.tsx` and `src/screens/Today/PreStartView.tsx`;
  - `index.html` (the description meta);
  - `src/content/__tests__/microcopy.test.ts`.

**Interfaces:**
- Produces, in `src/content/variants.ts`:
  ```ts
  export const VARIANT_NAMES: Record<ChallengeVariant, string>
  export const VARIANT_SUMMARIES: Record<ChallengeVariant, string>
  export function formatLiters(ml: number): string            // 3800 → "3.8", 3000 → "3"
  export function workoutRuleLine(rules: Ruleset): string
  export function dietRuleLine(rules: Ruleset): string
  export function dietToggleLabel(rules: Ruleset): string
  export function readingRuleLine(rules: Ruleset): string
  export function missedDayExplanation(rules: Ruleset, attemptNumber: number): string
  export function victoryTitle(rules: Ruleset): string
  export function victoryLine(rules: Ruleset): string
  export function preStartPlanLine(rules: Ruleset): string
  ```
- In `src/content/microcopy.ts`: `taskRule(task: TaskId, rules: Ruleset): string` and `taskCheer(task: TaskId, dayNumber: number, rules: Ruleset): string`.

- [ ] **Step 1: Write the failing test** (`src/content/__tests__/variants.test.ts`), covering these exact strings:

```ts
import { describe, expect, it } from 'vitest'
import { RULESETS } from '../../logic/rulesets'
import {
  dietRuleLine, dietToggleLabel, formatLiters, missedDayExplanation, preStartPlanLine, readingRuleLine,
  VARIANT_NAMES, VARIANT_SUMMARIES, victoryLine, victoryTitle, workoutRuleLine,
} from '../variants'
import { taskCheer, taskRule } from '../microcopy'

describe('variant copy', () => {
  it('names the four challenges', () => {
    expect(VARIANT_NAMES).toEqual({ hard: '75 Hard', strong: '75 Strong', medium: '75 Medium', soft: '75 Soft' })
  })

  it('summarises each challenge for the picker', () => {
    expect(VARIANT_SUMMARIES.hard).toBe(
      'Two 45-min workouts (one outdoors), strict diet, no alcohol, 3.8 L of water, 10 pages of non-fiction, a photo. Miss a day: back to Day 1.',
    )
    expect(VARIANT_SUMMARIES.strong).toBe(
      'Everything in 75 Hard, plus one social occasion a week, declared the day before.',
    )
    expect(VARIANT_SUMMARIES.medium).toBe(
      'One 45-min workout, eat healthy, 3 L of water, 10 pages of any book, a photo. One social occasion a week. One joker.',
    )
    expect(VARIANT_SUMMARIES.soft).toBe('Like 75 Medium, plus a recovery day a week. Three jokers.')
  })

  it('prints litres without a trailing .0', () => {
    expect(formatLiters(3800)).toBe('3.8')
    expect(formatLiters(3000)).toBe('3')
    expect(formatLiters(1250)).toBe('1.3')
  })

  it('states the card rules per challenge', () => {
    expect(workoutRuleLine(RULESETS.hard)).toBe('2 sessions of at least 45 minutes, one of them outdoors.')
    expect(workoutRuleLine(RULESETS.strong)).toBe('2 sessions of at least 45 minutes, one of them outdoors.')
    expect(workoutRuleLine(RULESETS.medium)).toBe('1 session of at least 45 minutes.')
    expect(workoutRuleLine(RULESETS.soft)).toBe('1 session of at least 45 minutes. One recovery day a week.')
    expect(dietRuleLine(RULESETS.hard)).toBe('No cheat meals, no alcohol.')
    expect(dietRuleLine(RULESETS.strong)).toBe('No cheat meals. No alcohol, except a declared social occasion.')
    expect(dietRuleLine(RULESETS.medium)).toBe('Eat healthy. No alcohol, except a declared social occasion.')
    expect(dietToggleLabel(RULESETS.strong)).toBe('I followed my diet')
    expect(dietToggleLabel(RULESETS.soft)).toBe('I ate healthy')
    expect(readingRuleLine(RULESETS.hard)).toBe('10 pages of non-fiction a day.')
    expect(readingRuleLine(RULESETS.medium)).toBe('10 pages of any book a day.')
  })

  it('lists each missed task by the attempt rules', () => {
    expect(taskRule('workouts', RULESETS.hard)).toBe('2 workouts of 45+ min, one outdoors')
    expect(taskRule('workouts', RULESETS.medium)).toBe('1 workout of 45+ min')
    expect(taskRule('workouts', RULESETS.soft)).toBe('1 workout of 45+ min (or a recovery day)')
    expect(taskRule('diet', RULESETS.hard)).toBe('Diet followed, no alcohol')
    expect(taskRule('diet', RULESETS.strong)).toBe('Diet followed, no alcohol unless declared')
    expect(taskRule('diet', RULESETS.medium)).toBe('Ate healthy, no alcohol unless declared')
    expect(taskRule('water', RULESETS.hard)).toBe('3.8 L of water')
    expect(taskRule('water', RULESETS.medium)).toBe('3 L of water')
    expect(taskRule('reading', RULESETS.soft)).toBe('10 pages read')
    expect(taskRule('photo', RULESETS.soft)).toBe('Progress photo')
  })

  it('cheers one workout on Medium and Soft, and their 3 L', () => {
    expect(taskCheer('workouts', 1, RULESETS.hard)).toBe('Both workouts done! 💪')
    expect(taskCheer('workouts', 1, RULESETS.medium)).toBe('Workout done! 💪')
    expect(taskCheer('water', 2, RULESETS.hard)).toBe('All 3.8 L down')
    expect(taskCheer('water', 2, RULESETS.soft)).toBe('All 3 L down')
  })

  it('explains a failed attempt per challenge', () => {
    expect(missedDayExplanation(RULESETS.hard, 2)).toBe(
      '75 Hard is all-or-nothing on every task, every day. This attempt (#2) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.strong, 1)).toBe(
      '75 Strong is all-or-nothing on every task, every day. This attempt (#1) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.medium, 3)).toBe(
      '75 Medium forgives one missed day. This was your second, so this attempt (#3) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.soft, 1)).toBe(
      '75 Soft forgives three missed days. This was your fourth, so this attempt (#1) ends here — but every photo and stat you logged is saved for good.',
    )
  })

  it('celebrates and prepares per challenge', () => {
    expect(victoryTitle(RULESETS.medium)).toBe('75 Medium complete! 🏆')
    expect(victoryLine(RULESETS.hard)).toBe(
      "75 days. Two workouts, the diet, the water, the reading and the photo — every single day. That's done now, and it's yours.",
    )
    expect(victoryLine(RULESETS.soft)).toBe(
      "75 days. The workout, the diet, the water, the reading and the photo. That's done now, and it's yours.",
    )
    expect(preStartPlanLine(RULESETS.hard)).toBe('plan two workouts a day')
    expect(preStartPlanLine(RULESETS.medium)).toBe('plan a workout a day')
  })
})
```

Run: FAIL, because the module is missing.

- [ ] **Step 2: Implement the copy module** (`src/content/variants.ts`)

```ts
import { CHALLENGE_LENGTH } from '../logic/constants'
import type { ChallengeVariant, Ruleset } from '../logic/rulesets'

/** Each challenge's display name. */
export const VARIANT_NAMES: Record<ChallengeVariant, string> = {
  hard: '75 Hard',
  strong: '75 Strong',
  medium: '75 Medium',
  soft: '75 Soft',
}

/** One line per challenge for the variant picker. */
export const VARIANT_SUMMARIES: Record<ChallengeVariant, string> = {
  hard: 'Two 45-min workouts (one outdoors), strict diet, no alcohol, 3.8 L of water, 10 pages of non-fiction, a photo. Miss a day: back to Day 1.',
  strong: 'Everything in 75 Hard, plus one social occasion a week, declared the day before.',
  medium: 'One 45-min workout, eat healthy, 3 L of water, 10 pages of any book, a photo. One social occasion a week. One joker.',
  soft: 'Like 75 Medium, plus a recovery day a week. Three jokers.',
}

/** Litres for display, without a trailing ".0": 3800 → "3.8", 3000 → "3". */
export function formatLiters(ml: number): string {
  return String(Number((ml / 1000).toFixed(1)))
}

export function workoutRuleLine(rules: Ruleset): string {
  const sessions = rules.requiredWorkouts === 1 ? '1 session' : `${rules.requiredWorkouts} sessions`
  const outdoors = rules.requireOutdoor ? ', one of them outdoors.' : '.'
  const recovery = rules.restDaysPerWeek > 0 ? ' One recovery day a week.' : ''
  return `${sessions} of at least ${rules.minWorkoutMin} minutes${outdoors}${recovery}`
}

export function dietRuleLine(rules: Ruleset): string {
  if (rules.dietKind === 'healthy') return 'Eat healthy. No alcohol, except a declared social occasion.'
  return rules.socialDaysPerWeek > 0
    ? 'No cheat meals. No alcohol, except a declared social occasion.'
    : 'No cheat meals, no alcohol.'
}

export function dietToggleLabel(rules: Ruleset): string {
  return rules.dietKind === 'healthy' ? 'I ate healthy' : 'I followed my diet'
}

export function readingRuleLine(rules: Ruleset): string {
  return `${rules.pagesTarget} pages of ${rules.readingKind === 'non-fiction' ? 'non-fiction' : 'any book'} a day.`
}

const MISS_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const
const JOKER_WORDS = ['no', 'one', 'two', 'three', 'four'] as const

export function missedDayExplanation(rules: Ruleset, attemptNumber: number): string {
  const name = VARIANT_NAMES[rules.variant]
  const saved = `this attempt (#${attemptNumber}) ends here — but every photo and stat you logged is saved for good.`
  if (rules.jokers === 0) return `${name} is all-or-nothing on every task, every day. ${saved[0].toUpperCase()}${saved.slice(1)}`
  const forgives = `${JOKER_WORDS[rules.jokers]} missed ${rules.jokers === 1 ? 'day' : 'days'}`
  return `${name} forgives ${forgives}. This was your ${MISS_ORDINALS[rules.jokers]}, so ${saved}`
}

export function victoryTitle(rules: Ruleset): string {
  return `${VARIANT_NAMES[rules.variant]} complete! 🏆`
}

export function victoryLine(rules: Ruleset): string {
  return rules.requiredWorkouts === 2
    ? `${CHALLENGE_LENGTH} days. Two workouts, the diet, the water, the reading and the photo — every single day. That's done now, and it's yours.`
    : `${CHALLENGE_LENGTH} days. The workout, the diet, the water, the reading and the photo. That's done now, and it's yours.`
}

export function preStartPlanLine(rules: Ruleset): string {
  return rules.requiredWorkouts === 2 ? 'plan two workouts a day' : 'plan a workout a day'
}
```

**`src/content/microcopy.ts`:**
- Replace `TASK_RULES` with:
  ```ts
  /** Each task's rule in a few words, e.g. for listing what a failed day missed. */
  export function taskRule(task: TaskId, rules: Ruleset): string {
    switch (task) {
      case 'workouts': {
        const base = rules.requiredWorkouts === 1
          ? `1 workout of ${rules.minWorkoutMin}+ min`
          : `${rules.requiredWorkouts} workouts of ${rules.minWorkoutMin}+ min`
        return `${base}${rules.requireOutdoor ? ', one outdoors' : ''}${rules.restDaysPerWeek > 0 ? ' (or a recovery day)' : ''}`
      }
      case 'diet':
        return rules.dietKind === 'healthy'
          ? 'Ate healthy, no alcohol unless declared'
          : rules.socialDaysPerWeek > 0 ? 'Diet followed, no alcohol unless declared' : 'Diet followed, no alcohol'
      case 'water':
        return `${formatLiters(rules.waterTargetMl)} L of water`
      case 'reading':
        return `${rules.pagesTarget} pages read`
      case 'photo':
        return 'Progress photo'
    }
  }
  ```
- `taskCheer(task, dayNumber, rules)` builds the task's cheers from the rules:
  - **workouts:** `rules.requiredWorkouts === 2 ? ['Both workouts done! 💪', 'Two sessions in the bank', 'Sweat logged. Beast mode.'] : ['Workout done! 💪', 'Session in the bank', 'Sweat logged. Beast mode.']`;
  - **diet:** `rules.dietKind === 'strict' ? ['Clean eating, locked in 🥗', 'Diet on point today', 'No cheats, no drinks. Solid.'] : ['Clean eating, locked in 🥗', 'Diet on point today', 'Ate well. Solid.']`;
  - **water:** `['Fully hydrated! 💧', \`All ${formatLiters(rules.waterTargetMl)} L down\`, 'Water goal crushed']`;
  - **reading:** `[\`${rules.pagesTarget} pages smarter 📖\`, 'Brain fed for today', 'Reading done. Nice.']`;
  - **photo:** unchanged.
  
  The rotation (`(dayNumber - 1) % length`) is unchanged.
- Every existing string for Hard stays identical, and `microcopy.test.ts`'s existing expectations stay as they are; they only gain the `RULESETS.hard` argument.

- [ ] **Step 3: Use the copy on the screens**

- **`WorkoutCard`:** the rule line becomes `workoutRuleLine(rules)`.
- **`WaterCard`:** `Goal: ${formatLiters(rules.waterTargetMl)} L a day.` and `of ${formatLiters(rules.waterTargetMl)} L`. For Hard this is still "3.8". Keep the fill maths.
- **`ReadingCard`:** `readingRuleLine(rules)`.
- **`DietCard`:** gains a `rules: Ruleset` prop. The rule line is `dietRuleLine(rules)`, and the diet toggle's label is `dietToggleLabel(rules)`. Task 5 adds the social parts.
- **`TodayScreen`:** passes `rules` to `DietCard`, and `taskCheer(task, todayDayNumber, rules)` for each card.
- **`MissedTasksList`:** `taskRule(task, rules)`.
- **`DayFailedScreen`:** its paragraph is `missedDayExplanation(rulesFor(challenge), challenge.attemptNumber)`.
- **`VictoryScreen`:** `h1` is `victoryTitle(rules)` and the paragraph is `victoryLine(rules)`, with `rules = rulesFor(challenge)`.
- **`PreStartView`:** "…Use the time to pick your book, {preStartPlanLine(rules)} and stock up on water." with `rules = rulesFor(challenge)`.
- **`index.html`:** in the `<meta name="description">`, replace the 75 Hard rule list with "A friendly offline tracker for 75 Hard, 75 Strong, 75 Medium and 75 Soft: log the day's tasks, watch the streak, keep every progress photo on your device." Keep any other meta untouched.

**Test updates:** component tests that render these screens or cards keep their Hard expectations and gain the `rules` prop where needed. Add one `WaterCard` test: with `rules={RULESETS.medium}` it shows "Goal: 3 L a day.".

- [ ] **Step 4: Run the gates, then commit**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

```bash
git add -A src index.html
git commit -F - <<'EOF'
feat: word every rule, cheer and screen for the attempt's challenge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Today — the challenge name, jokers left, the Day-1 hint, recovery days and social occasions

**Files:**
- Create: `src/screens/Today/SocialOccasionSheet.tsx`
- Modify:
  - `src/screens/Today/TodayScreen.tsx`, `WorkoutCard.tsx`, `DietCard.tsx`;
  - `src/App.tsx` (passes `jokersLeft` to `TodayScreen`);
  - `src/lib/dates.ts` (`formatShortDay` and `formatWeekday`).
- Test:
  - `src/screens/Today/__tests__/SocialOccasionSheet.test.tsx`, `DietCard.test.tsx` and `WorkoutCard.test.tsx` (new);
  - `src/lib/__tests__/dates.test.ts`.

**Interfaces:**
- Consumes:
  - `challengeRepo.setSocialDay`, `dayEntryRepo.setRestDay` and their results (Task 2);
  - the Task 4 copy;
  - `challengeWeek`, `rulesFor`, `isStartDateEditable`, `dateForDayNumber` and `dayNumberForDate`.
- Produces:
  ```ts
  // src/lib/dates.ts
  formatShortDay(dateISO: string): string   // "Sat 4 Oct"
  formatWeekday(dateISO: string): string    // "Saturday"
  // SocialOccasionSheet
  SocialOccasionSheet({ open, challenge, today, todayDayNumber, onClose, onDeclared }: {
    open: boolean; challenge: Challenge; today: string; todayDayNumber: number
    onClose: () => void; onDeclared: (dayNumber: number) => void
  })
  // WorkoutCard gains: restDay: boolean; dayEntryId already exists
  // DietCard gains: socialToday: boolean; onPlanSocial: () => void
  // TodayScreen gains the prop jokersLeft: number
  ```

- [ ] **Step 1: Write the failing tests**

**`dates.test.ts`:** `formatShortDay('2026-10-03')` is `'Sat 3 Oct'`, and `formatWeekday('2026-10-03')` is `'Saturday'`.

**`DietCard.test.tsx`:**
- **Hard:** no "🥂 Plan a social occasion" button, and a "No alcohol" toggle.
- **Strong**, with `socialToday={false}`: the button is present and calls `onPlanSocial`.
- **Strong**, with `socialToday={true}`: shows "🥂 Social occasion today — a drink is allowed." and no "No alcohol" toggle.

**`WorkoutCard.test.tsx`**, with the entry seeded in fake-indexeddb because the card writes through the repository:
- **Hard:** no "Take my recovery day".
- **Soft:** the "Take my recovery day" button is present. After tapping it, the stored entry has `restDay: true`.
- **Soft, week taken.** Seed Day 2's entry with `restDay: true` and render Day 3's card. Tapping the button shows "Day 2 was this week's recovery day." in a `role="alert"` line.
- **Soft,** with `restDay={true}`: shows "Recovery day ✓" and an "Undo" button, and Undo clears the stored field.

**`SocialOccasionSheet.test.tsx`**, with a Strong challenge in fake-indexeddb that started today, so this is Day 1:
- it shows the title "Plan a social occasion" and the help line "Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts.";
- the date input has `min` = tomorrow and `max` = Day 75's date;
- picking tomorrow and tapping "Declare" calls `onDeclared(2)` and stores `socialDays: [2]`;
- picking today shows "Declare it the day before at the latest." in a `role="alert"` line;
- with `socialDays: [2]` seeded, picking Day 3's date shows "Week 1 already has one: Day 2.";
- a declared upcoming day is listed as "Sun 4 Oct · Day 2", computed from the seeded dates, with a "Cancel" button that removes it.

Run: FAIL.

- [ ] **Step 2: Implement**

**`src/lib/dates.ts`:**
```ts
/** A short weekday and date, e.g. "Sat 4 Oct". */
export function formatShortDay(dateISO: string): string {
  return isValidISODate(dateISO) ? format(parseISO(dateISO), 'EEE d MMM') : dateISO
}

/** The weekday's full name, e.g. "Saturday". */
export function formatWeekday(dateISO: string): string {
  return isValidISODate(dateISO) ? format(parseISO(dateISO), 'EEEE') : dateISO
}
```

**`SocialOccasionSheet`** uses the existing `Modal` and follows `PlanSheet`'s structure: a `PlanForm`-like inner form that mounts on open.
- **Title:** `h3` "Plan a social occasion".
- **Help line:** "Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts."
- **The picker:** a `Field` labelled "Day" wrapping `<input type="date" min={tomorrow} max={dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)}>`, where tomorrow is `addDaysISO(today, 1)`. Use `aria-label="Day"` on the input, as `PlanSheet` does.
- **Declaring:** a primary "Declare" button (disabled while saving, or when no date is picked) computes `dayNumber = dayNumberForDate(challenge.startDate, picked)` and calls `challengeRepo.setSocialDay(challenge.id, dayNumber, true, today)`.
  - `ok`: call `onDeclared(dayNumber)` and `onClose()`.
  - Otherwise, show the message for the reason in a `role="alert"` line:
    - `too-late`: "Declare it the day before at the latest."
    - `week-taken`: `Week ${challengeWeek(dayNumber)} already has one: Day ${result.dayNumber}.`
    - `out-of-range`: "Pick a day of this challenge."
    - `not-allowed`: "This challenge doesn't allow social occasions."
  - A thrown error: "Couldn't save that — try again." Use `try`/`finally` to reset `saving`, as `PlanSheet` does.
- **The declared list:** "Declared" as a small heading, then one row per declared day with `dayNumber >= todayDayNumber`: `${formatShortDay(dateForDayNumber(start, d))} · Day ${d}`, and a secondary "Cancel" button (`aria-label={\`Cancel Day ${d}\`}`) calling `setSocialDay(…, false, today)`. Read `challenge.socialDays` from the prop. `TodayScreen`'s challenge comes from the live gate, so it updates after a write.
- **Closing:** a secondary "Close" button.

**`WorkoutCard`** gains `restDay: boolean`. When `rules.restDaysPerWeek > 0`, under the workouts list:
- If `restDay`: a pill "Recovery day ✓" (`rounded-full bg-green-light px-3 py-1 font-rounded text-sm font-bold text-green-ink`) and a secondary "Undo" button (`min-h-touch`) calling `dayEntryRepo.setRestDay(dayEntryId, false)`.
- Otherwise: a secondary "Take my recovery day" button (full width, `min-h-touch`) calling `dayEntryRepo.setRestDay(dayEntryId, true)`. On `week-taken`, show `Day ${result.dayNumber} was this week's recovery day.` in a `role="alert"` line below it.

**`DietCard`** gains `socialToday: boolean` and `onPlanSocial: () => void`:
- The alcohol toggle renders only when `!socialToday`. When `socialToday`, show instead `<p className="rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">🥂 Social occasion today — a drink is allowed.</p>`.
- When `rules.socialDaysPerWeek > 0`, show a secondary "🥂 Plan a social occasion" button (full width) calling `onPlanSocial`.

**`TodayScreen`:**
- Compute `socialToday = challenge.socialDays?.includes(todayDayNumber) ?? false`, and pass it with `onPlanSocial={() => setSocialOpen(true)}` to `DietCard`.
- Pass `restDay={entry.restDay === true}` to `WorkoutCard`.
- Render `<SocialOccasionSheet open={socialOpen} challenge={challenge} today={today} todayDayNumber={todayDayNumber} onClose={() => setSocialOpen(false)} onDeclared={(dayNumber) => setAnnouncement((previous) => ({ text: \`${formatWeekday(dateForDayNumber(challenge.startDate, dayNumber))}. One drink. I'm counting.\`, reaction: 'relax', id: (previous?.id ?? 0) + 1 }))} />`.
- **Header:** the attempt line becomes `{VARIANT_NAMES[rules.variant]} · Attempt #{challenge.attemptNumber}`.
- **Jokers chip:** under the XP line, when `rules.jokers > 0`, render `<p className="mt-1 font-rounded text-sm font-extrabold text-orange-ink">🃏 {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'} left</p>`.
- **Day-1 hint:** when `isStartDateEditable(todayDayNumber)`, render under the header: `<p className="px-4 pb-2 font-rounded text-xs text-ink-muted">Doing {VARIANT_NAMES[rules.variant]}. You can switch challenge in Settings until the end of Day 1.</p>`.
- `TodayScreen` gains `jokersLeft: number`, which `App` passes as `gate.jokersLeft`.

- [ ] **Step 3: Run the gates, then commit**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

```bash
git add -A src
git commit -F - <<'EOF'
feat: plan social occasions, take a recovery day and see your jokers on Today

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Choosing the challenge — Settings until Day 1, and after a victory

**Files:**
- Create:
  - `src/components/VariantPicker.tsx`;
  - `src/screens/Victory/NewChallengeSheet.tsx`.
- Modify:
  - `src/screens/Settings/StartDateSection.tsx`;
  - `src/screens/Victory/VictoryScreen.tsx`;
  - `src/App.tsx` (passes `streak` and `missedDays` to `VictoryScreen`).
- Test:
  - `src/components/__tests__/VariantPicker.test.tsx`;
  - `src/screens/Settings/__tests__/StartDateSection.test.tsx` (new);
  - `src/screens/Victory/__tests__/NewChallengeSheet.test.tsx`;
  - `src/screens/Victory/__tests__/VictoryScreen.test.tsx` (new, if none exists).

**Interfaces:**
- Consumes: `challengeRepo.changeVariant`, `challengeRepo.startNew(startDate, variant)` (Task 2); `VARIANT_NAMES` and `VARIANT_SUMMARIES` (Task 4).
- Produces:
  ```ts
  VariantPicker({ value, onChange, disabled }: { value: ChallengeVariant; onChange: (v: ChallengeVariant) => void; disabled?: boolean })
  NewChallengeSheet({ open, onClose, defaultVariant, today }: { open: boolean; onClose: () => void; defaultVariant: ChallengeVariant; today: string })
  // VictoryScreen gains: streak: number; missedDays: number[]
  ```

- [ ] **Step 1: Write the failing tests**

**`VariantPicker`:**
- It renders a `radiogroup` labelled "Challenge", with four `radio`s named by `VARIANT_NAMES`. Each shows its summary.
- The checked one is `value`.
- Tapping "75 Soft" calls `onChange('soft')`.
- `disabled` disables all four.

**`StartDateSection`**, with a challenge in fake-indexeddb:
- On Day 1, the section heading is "Challenge". Choosing "75 Medium" stores `variant: 'medium'`.
- On Day 3, the picker isn't shown. The line "75 Hard — locked for this attempt." is shown instead.

**`NewChallengeSheet`:**
- The picker defaults to `defaultVariant`.
- The start choices are "Today", "Tomorrow" and a date input with `min` = today.
- "Start" calls `challengeRepo.startNew(<chosen date>, <chosen variant>)` and closes. Check it through the stored row: a new active attempt with that variant and start date.

**`VictoryScreen`**, with a completed Medium challenge:
- the title "75 Medium complete! 🏆";
- the streak stat shows the `streak` prop;
- a "Jokers used" stat shows `1/1` when `missedDays={[12]}`.

A Hard victory shows no "Jokers used" stat.

Run: FAIL.

- [ ] **Step 2: Implement**

**`VariantPicker`:** a `div` with `role="radiogroup"` and `aria-label="Challenge"`, holding four buttons with `role="radio"` and `aria-checked`, one per `VARIANTS` entry. Each is a card: `min-h-touch w-full rounded-2xl p-3 text-left`, with the name in `font-rounded font-extrabold text-ink` and the summary in `text-sm text-ink-muted`. The checked one has `ring-2 ring-green-ink bg-green-light`; the others have `bg-canvas`. Focus-visible outline, as elsewhere. Don't add hover styles.

**`StartDateSection`:**
- The `h2` becomes "Challenge". Keep the start-date line.
- When `editable`, render `<VariantPicker value={variantOf(challenge)} onChange={(v) => void changeVariant(v)} disabled={switching} />` above the date row. `changeVariant` calls `challengeRepo.changeVariant(challenge.id, v, today)`. On `locked`, show `REJECTION_MESSAGES.locked` in the existing error line.
- Add a note under the picker: "You can switch until the end of Day 1."
- When not editable, add `<p className="mt-3 …">{VARIANT_NAMES[variantOf(challenge)]} — locked for this attempt.</p>` next to the existing locked line.

**`NewChallengeSheet`:**
- Uses the `Modal`, with the title `h3` "Start a new challenge".
- `VariantPicker` holds its state, starting at `defaultVariant`.
- The start choice is a radio group of three pill buttons: "Today" (the default), "Tomorrow", and "Pick a date", which reveals `<input type="date" min={today} aria-label="Start date">`.
- The line: `A new attempt starts on ${formatDisplayDate(startDate)}. Every photo and stat from this one stays saved.`
- Primary "Start" button ("Starting…" while busy) and secondary "Cancel". "Start" calls `challengeRepo.startNew(startDate, variant)`, then `onClose()`. On a thrown error, show "Couldn't start it — try again." in a `role="alert"` line, and reset busy in `finally`.

**`VictoryScreen`:**
- Takes `streak` and `missedDays` props.
- The streak stat shows `🔥 ${streak}`.
- When `rules.jokers > 0`, add `<VictoryStat label="Jokers used" value={\`${missedDays.length}/${rules.jokers}\`} />`.
- "Start a new challenge" now opens `NewChallengeSheet` with `defaultVariant={variantOf(challenge)}`, and no longer calls `startNew(today)` directly.
- The small line under the button becomes "Pick your next challenge and when it starts."

**`App.tsx`:** pass `streak={gate.streak}` and `missedDays={gate.missedDays}` to `VictoryScreen`.

- [ ] **Step 3: Run the gates, then commit**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

```bash
git add -A src
git commit -F - <<'EOF'
feat: pick the challenge in Settings until Day 1, and choose the next one after a victory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Dev scenarios, the README and the spec amendments

**Files:**
- Modify:
  - `src/dev/scenarios.ts`;
  - `README.md`;
  - `docs/superpowers/specs/2026-09-26-challenge-variants-design.md` (the two amendments listed at the top of this plan).

- [ ] **Step 1: Add the scenarios**

Each scenario follows the existing seeds' style: `replaceDatabase`, `perfectDay` and `todayISO`/`addDaysISO`. Seeds write `variant` directly on the challenge.

- **`seedStrongSocial()`:** a 75 Strong attempt on Day 3 (started 2 days ago), with Days 1–2 perfect. Day 3 has `socialDays: [3]` written directly, `dietFollowed` true and `noAlcohol` false, so Today shows the social-occasion note and a complete diet.
- **`seedMediumJoker()`:** a 75 Medium attempt on Day 5 (started 4 days ago). Days 1, 2 and 4 are perfect, Day 3 has no entry, and `jokersAcknowledged` is unset. The app opens on the joker screen.
- **`seedSoftRestDay()`:** a 75 Soft attempt on Day 2 (started 1 day ago), with Day 1 perfect. Day 2's entry has `restDay: true`, and its other tasks are done except the photo.
- **`seedDay77Complete()`:** a variant-less (Hard) attempt that started 76 days ago, with `status: 'active'` and all 75 days perfect. It opens on Victory: this is the Day-77 fix.

- [ ] **Step 2: Update the README**

**Features:** add a bullet after the Today bullet:

```markdown
- **Four challenges** — pick yours when you start, or until the end of Day 1 (Settings → Challenge):

  | | 75 Hard | 75 Strong | 75 Medium | 75 Soft |
  |---|---|---|---|---|
  | Workouts | 2 × 45 min, one outdoors | as Hard | 1 × 45 min | 1 × 45 min + a recovery day a week |
  | Diet | strict, no alcohol | strict; a drink on a social occasion declared the day before (one a week) | eat healthy; same social rule | as Medium |
  | Water | 3.8 L | 3.8 L | 3 L | 3 L |
  | Reading | 10 pages, non-fiction | as Hard | 10 pages, any book | as Medium |
  | Photo | daily | daily | daily | daily |
  | Missed day | back to Day 1 | back to Day 1 | 1 joker | 3 jokers |
```

**Dev scenarios table:** add the four new scenarios, one line each, e.g. "`seedMediumJoker()` | 75 Medium on Day 5 with Day 3 missed: opens on the joker screen."

- [ ] **Step 3: Amend the spec**

In §8 "Diet card", replace the sheet description with: the sheet has a date picker (tomorrow to Day 75) and a "Declare" button. It lists the declared occasions from today on, each with "Cancel". Errors explain `too-late` and `week-taken`.

In §10, add a row "Water amount | 3.8 | 3.8 | 3 | 3", noting that litres print without a trailing ".0".

- [ ] **Step 4: Run all the gates**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`
Expected: all pass, and the build writes `dist/sw.js`.

- [ ] **Step 5: Commit**

```bash
git add src/dev/scenarios.ts README.md docs/superpowers/specs/2026-09-26-challenge-variants-design.md
git commit -F - <<'EOF'
docs: describe the four challenges, add their dev scenarios, and amend the spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
