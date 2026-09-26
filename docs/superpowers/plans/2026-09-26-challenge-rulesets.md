# Challenge Rulesets (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take every challenge rule from a per-attempt ruleset instead of global constants. Only 75 Hard is reachable, and nothing visible changes.

**Architecture:**
- A pure module, `src/logic/rulesets.ts`, defines `RULESETS` for hard, strong, medium and soft.
- Logic functions take `rules` as a **required** parameter.
- The database layer reads each entry's challenge to find its rules.
- Screens compute `rulesFor(challenge)` once and pass it down.
- The gate counts missed days only up to Day 75, and takes a `jokers` count (0 for every attempt until PR 2).

**Tech Stack:** React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedParameters`), Dexie 4 with dexie-react-hooks, Vitest 5 + jsdom + fake-indexeddb, Testing Library, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-26-challenge-variants-design.md`, §4, §5, §6 and §11 (PR 1).

## Global Constraints

- **No behaviour change for 75 Hard.**
  - Every existing test keeps its expectations; it only gains a `RULESETS.hard` argument where a signature changed.
  - The one intended change is the Day-77 fix (spec §6): a fully complete attempt opened for the first time on Day 77 or later is completed, not failed.
- **No Dexie version bump, and no new field written.** `Challenge.variant` is typed and validated on import, but nothing writes it in this PR.
- **`rules` has no default value** anywhere it is added. It is added only where the function uses it, because `noUnusedParameters` is on.
- **The constants `WATER_TARGET_ML`, `PAGES_TARGET`, `MIN_WORKOUT_MIN` and `REQUIRED_QUALIFYING_WORKOUTS` are deleted** from `src/logic/constants.ts`.
- **Every transaction that calls `syncDayCompletion` includes `db.challenges`.** Use the shared `COMPLETION_TABLES`.
- **UI copy is unchanged** (English).
- **Every commit message ends with exactly:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Gates for every task:** `npx tsc -b`, `npm run lint` and `npm run test`. The last task also runs `npm run build`.

---

### Task 1: The rulesets module

**Files:**
- Create: `src/logic/rulesets.ts`
- Test: `src/logic/__tests__/rulesets.test.ts`

**Interfaces:**
- Produces: `ChallengeVariant`, `Ruleset`, `VARIANTS`, `RULESETS`, `isChallengeVariant(value)`, `variantOf(challenge)`, `rulesFor(challenge)`, `challengeWeek(dayNumber)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/logic/__tests__/rulesets.test.ts
import { describe, expect, it } from 'vitest'
import { challengeWeek, isChallengeVariant, RULESETS, rulesFor, variantOf, VARIANTS } from '../rulesets'

describe('rulesets', () => {
  it('keeps 75 Hard exactly as it was', () => {
    expect(RULESETS.hard).toEqual({
      variant: 'hard',
      requiredWorkouts: 2,
      requireOutdoor: true,
      minWorkoutMin: 45,
      waterTargetMl: 3800,
      pagesTarget: 10,
      restDaysPerWeek: 0,
      socialDaysPerWeek: 0,
      jokers: 0,
      dietKind: 'strict',
      readingKind: 'non-fiction',
    })
  })

  it('makes 75 Strong a 75 Hard with one social occasion a week', () => {
    expect(RULESETS.strong).toEqual({ ...RULESETS.hard, variant: 'strong', socialDaysPerWeek: 1 })
  })

  it('gives Medium one workout, 3 L, any book, a social occasion a week and one joker', () => {
    expect(RULESETS.medium).toEqual({
      variant: 'medium',
      requiredWorkouts: 1,
      requireOutdoor: false,
      minWorkoutMin: 45,
      waterTargetMl: 3000,
      pagesTarget: 10,
      restDaysPerWeek: 0,
      socialDaysPerWeek: 1,
      jokers: 1,
      dietKind: 'healthy',
      readingKind: 'any',
    })
  })

  it('makes Soft a Medium with a recovery day a week and three jokers', () => {
    expect(RULESETS.soft).toEqual({ ...RULESETS.medium, variant: 'soft', restDaysPerWeek: 1, jokers: 3 })
  })

  it('lists the variants from hardest to softest', () => {
    expect(VARIANTS).toEqual(['hard', 'strong', 'medium', 'soft'])
  })

  it('treats a missing or unknown variant as 75 Hard', () => {
    expect(variantOf({})).toBe('hard')
    expect(variantOf({ variant: undefined })).toBe('hard')
    expect(variantOf({ variant: 'extreme' })).toBe('hard')
    expect(variantOf({ variant: 42 })).toBe('hard')
    expect(variantOf({ variant: 'soft' })).toBe('soft')
    expect(rulesFor({ variant: 'medium' })).toBe(RULESETS.medium)
    expect(rulesFor({})).toBe(RULESETS.hard)
  })

  it('recognises the four variant ids only', () => {
    for (const variant of VARIANTS) expect(isChallengeVariant(variant)).toBe(true)
    expect(isChallengeVariant('Hard')).toBe(false)
    expect(isChallengeVariant(null)).toBe(false)
  })

  it('groups days into challenge weeks of seven, the last one short', () => {
    expect(challengeWeek(1)).toBe(1)
    expect(challengeWeek(7)).toBe(1)
    expect(challengeWeek(8)).toBe(2)
    expect(challengeWeek(70)).toBe(10)
    expect(challengeWeek(71)).toBe(11)
    expect(challengeWeek(75)).toBe(11)
  })
})
```

- [ ] **Step 2: Run the test to check it fails**

Run: `npx vitest run src/logic/__tests__/rulesets.test.ts`
Expected: FAIL, because `../rulesets` cannot be resolved.

- [ ] **Step 3: Write the module**

```ts
// src/logic/rulesets.ts
/** The four challenges an attempt can be, hardest first. */
export type ChallengeVariant = 'hard' | 'strong' | 'medium' | 'soft'

/**
 * Every rule that differs between the challenges. The table is in section 2
 * of docs/superpowers/specs/2026-09-26-challenge-variants-design.md.
 */
export interface Ruleset {
  variant: ChallengeVariant
  /** Qualifying workouts needed each day. */
  requiredWorkouts: number
  /** Whether one of the qualifying workouts must be outdoors. */
  requireOutdoor: boolean
  /** The minutes a workout needs to qualify. */
  minWorkoutMin: number
  waterTargetMl: number
  pagesTarget: number
  /** Recovery days allowed per challenge week (the workouts task counts as done). */
  restDaysPerWeek: number
  /** Declared social occasions allowed per challenge week (a drink is allowed). */
  socialDaysPerWeek: number
  /** Missed days forgiven before the attempt fails. */
  jokers: number
  dietKind: 'strict' | 'healthy'
  readingKind: 'non-fiction' | 'any'
}

export const VARIANTS: readonly ChallengeVariant[] = ['hard', 'strong', 'medium', 'soft']

const HARD: Ruleset = {
  variant: 'hard',
  requiredWorkouts: 2,
  requireOutdoor: true,
  minWorkoutMin: 45,
  waterTargetMl: 3800,
  pagesTarget: 10,
  restDaysPerWeek: 0,
  socialDaysPerWeek: 0,
  jokers: 0,
  dietKind: 'strict',
  readingKind: 'non-fiction',
}

const MEDIUM: Ruleset = {
  variant: 'medium',
  requiredWorkouts: 1,
  requireOutdoor: false,
  minWorkoutMin: 45,
  waterTargetMl: 3000,
  pagesTarget: 10,
  restDaysPerWeek: 0,
  socialDaysPerWeek: 1,
  jokers: 1,
  dietKind: 'healthy',
  readingKind: 'any',
}

export const RULESETS: Readonly<Record<ChallengeVariant, Ruleset>> = {
  hard: HARD,
  strong: { ...HARD, variant: 'strong', socialDaysPerWeek: 1 },
  medium: MEDIUM,
  soft: { ...MEDIUM, variant: 'soft', restDaysPerWeek: 1, jokers: 3 },
}

export function isChallengeVariant(value: unknown): value is ChallengeVariant {
  return typeof value === 'string' && (VARIANTS as readonly string[]).includes(value)
}

/** A challenge's variant. Missing or unknown means 75 Hard: every attempt made before variants existed. */
export function variantOf(challenge: { variant?: unknown }): ChallengeVariant {
  return isChallengeVariant(challenge.variant) ? challenge.variant : 'hard'
}

/** The rules a challenge is judged by. */
export function rulesFor(challenge: { variant?: unknown }): Ruleset {
  return RULESETS[variantOf(challenge)]
}

/** The challenge week of a day: days 1–7 are week 1, …, days 71–75 week 11. */
export function challengeWeek(dayNumber: number): number {
  return Math.ceil(dayNumber / 7)
}
```

- [ ] **Step 4: Run the test to check it passes**

Run: `npx vitest run src/logic/__tests__/rulesets.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/logic/rulesets.ts src/logic/__tests__/rulesets.test.ts
git commit -F - <<'EOF'
feat: add the challenge rulesets (75 Hard, Strong, Medium and Soft)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: The logic module takes the rules

**Files:**
- Modify:
  - `src/logic/constants.ts`: delete the four rule constants.
  - `src/logic/dayCompletion.ts`, `menace.ts`, `xp.ts`, `stats.ts`, `badges.ts`, `attempts.ts`.
  - `src/content/microcopy.ts`.
  - Every caller, which passes `RULESETS.hard` for now. Tasks 3 and 4 replace that with each attempt's own rules. The callers are:
    - `src/db/completion.ts`, `src/db/normalize.ts`, `src/db/badgeEvaluation.ts`;
    - `src/hooks/useDayCompletion.ts`, `src/hooks/useMenace.ts`, `src/hooks/useChallengeStats.ts`, `src/hooks/useAttemptSummaries.ts`;
    - `src/screens/Today/PlanSheet.tsx`, `WorkoutCard.tsx`, `WaterCard.tsx`, `ReadingCard.tsx`;
    - `src/screens/RestartFlow/DayFailedScreen.tsx`;
    - `src/screens/Settings/AttemptHistorySection.tsx` (for `attemptDayRows`);
    - `src/dev/scenarios.ts`;
    - the tests.

**Interfaces:**
- Consumes: `Ruleset`, `RULESETS` (Task 1).
- Produces the new signatures, which later tasks rely on:
  ```ts
  isQualifyingWorkout(workout: WorkoutTaskData, rules: Ruleset): boolean
  isWorkoutsTaskComplete(data: DayTaskData, rules: Ruleset): boolean
  isWaterTaskComplete(data: DayTaskData, rules: Ruleset): boolean
  isReadingTaskComplete(data: DayTaskData, rules: Ruleset): boolean
  taskCompletionMap(data: DayTaskData, rules: Ruleset): Record<TaskId, boolean>
  isDayComplete(data: DayTaskData, rules: Ruleset): boolean
  missingTasks(data: DayTaskData, rules: Ruleset): TaskId[]
  minutesToFinish(task: TaskId, data: DayTaskData, rules: Ruleset): number
  planError(task: TaskId, time: string, data: DayTaskData, nowMin: number, rules: Ruleset): PlanError | null
  menace({ data, nowMin, bedtimeMin, plans, estimates, rules }: MenaceInput): Menace   // MenaceInput gains `rules: Ruleset`
  calculateDayXp(data: DayTaskData, streakLengthAfterThisDay: number, rules: Ruleset): XpBreakdown
  calculateChallengeXp(days: readonly ChallengeDayData[], rules: Ruleset): number
  calculateChallengeStats(days: readonly ChallengeDayData[], rules: Ruleset): ChallengeStats
  buildBadgeContext({ days, todayDayNumber, booksFinished, rules }): BadgeContext
  summarizeAttempt({ startDate, status, days, todayDayNumber, rules }): AttemptSummary
  attemptDayRows(days: readonly ChallengeDayData[], reachedDay: number, rules: Ruleset): AttemptDayRow[]
  ```
  - `isDietTaskComplete(data)` and `isPhotoTaskComplete(data)` keep their signatures: they don't use a rule yet.
  - `hasAnyProgress(data)`, `completedDayXp(streak)` and `streakMilestoneBonus(n)` are unchanged.

- [ ] **Step 1: Write the failing tests that only the new signatures can pass**

Add to `src/logic/__tests__/dayCompletion.test.ts`:

```ts
import { RULESETS } from '../rulesets'

describe('completion under 75 Medium rules', () => {
  const medium = RULESETS.medium
  const base = { water_ml: 3000, pages_read: 10, dietFollowed: true, noAlcohol: true, hasPhoto: true }

  it('counts one indoor 45-minute workout', () => {
    const data = { ...base, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(isWorkoutsTaskComplete(data, medium)).toBe(true)
    expect(isWorkoutsTaskComplete(data, RULESETS.hard)).toBe(false)
  })

  it('completes the water at 3 L', () => {
    const data = { ...base, workouts: [] }
    expect(isWaterTaskComplete(data, medium)).toBe(true)
    expect(isWaterTaskComplete(data, RULESETS.hard)).toBe(false)
  })

  it('completes a whole day on Medium targets', () => {
    const data = { ...base, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(isDayComplete(data, medium)).toBe(true)
    expect(missingTasks(data, RULESETS.hard)).toEqual(['workouts', 'water'])
  })
})
```

Add to `src/logic/__tests__/menace.test.ts` (next to the `minutesToFinish` tests):

```ts
it('estimates water toward the ruleset target', () => {
  const data = { ...DONE, water_ml: 2100 }
  expect(minutesToFinish('water', data, RULESETS.medium)).toBe(54)
  expect(minutesToFinish('water', data, RULESETS.hard)).toBe(102)
})

it('needs one workout on Medium rules, where Hard needs two', () => {
  const data = { ...DONE, workouts: [] }
  expect(minutesToFinish('workouts', data, RULESETS.medium)).toBe(45)
  expect(minutesToFinish('workouts', data, RULESETS.hard)).toBe(90)
})
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/logic/__tests__/dayCompletion.test.ts src/logic/__tests__/menace.test.ts`
Expected: FAIL. The functions ignore the extra argument, so the Medium expectations fail.

- [ ] **Step 3: Rewrite `src/logic/dayCompletion.ts` to take the rules**

```ts
import type { Ruleset } from './rulesets'
import type { DayTaskData, TaskId, WorkoutTaskData } from './types'

/** The five daily tasks, in display order. */
export const TASK_IDS: readonly TaskId[] = ['workouts', 'diet', 'water', 'reading', 'photo']

/** Whether a single workout lasts long enough to count toward the day's workouts. */
export function isQualifyingWorkout(workout: WorkoutTaskData, rules: Ruleset): boolean {
  return workout.durationMin >= rules.minWorkoutMin
}

export function isWorkoutsTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  const qualifying = data.workouts.filter((workout) => isQualifyingWorkout(workout, rules))
  return qualifying.length >= rules.requiredWorkouts && (!rules.requireOutdoor || qualifying.some((w) => w.isOutdoor))
}

export function isDietTaskComplete(data: DayTaskData): boolean {
  return data.dietFollowed && data.noAlcohol
}

export function isWaterTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  return data.water_ml >= rules.waterTargetMl
}

export function isReadingTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  return data.pages_read >= rules.pagesTarget
}

export function isPhotoTaskComplete(data: DayTaskData): boolean {
  return data.hasPhoto
}

/** Per-task completion state, keyed by task id. */
export function taskCompletionMap(data: DayTaskData, rules: Ruleset): Record<TaskId, boolean> {
  return {
    workouts: isWorkoutsTaskComplete(data, rules),
    diet: isDietTaskComplete(data),
    water: isWaterTaskComplete(data, rules),
    reading: isReadingTaskComplete(data, rules),
    photo: isPhotoTaskComplete(data),
  }
}

/** A day is complete only if every one of the five tasks is complete. */
export function isDayComplete(data: DayTaskData, rules: Ruleset): boolean {
  return Object.values(taskCompletionMap(data, rules)).every(Boolean)
}

/** Task ids that are not yet complete, in the fixed display order. */
export function missingTasks(data: DayTaskData, rules: Ruleset): TaskId[] {
  const map = taskCompletionMap(data, rules)
  return TASK_IDS.filter((task) => !map[task])
}

// hasAnyProgress stays exactly as it is.
```

- [ ] **Step 4: Thread the rules through the rest of the logic module**

- **`src/logic/constants.ts`:** delete the lines for `WATER_TARGET_ML`, `PAGES_TARGET`, `MIN_WORKOUT_MIN` and `REQUIRED_QUALIFYING_WORKOUTS`. Keep everything else.
- **`src/logic/menace.ts`:**
  - Drop the constants import, and add `import type { Ruleset } from './rulesets'`.
  - `workoutsStillNeeded(data, rules)` uses `rules.requiredWorkouts`. The "one more if none is outdoors" branch applies only when `rules.requireOutdoor` is set:
    ```ts
    function workoutsStillNeeded(data: DayTaskData, rules: Ruleset): number {
      const qualifying = data.workouts.filter((workout) => isQualifyingWorkout(workout, rules))
      const missing = Math.max(0, rules.requiredWorkouts - qualifying.length)
      if (missing > 0) return missing
      return !rules.requireOutdoor || qualifying.some((workout) => workout.isOutdoor) ? 0 : 1
    }
    ```
  - `minutesToFinish(task, data, rules)`:
    - workouts: `workoutsStillNeeded(data, rules) * rules.minWorkoutMin`;
    - water: `rules.waterTargetMl`;
    - reading: `rules.pagesTarget`.
  - `planError(task, time, data, nowMin, rules)` passes `rules` on.
  - `MenaceInput` gains `rules: Ruleset`. `menace` passes it to `missingTasks` and to every `minutesToFinish`.
  - Update the doc comment on `workoutsStillNeeded`: "Qualifying workouts still to do, or one more if the rules want one outdoors and none is."
- **`src/logic/xp.ts`:** `calculateDayXp(data, streak, rules)` and `calculateChallengeXp(days, rules)` pass `rules` to `taskCompletionMap` and `isDayComplete`.
- **`src/logic/stats.ts`:** `calculateChallengeStats(days, rules)`.
- **`src/logic/badges.ts`:**
  - `buildBadgeContext` takes `rules: Ruleset` in its params object, and passes it to `isDayComplete` and `isQualifyingWorkout`.
  - `waterGoalDays` compares with `params.rules.waterTargetMl`.
  - Drop `WATER_TARGET_ML` from the constants import.
- **`src/logic/attempts.ts`:** `summarizeAttempt` takes `rules` in its params and passes it to `isDayComplete` and `calculateChallengeXp`. `attemptDayRows(days, reachedDay, rules)` passes it to `missingTasks`.
- **`src/content/microcopy.ts`:**
  - Replace the constants import with `import { RULESETS } from '../logic/rulesets'`.
  - Build `TASK_RULES` and the water and reading cheers from `RULESETS.hard`. The strings must come out character for character the same. The water cheer's `${WATER_TARGET_ML / 1000}` becomes `${RULESETS.hard.waterTargetMl / 1000}`, still "3.8"; the same goes for the pages and the workouts line.
  - PR 2 makes this copy variant-aware.

- [ ] **Step 5: Update every caller to pass `RULESETS.hard` (temporary; Tasks 3 and 4 replace it)**

Import `RULESETS` from the logic module in each file:
- **`src/db/completion.ts`:** `isDayComplete(toDayTaskData(entry, workouts), RULESETS.hard)`.
- **`src/db/normalize.ts`:** `isDayComplete(toDayTaskData(merged, entryWorkouts), RULESETS.hard)`.
- **`src/db/badgeEvaluation.ts`:** `buildBadgeContext({ …, rules: RULESETS.hard })`.
- **`src/hooks/useDayCompletion.ts`:** pass `RULESETS.hard` to the three calls.
- **`src/hooks/useMenace.ts`:** `menace({ …, rules: RULESETS.hard })`.
- **`src/hooks/useChallengeStats.ts`:** `calculateChallengeStats(days, RULESETS.hard)`.
- **`src/hooks/useAttemptSummaries.ts`:** `summarizeAttempt({ …, rules: RULESETS.hard })`.
- **`src/screens/Settings/AttemptHistorySection.tsx`:** `attemptDayRows(…, RULESETS.hard)`.
- **`src/screens/Today/PlanSheet.tsx`:** pass `RULESETS.hard` to `planError` and `minutesToFinish`.
- **`src/screens/Today/WorkoutCard.tsx`:** `RULESETS.hard.minWorkoutMin` for the new workout's default duration and in the copy, and `RULESETS.hard.requiredWorkouts` in the copy. `MAX_WORKOUTS` stays.
- **`src/screens/Today/WaterCard.tsx`:** `RULESETS.hard.waterTargetMl`.
- **`src/screens/Today/ReadingCard.tsx`:** `RULESETS.hard.pagesTarget`.
- **`src/screens/RestartFlow/DayFailedScreen.tsx`:** `missingTasks(…, RULESETS.hard)`.
- **`src/dev/scenarios.ts`:** `RULESETS.hard.waterTargetMl`, `.pagesTarget` and `.minWorkoutMin` in place of the constants.
- **Tests:**
  - Replace the deleted constants with the `RULESETS.hard` fields, in `src/db/__tests__/fixtures.ts`, `src/logic/__tests__/menace.test.ts`, `src/hooks/__tests__/useMenace.test.ts` and `src/screens/Today/__tests__/PlanSheet.test.tsx`.
  - Pass `RULESETS.hard` wherever a changed function is called in `dayCompletion.test.ts`, `menace.test.ts`, `xp.test.ts`, `stats.test.ts`, `badges.test.ts` and `attempts.test.ts`.
  - **Change no expected value.**

Run: `npx tsc -b`
Expected: no output. Any error names a caller still to update. Fix it the same way.

- [ ] **Step 6: Run the gates**

Run: `npx vitest run src/logic src/content` and then `npm run lint && npm run test`.
Expected: all pass, including the Step 1 tests. The test count is the old count plus 5.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -F - <<'EOF'
refactor: pass a ruleset to every rule check (75 Hard everywhere for now)

The rule constants are gone; completion, the menace estimates, XP, stats,
badges and attempt summaries take the rules as a parameter. Every caller
passes 75 Hard's until the attempts carry their own.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: The database judges each day by its attempt's rules

**Files:**
- Modify:
  - `src/db/types.ts`;
  - `src/db/completion.ts`;
  - `src/db/repositories/dayEntryRepo.ts`, `workoutRepo.ts`, `photoRepo.ts`;
  - `src/db/normalize.ts`;
  - `src/db/challengeDays.ts`;
  - `src/db/badgeEvaluation.ts`;
  - `src/hooks/useChallengeStats.ts`;
  - `src/hooks/useAttemptSummaries.ts`;
  - `src/db/exportImport.ts`.
- Test:
  - `src/db/__tests__/repositories.test.ts`;
  - `src/db/__tests__/exportImport.test.ts`.

**Interfaces:**
- Consumes: `rulesFor`, `isChallengeVariant` (Task 1); the Task 2 signatures.
- Produces:
  - `Challenge.variant?: ChallengeVariant`;
  - `COMPLETION_TABLES` from `src/db/completion.ts`;
  - `loadChallengeDays(challengeId)`, now returning `{ rules: Ruleset; days: ChallengeDayData[] }`.

- [ ] **Step 1: Write the failing tests**

In `src/db/__tests__/repositories.test.ts`, add a `describe('completion follows the attempt's rules')`. It uses the existing fixtures (`freshDatabase`, `addChallenge`) and runs every write path that syncs completion, for an attempt stored with `variant: 'medium'`.

The test body:
- Create a challenge `{ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'medium' }`, and `dayEntryRepo.getOrCreate` Day 1.
- Tick the diet: `dayEntryRepo.update(id, { dietFollowed: true, noAlcohol: true })`. Use whichever `dayEntryRepo` method the file already uses for these fields.
- `dayEntryRepo.adjustWater(id, 3000)` and `dayEntryRepo.adjustPages(id, 10)`.
- `workoutRepo.add({ dayEntryId: id, type: 'Weights', durationMin: 45, isOutdoor: false })`.
- Attach a photo with `photoRepo`'s existing attach method, as the photo tests do.
- Expect `(await db.dayEntries.get(id))!.completed` to be `true`. Under Hard rules it would stay `false`: one indoor workout, 3 L.
- Then `workoutRepo.remove(<that workout id>)` and expect `completed` to be `false` again. This covers the remove path.

Add a second test: an attempt with **no** `variant` behaves as Hard. With the same logging, `completed` stays `false`.

In `src/db/__tests__/exportImport.test.ts`, add:
- a backup whose challenge has `variant: 'soft'` round-trips and keeps it;
- a backup whose challenge has `variant: 'extreme'` is rejected, the way the existing invalid-status test is.

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts`
Expected: FAIL. Completion still uses Hard rules, and `'extreme'` still imports.

- [ ] **Step 3: Implement**

**`src/db/types.ts`:** add to `Challenge`:
```ts
/** Which challenge this attempt is. Missing means 75 Hard (attempts made before variants existed). */
variant?: ChallengeVariant
```
Add `import type { ChallengeVariant } from '../logic/rulesets'`.

**`src/db/completion.ts`:**
```ts
import { isDayComplete } from '../logic/dayCompletion'
import { rulesFor } from '../logic/rulesets'
import { db } from './db'
import { toDayTaskData } from './mappers'

/** The tables a transaction must cover to call syncDayCompletion. */
export const COMPLETION_TABLES = [db.dayEntries, db.workouts, db.challenges]

/**
 * Recomputes a DayEntry's persisted `completed` flag from its data, its
 * workouts and its attempt's rules. Call it inside the same read-write
 * transaction (over COMPLETION_TABLES) as the change that may affect
 * completion, so the flag can never disagree with the data it summarizes.
 */
export async function syncDayCompletion(entryId: number): Promise<void> {
  const entry = await db.dayEntries.get(entryId)
  if (!entry) return
  const challenge = await db.challenges.get(entry.challengeId)
  const workouts = await db.workouts.where('dayEntryId').equals(entryId).toArray()
  const completed = isDayComplete(toDayTaskData(entry, workouts), rulesFor(challenge ?? {}))
  if (completed !== entry.completed) {
    await db.dayEntries.update(entryId, { completed })
  }
}
```

**The repositories:**
- In `dayEntryRepo.ts`, the `changeAndSync` helper's transaction becomes `db.transaction('rw', COMPLETION_TABLES, async () => { … })`.
- In `workoutRepo.ts`, both transactions do the same.
- In `photoRepo.ts`, the transaction becomes `[db.photos, ...COMPLETION_TABLES]`.
- Leave `getOrCreate`'s own transaction alone: it doesn't sync.

**`src/db/normalize.ts`:** the function that recomputes `completed` for merged entries (around line 160) gets the attempts' rules. Pass in `rulesByChallenge: Map<number, Ruleset>`, built in `normalizeRecords` from the normalized challenges as `new Map(challenges.map((c) => [c.id, rulesFor(c)]))`, and use `rulesByChallenge.get(entry.challengeId) ?? RULESETS.hard`.

**`src/db/challengeDays.ts`:**
- `loadChallengeDays(challengeId)` also reads the challenge with `challengeRepo.getById(challengeId)`, and returns `{ rules: rulesFor(challenge ?? {}), days }`. Update its doc comment.
- Callers:
  - `useChallengeStats` does `const { rules, days } = await loadChallengeDays(id)` and then `calculateChallengeStats(days, rules)`.
  - `badgeEvaluation.ts` uses its `challenge` argument, `rulesFor(challenge)`, and keeps using `days` from the loader.

**`src/hooks/useAttemptSummaries.ts`:** `summarizeAttempt({ …, rules: rulesFor(challenge) })`.

**`src/screens/Settings/AttemptHistorySection.tsx`:** `attemptDayRows(…, rulesFor(record.challenge))`. Use the variable the file already has for the attempt record.

**`src/db/exportImport.ts`:** in `ROW_CHECKS.challenges`, add `variant: isOptional(isChallengeVariant)`.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npx vitest run src/db` and then `npx tsc -b && npm run lint && npm run test`.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -F - <<'EOF'
feat: judge each day by its own attempt's rules

syncDayCompletion reads the entry's challenge (every syncing transaction now
covers the challenges table), and stats, badges, attempt summaries and import
repair use each attempt's ruleset. A challenge without a variant is 75 Hard.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: The screens take the rules from the attempt

**Files:**
- Modify:
  - `src/screens/Today/TodayScreen.tsx`, `WorkoutCard.tsx`, `WaterCard.tsx`, `ReadingCard.tsx`, `PlanSheet.tsx`;
  - `src/hooks/useDayCompletion.ts`, `useMenace.ts`;
  - `src/screens/RestartFlow/DayFailedScreen.tsx`.
- Test:
  - `src/screens/Today/__tests__/PlanSheet.test.tsx`;
  - `src/hooks/__tests__/useMenace.test.ts`.

**Interfaces:**
- Consumes: `rulesFor`, `Ruleset` (Task 1); the Task 2 signatures.
- Produces:
  - `useDayCompletion(entry, workouts, rules)`;
  - `useMenace(data, entry, nowMin, rules)`;
  - a `rules: Ruleset` prop on `PlanSheet`, `WorkoutCard`, `WaterCard` and `ReadingCard`.

- [ ] **Step 1: Write the failing test**

In `src/screens/Today/__tests__/PlanSheet.test.tsx`, add a test. `setup()` passes `rules`, defaulting to `RULESETS.hard`:
- Render with `rules={RULESETS.medium}`, `missing={['water']}` and data with `water_ml: 0`.
- Set Water to `21:00` and save.
- Expect the stored `planEstimates.water` to be `180` (3 L at 60 min per litre). Under Hard rules it would be 228.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/Today/__tests__/PlanSheet.test.tsx`
Expected: FAIL. `PlanSheet` has no `rules` prop yet, so tsc under Vitest either reports an unknown prop or the estimate is 228.

- [ ] **Step 3: Implement**

- **`TodayScreen.tsx`** (`TodayTasks`): add `const rules = rulesFor(challenge)` near the top, and pass it to:
  - `useDayCompletion(entry, workouts, rules)`;
  - `useMenace(completion?.data, entry, nowMin, rules)`;
  - `<PlanSheet … rules={rules} />`;
  - `<WorkoutCard … rules={rules} />`, `<WaterCard … rules={rules} />` and `<ReadingCard … rules={rules} />`.
- **`useDayCompletion`** and **`useMenace`:** add the `rules` parameter, and add it to the `useMemo` deps.
- **The cards and `PlanSheet`:** add `rules: Ruleset` to their props interfaces, and replace the temporary `RULESETS.hard` from Task 2 with `rules`. Keep the copy's wording exactly: with Hard rules the rendered text is identical.
- **`DayFailedScreen.tsx`:** `missingTasks(…, rulesFor(challenge))`, using the challenge prop it already receives.
- **Tests:**
  - `PlanSheet.test.tsx`'s `setup()` renders with `rules={RULESETS.hard}` by default.
  - `useMenace.test.ts` passes `RULESETS.hard` as the new last argument.
  - Other component tests that render the cards pass `rules={RULESETS.hard}`.

Check: `git grep -n "RULESETS.hard" -- src ':!src/**/__tests__/**'`. It may only list `src/logic/rulesets.ts`, `src/content/microcopy.ts`, `src/dev/scenarios.ts` and `src/db/normalize.ts` (its fallback). Anything else is a missed caller.

- [ ] **Step 4: Run the gates**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -F - <<'EOF'
refactor: screens read the rules from the attempt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: The gate counts missed days up to Day 75, with jokers

**Files:**
- Modify: `src/logic/restart.ts`, `src/logic/attempts.ts`, `src/hooks/useChallengeGate.ts`
- Test: `src/logic/__tests__/restart.test.ts`, `src/logic/__tests__/attempts.test.ts`

**Interfaces:**
- Consumes: `rulesFor` (Task 1); `summarizeAttempt` with `rules` (Task 2).
- Produces:
  ```ts
  missedDayNumbers(dayEntries: DayCompletionSummary[], todayDayNumber: number): number[]
  interface ChallengeEvaluation { status: ChallengeStatus; missed: number[]; failedDayNumber?: number }
  evaluateChallenge(params: { currentStatus: ChallengeStatus; dayEntries: DayCompletionSummary[]; todayDayNumber: number; jokers: number }): ChallengeEvaluation
  resolveChallengeGate(params: { currentStatus; dayEntries; todayDayNumber; jokers: number }): GateResolution
  ```
  - `findFirstIncompleteDayNumber` and `evaluateChallengeStatus` are **removed**. Port their tests to `missedDayNumbers` and `evaluateChallenge`, with the same cases and the same outcomes.

- [ ] **Step 1: Write the failing tests** (add to `src/logic/__tests__/restart.test.ts)

```ts
const complete = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ dayNumber: from + i, completed: true }))

describe('missed days and jokers', () => {
  it('never counts past Day 75: a complete attempt first opened on Day 77 is complete', () => {
    const result = evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 75), todayDayNumber: 77, jokers: 0 })
    expect(result).toEqual({ status: 'completed', missed: [] })
  })

  it('lists the missed days before today', () => {
    const entries = [...complete(1, 3), { dayNumber: 4, completed: false }, ...complete(6, 7)]
    expect(missedDayNumbers(entries, 8)).toEqual([4, 5])
    expect(missedDayNumbers(entries, 1)).toEqual([])
    expect(missedDayNumbers(entries, Number.NaN)).toEqual([])
  })

  it('forgives misses up to the joker count, and fails on the next one', () => {
    const oneMiss = [...complete(1, 2), { dayNumber: 3, completed: false }, ...complete(4, 5)]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: oneMiss, todayDayNumber: 6, jokers: 1 })).toEqual({
      status: 'active',
      missed: [3],
    })
    const twoMisses = [...oneMiss, { dayNumber: 6, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: twoMisses, todayDayNumber: 7, jokers: 1 })).toEqual({
      status: 'failed',
      missed: [3, 6],
      failedDayNumber: 6,
    })
  })

  it('fails 75 Hard on the first miss, as before', () => {
    const entries = [...complete(1, 2), { dayNumber: 3, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 4, jokers: 0 })).toEqual({
      status: 'failed',
      missed: [3],
      failedDayNumber: 3,
    })
  })

  it('completes after Day 75 when a joker covered a missed Day 75', () => {
    const entries = [...complete(1, 74), { dayNumber: 75, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 76, jokers: 3 })).toEqual({
      status: 'completed',
      missed: [75],
    })
  })

  it('stays active on Day 75 until Day 75 is complete', () => {
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 74), todayDayNumber: 75, jokers: 1 }).status).toBe('active')
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 75), todayDayNumber: 75, jokers: 1 }).status).toBe('completed')
  })

  it('leaves an archived attempt as it is', () => {
    expect(evaluateChallenge({ currentStatus: 'failed', dayEntries: [], todayDayNumber: 9, jokers: 3 }).status).toBe('failed')
  })
})
```

Add to `src/logic/__tests__/attempts.test.ts`: a failed Medium attempt that missed Days 3 and 6 reached Day 6. Use `summarizeAttempt({ …, status: 'failed', rules: RULESETS.medium })` and expect `reachedDay` to be `6`. With Hard rules the same days give 3.

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/logic/__tests__/restart.test.ts src/logic/__tests__/attempts.test.ts`
Expected: FAIL. `evaluateChallenge` and `missedDayNumbers` don't exist yet.

- [ ] **Step 3: Implement `src/logic/restart.ts`**

```ts
/**
 * Days before today, never past Day 75, that have no entry at all or an
 * entry that isn't complete. Gaps (the app wasn't opened that day) count
 * just like an explicitly incomplete day.
 */
export function missedDayNumbers(dayEntries: DayCompletionSummary[], todayDayNumber: number): number[] {
  const completedDays = new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber))
  const lastDay = Math.min(todayDayNumber - 1, CHALLENGE_LENGTH)
  const missed: number[] = []
  for (let day = 1; day <= lastDay; day++) {
    if (!completedDays.has(day)) missed.push(day)
  }
  return missed
}

export interface ChallengeEvaluation {
  status: ChallengeStatus
  /** Every missed day so far (each one used a joker while the attempt is active). */
  missed: number[]
  /** The miss that failed the attempt, when `status` is 'failed' because of this evaluation. */
  failedDayNumber?: number
}

/**
 * Whether an active challenge should turn `failed` or `completed`. A miss
 * uses a joker; the first miss beyond them fails the attempt. It completes
 * once Day 75 is complete, or once Day 75 has passed with every miss
 * forgiven.
 */
export function evaluateChallenge(params: {
  currentStatus: ChallengeStatus
  dayEntries: DayCompletionSummary[]
  todayDayNumber: number
  jokers: number
}): ChallengeEvaluation {
  const missed = missedDayNumbers(params.dayEntries, params.todayDayNumber)
  if (params.currentStatus !== 'active') return { status: params.currentStatus, missed }
  if (missed.length > params.jokers) return { status: 'failed', missed, failedDayNumber: missed[params.jokers] }

  const finalDay = params.dayEntries.find((e) => e.dayNumber === CHALLENGE_LENGTH)
  const pastTheEnd = params.todayDayNumber > CHALLENGE_LENGTH
  const lastDayDone = params.todayDayNumber === CHALLENGE_LENGTH && finalDay?.completed === true
  if (pastTheEnd || lastDayDone) return { status: 'completed', missed }
  return { status: 'active', missed }
}
```

`resolveChallengeGate(params)` gains `jokers`, and calls `evaluateChallenge`:
- `completed` → `{ kind: 'completed' }`; `active` → `{ kind: 'active' }`.
- `failed` → `{ kind: 'needsRestart', failedDayNumber }`, where `failedDayNumber` is:
  - the evaluation's `failedDayNumber`, when this evaluation failed it;
  - otherwise, for an attempt archived as failed, `missed[params.jokers] ?? missed[0]`;
  - failing both, the old fallback: `Math.min(Math.max(today, 1), CHALLENGE_LENGTH)`, where `today` is the finite day number, or `CHALLENGE_LENGTH + 1` when it isn't finite.
- Keep the doc comments' meaning.

**`src/logic/attempts.ts`:** `reachedDayOf(status, summaries, todayDayNumber, jokers)`. For a failed attempt, return `missedDayNumbers(summaries, CHALLENGE_LENGTH + 1)[jokers] ?? missedDayNumbers(summaries, CHALLENGE_LENGTH + 1)[0] ?? CHALLENGE_LENGTH`. `summarizeAttempt` passes `rules.jokers`.

**`src/hooks/useChallengeGate.ts`:** `resolveChallengeGate({ currentStatus: challenge.status, dayEntries: summaries, todayDayNumber, jokers: rulesFor(challenge).jokers })`.

**Port** the tests of `findFirstIncompleteDayNumber` and `evaluateChallengeStatus` in `restart.test.ts` to the new functions. Keep every case and outcome, except the Day-77 case now covered above.

- [ ] **Step 4: Run the gates**

Run: `npx vitest run src/logic` and then `npx tsc -b && npm run lint && npm run test`.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -F - <<'EOF'
fix: count missed days only up to Day 75, and let a ruleset forgive some

The gate scanned up to yesterday, so a fully complete attempt first opened
on Day 77 counted the entry-less Day 76 as a miss and failed. Missed days
now stop at Day 75, and the evaluation takes the ruleset's jokers (0 for
every attempt until the variants ship).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: A golden test for a pre-variants 75 Hard attempt, and the docs

**Files:**
- Create: `src/db/__tests__/goldenHard.test.ts`
- Modify: `README.md` (the `src/logic/` bullet in Project structure)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the test**

`src/db/__tests__/goldenHard.test.ts`, with `// @vitest-environment node` like the other DB tests. Use the fixtures:
- `const startDate = addDaysISO(todayISO(), -11)`, so today is Day 12.
- A challenge with **no `variant` field**: `{ startDate, attemptNumber: 1, status: 'active' }`.
- `addPerfectDays(challengeId, startDate, 1, 11)`.
- Day 12 through `dayEntryRepo.getOrCreate`, with `adjustWater(id, 3800)`, `adjustPages(id, 10)`, and `setPlans(id, { photo: '21:00' }, { photo: 2 })`.

Snapshot every table: `db.challenges.toArray()`, `db.dayEntries.toArray()`, `db.workouts.toArray()` and `db.photos.count()`. Then:
1. Call `syncDayCompletion(entry.id)` for every entry, inside `db.transaction('rw', COMPLETION_TABLES, …)`. Expect `db.dayEntries.toArray()` to deep-equal the snapshot: no stored flag moved.
2. Resolve the gate with `resolveChallengeGate({ currentStatus: 'active', dayEntries: <summaries>, todayDayNumber: 12, jokers: rulesFor(challenge).jokers })`, and expect `{ kind: 'active' }`.
3. `calculateStreak(<summaries>, 12)` is `11`.
4. `calculateChallengeStats(days, rules)`, where `{ rules, days } = await loadChallengeDays(challengeId)`, gives `xp: 945`:
   - 11 perfect days × 75 = 825;
   - plus the Day-7 milestone bonus of 100;
   - plus Day 12's water and reading, 2 × 10.
   
   It also gives `perfectDays: 11`.
5. The challenge row still has no `variant` key: `expect('variant' in challengeRow).toBe(false)`.

- [ ] **Step 2: Run it**

Run: `npx vitest run src/db/__tests__/goldenHard.test.ts`
Expected: PASS. If it fails, the plumbing changed 75 Hard: fix the code, not the expectations.

- [ ] **Step 3: Update the README**

In `README.md` → Project structure, change the `src/logic/` bullet to:

```markdown
- `src/logic/` — pure challenge-rules module (the rulesets for each challenge in `rulesets.ts`, day completion, streak, XP, badges, restart, attempts, stats, validation). No UI or persistence dependencies; fully unit tested.
```

- [ ] **Step 4: Run all the gates**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`
Expected: all pass, and the build writes `dist/sw.js`.

- [ ] **Step 5: Commit**

```bash
git add src/db/__tests__/goldenHard.test.ts README.md
git commit -F - <<'EOF'
test: prove a pre-variants 75 Hard attempt is judged exactly as before

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
