# Knife-Duck Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the green blob mascot with the user's knife-holding duck: code-drawn, spring-animated, menacing only when today's tasks stop fitting before bedtime, with an "I've got a plan" escape hatch and a Higgsfield clip on the missed-day screen.

**Architecture:**
- **Motion model:** a pure motion rig (`src/components/mascot/rig.ts`) turns mood, time and events into a pose. `Mascot.tsx` runs one frame loop and writes the pose into a traced, layered SVG (`duckArt.tsx`).
- **Menace rule:** a pure rule (`src/logic/menace.ts`) decides the Today mood from what's left, the time, the bedtime setting and today's plans.
- **Today screen:** a `DuckHeader` shows the duck, his line and the plan button over a `MenaceAtmosphere` layer.
- **Storage:** plans live on the day entry, and the bedtime lives in the settings table. There is no schema bump.

**Tech Stack:** React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`), Framer Motion 13 (`useAnimationFrame`, `useReducedMotionConfig`), Dexie 4 with `dexie-react-hooks`, Tailwind 4, Vitest 5 with Testing Library and `fake-indexeddb`, vite-plugin-pwa. The clip uses the Higgsfield MCP tools and ffmpeg (via `imageio-ffmpeg`).

**Spec:** `docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md`. The traced art is `docs/superpowers/specs/2026-09-25-knife-duck-companion/duck-rig.svg`, and the approved motion prototype is `…/prototype.html` next to it.

## Global Constraints

- **Target device:** an iPhone, as an installed PWA in Safari. Touch only: nothing may depend on hover, and haptics are a no-op there.
- **Knife rule:** the knife never moves on its own. The arm carries it, and the wrist may only rotate it around the grip `(100, 332)`. The only exception is the `celebrating` toss.
- **Reduced motion:** honour it through `useReducedMotionConfig()`, which follows `MotionConfig reducedMotion="user"` in `src/main.tsx`. Poses are static, with no loops, gaze, shake, pulse or clip.
- **Smoothness:** every change goes through a time-based spring or a crossfade. Nothing may jump.
- **Copy:** UI copy is in English. The duck's lines must match the spec's copy table exactly.
- **Contrast:** text keeps at least 4.5:1 contrast in both themes. The atmosphere layer never sits under text.
- **Dependencies:** no new runtime dependencies, and no Dexie schema version bump.
- **TypeScript:** use `import type` for type-only imports. No enums or namespaces. No unused locals or parameters.
- **Tests:** Vitest. DB tests use `freshDatabase()` from `src/db/__tests__/fixtures.ts`. Tests that store Blobs in the DB run with `// @vitest-environment node`. Component tests set `MotionGlobalConfig.skipAnimations = true`.
- **Commits:** a conventional prefix (`feat:`, `fix:`, `docs:`, `test:`), and every message ends with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Gates before the final hand-off:** `npm run lint`, `npm run test` and `npm run build` must all pass.

## File Map

| File | Status | Responsibility |
| --- | --- | --- |
| `src/logic/menace.ts` | new | Time helpers, task-minute estimates, plan validation, the menace rule |
| `src/components/mascot/rig.ts` | new | Pure motion model: moods, springs, tap cycle, toss, gaze, reactions, pose → SVG transforms |
| `src/components/mascot/duckArt.tsx` | new | The traced SVG in layers (`data-part` attributes), no logic |
| `src/components/mascot/useTouchGaze.ts` | new | Window touch/scroll listeners feeding the rig |
| `src/components/mascot/Mascot.tsx` | rewritten | Mood-driven component: one frame loop writing the pose into the SVG |
| `src/hooks/useNow.ts` | new | Minutes since midnight, with the dev `?now=HH:mm` override |
| `src/hooks/useMenace.ts` | new | Today's `Menace` from progress, plans, bedtime and time |
| `src/screens/Today/DuckHeader.tsx` | new | The duck, his speech bubble, pokes, reactions and the plan-button slot |
| `src/screens/Today/MenaceAtmosphere.tsx` | new | Vignette and red pulse behind the Today content |
| `src/screens/Today/PlanSheet.tsx` | new | "Tell the duck your plan" modal |
| `src/screens/Settings/CompanionSection.tsx` | new | The bedtime setting |
| `src/screens/RestartFlow/FailedDayCinematic.tsx` | new | The one-time missed-day clip |
| `src/content/microcopy.ts` | modified | `duckLine`, poke/lunge/glare/plan lines; `mascotLine` removed |
| `src/db/types.ts`, `repositories/dayEntryRepo.ts`, `repositories/settingsRepo.ts`, `exportImport.ts` | modified | `DayEntry.plans`, `setPlans`, the `bedtime` key, plan validation on import |
| `src/hooks/useSettings.ts`, `src/hooks/useSound.ts`, `src/lib/sound.ts` | modified | The bedtime setting, `useKnifeSound`, `playKnifeShing` |
| `src/screens/**` (7 screens using the mascot), `SettingsScreen.tsx` | modified | Moods per screen, the Companion section |
| `public/mascot.svg`, `pwa-assets.config.ts`, generated icons | modified | The duck app icon |
| `public/media/failed-day.mp4`, `public/media/failed-day-poster.webp` | new | The clip, and its poster frame |
| `vite.config.ts` | modified | Precache the clip |
| `src/dev/scenarios.ts`, `README.md` | modified | Menace and plan scenarios, docs |

---

### Task 1: The menace rule and time helpers

**Files:**
- Create: `src/logic/menace.ts`
- Test: `src/logic/__tests__/menace.test.ts`

**Interfaces:**
- Consumes: `missingTasks`, `isQualifyingWorkout` (`src/logic/dayCompletion.ts`); `MIN_WORKOUT_MIN`, `PAGES_TARGET`, `REQUIRED_QUALIFYING_WORKOUTS`, `WATER_TARGET_ML` (`src/logic/constants.ts`); `DayTaskData`, `TaskId` (`src/logic/types.ts`).
- Produces:
  - Types: `MenaceLevel`, `MenaceReason`, `PlannedTask { task: TaskId; at: number }`, `Menace { level; reason; next?: PlannedTask; broken?: PlannedTask }`, `MenaceInput`, `PlanError = 'past' | 'past-midnight'`.
  - Constants: `DEFAULT_BEDTIME = '23:00'`, `EARLIEST_BEDTIME = '18:00'`, `LATEST_BEDTIME = '23:59'`, `PLAN_GRACE_MIN = 15`.
  - Functions:
    - `parseHHmm(value: string): number | null`
    - `formatHHmm(minutes: number): string`
    - `isValidBedtime(value: string): boolean`
    - `bedtimeMinutes(value: unknown): number`
    - `plansToMinutes(plans: Partial<Record<TaskId, string>> | undefined): Partial<Record<TaskId, number>>`
    - `minutesToFinish(task: TaskId, data: DayTaskData): number`
    - `planError(task: TaskId, time: string, data: DayTaskData, nowMin: number): PlanError | null`
    - `menace(input: MenaceInput): Menace`

- [ ] **Step 1: Write the failing test**

Create `src/logic/__tests__/menace.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MIN_WORKOUT_MIN, PAGES_TARGET, WATER_TARGET_ML } from '../constants'
import {
  bedtimeMinutes,
  formatHHmm,
  isValidBedtime,
  menace,
  minutesToFinish,
  parseHHmm,
  planError,
  plansToMinutes,
  type Menace,
  type MenaceLevel,
  type MenaceReason,
} from '../menace'
import type { DayTaskData, TaskId } from '../types'

const DONE: DayTaskData = {
  water_ml: WATER_TARGET_ML,
  pages_read: PAGES_TARGET,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: true,
  workouts: [
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: false },
  ],
}
const NOTHING: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }
const ONE_WORKOUT_LEFT: DayTaskData = { ...DONE, workouts: [{ durationMin: MIN_WORKOUT_MIN, isOutdoor: true }] }
const ONLY_READING: DayTaskData = { ...DONE, pages_read: 0 }
/** 1.7 L of water, reading, photo and diet left: 102 + 20 + 2 + 2 = 126 minutes. */
const EVENING_MIX: DayTaskData = { ...DONE, water_ml: 2100, pages_read: 0, hasPhoto: false, dietFollowed: false }

type Options = { plans?: Partial<Record<TaskId, string>>; bedtime?: string }

const min = (time: string) => parseHHmm(time)!

function at(time: string, data: DayTaskData, options: Options = {}): Menace {
  return menace({
    data,
    nowMin: min(time),
    bedtimeMin: min(options.bedtime ?? '23:00'),
    plans: plansToMinutes(options.plans),
  })
}

// The spec's reference cases (section 2), bedtime 23:00 unless noted.
const CASES: [number, string, DayTaskData, Options, MenaceLevel, MenaceReason][] = [
  [1, '10:00', NOTHING, {}, 'watching', 'plenty'],
  [2, '19:30', EVENING_MIX, {}, 'watching', 'plenty'],
  [3, '20:00', EVENING_MIX, {}, 'tapping', 'close'],
  [4, '21:00', ONE_WORKOUT_LEFT, {}, 'watching', 'plenty'],
  [5, '21:15', ONE_WORKOUT_LEFT, {}, 'tapping', 'close'],
  [6, '22:15', ONE_WORKOUT_LEFT, {}, 'hunting', 'wont-fit'],
  [7, '22:25', ONLY_READING, {}, 'watching', 'plenty'],
  [8, '22:30', ONLY_READING, {}, 'tapping', 'close'],
  [9, '22:40', ONLY_READING, {}, 'hunting', 'wont-fit'],
  [10, '22:35', ONLY_READING, { plans: { reading: '22:30' } }, 'watching', 'plan-due'],
  [11, '23:05', ONLY_READING, { plans: { reading: '22:30' } }, 'hunting', 'past-bedtime'],
  [12, '20:50', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }, 'watching', 'plan-due'],
  [13, '21:00', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }, 'tapping', 'plan-broken'],
  [14, '15:00', { ...DONE, dietFollowed: false }, {}, 'watching', 'plenty'],
  [15, '12:00', DONE, {}, 'content', 'done'],
  [16, '23:30', { ...DONE, hasPhoto: false }, { bedtime: '23:59' }, 'tapping', 'close'],
]

describe('menace: the reference cases', () => {
  it.each(CASES)('case %i at %s', (_case, time, data, options, level, reason) => {
    const result = at(time, data, options)
    expect([result.level, result.reason]).toEqual([level, reason])
  })
})

describe('menace: plans', () => {
  it('points at the earliest plan still covering a task', () => {
    const result = at('19:00', { ...DONE, pages_read: 0, hasPhoto: false }, { plans: { reading: '22:30', photo: '21:00' } })
    expect(result).toMatchObject({ level: 'watching', reason: 'plan-pending', next: { task: 'photo', at: min('21:00') } })
  })

  it('ignores plans for tasks already done', () => {
    expect(at('23:30', DONE, { plans: { reading: '20:00' } })).toEqual({ level: 'content', reason: 'done' })
  })

  it('reports the plan that was broken', () => {
    expect(at('21:00', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }).broken).toEqual({
      task: 'workouts',
      at: min('20:00'),
    })
  })
})

describe('minutesToFinish', () => {
  it('estimates each task from where the day stands', () => {
    expect(minutesToFinish('water', { ...NOTHING, water_ml: 2100 })).toBe(102)
    expect(minutesToFinish('reading', { ...NOTHING, pages_read: 4 })).toBe(12)
    expect(minutesToFinish('workouts', NOTHING)).toBe(90)
    expect(minutesToFinish('photo', NOTHING)).toBe(2)
    expect(minutesToFinish('diet', NOTHING)).toBe(2)
  })

  it('needs one more workout when neither of two is outdoors', () => {
    const indoors: DayTaskData = {
      ...NOTHING,
      workouts: [
        { durationMin: 45, isOutdoor: false },
        { durationMin: 60, isOutdoor: false },
      ],
    }
    expect(minutesToFinish('workouts', indoors)).toBe(45)
  })
})

describe('planError', () => {
  it('refuses a time that has passed', () => {
    expect(planError('reading', '19:59', ONLY_READING, min('20:00'))).toBe('past')
  })

  it('refuses a task that would run past midnight', () => {
    expect(planError('reading', '23:50', ONLY_READING, min('20:00'))).toBe('past-midnight')
  })

  it('accepts a time that fits, and treats a blank time as no plan', () => {
    expect(planError('reading', '23:40', ONLY_READING, min('20:00'))).toBeNull()
    expect(planError('reading', '', ONLY_READING, min('20:00'))).toBeNull()
  })
})

describe('time helpers', () => {
  it('parses and formats 24-hour times', () => {
    expect(parseHHmm('07:05')).toBe(425)
    expect(parseHHmm('24:00')).toBeNull()
    expect(parseHHmm('7:05')).toBeNull()
    expect(formatHHmm(425)).toBe('07:05')
  })

  it('keeps the bedtime between 18:00 and 23:59, defaulting to 23:00', () => {
    expect(isValidBedtime('22:30')).toBe(true)
    expect(isValidBedtime('17:59')).toBe(false)
    expect(bedtimeMinutes('22:30')).toBe(min('22:30'))
    expect(bedtimeMinutes('03:00')).toBe(min('23:00'))
    expect(bedtimeMinutes(undefined)).toBe(min('23:00'))
  })

  it('reads a saved plan, skipping malformed times', () => {
    expect(plansToMinutes({ reading: '22:30', photo: 'soon' })).toEqual({ reading: min('22:30') })
    expect(plansToMinutes(undefined)).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/logic/__tests__/menace.test.ts`
Expected: FAIL, with `Failed to resolve import "../menace"`.

- [ ] **Step 3: Write the implementation**

Create `src/logic/menace.ts`:

```ts
import { MIN_WORKOUT_MIN, PAGES_TARGET, REQUIRED_QUALIFYING_WORKOUTS, WATER_TARGET_ML } from './constants'
import { isQualifyingWorkout, missingTasks } from './dayCompletion'
import type { DayTaskData, TaskId } from './types'

/** How menacing the duck is on the Today screen, calmest first. */
export type MenaceLevel = 'content' | 'watching' | 'tapping' | 'hunting'

/** Why the duck is at his level; it picks his line. */
export type MenaceReason =
  | 'done'
  | 'plenty'
  | 'plan-pending'
  | 'plan-due'
  | 'close'
  | 'plan-broken'
  | 'wont-fit'
  | 'past-bedtime'

export interface PlannedTask {
  task: TaskId
  /** Minutes since local midnight. */
  at: number
}

export interface Menace {
  level: MenaceLevel
  reason: MenaceReason
  /** The earliest plan still covering a missing task. */
  next?: PlannedTask
  /** The earliest plan whose window passed with its task still missing. */
  broken?: PlannedTask
}

export interface MenaceInput {
  data: DayTaskData
  /** Minutes since local midnight (0–1439). */
  nowMin: number
  /** Bedtime, in minutes since local midnight. */
  bedtimeMin: number
  /** Planned times (minutes since midnight) for some of today's tasks. */
  plans: Partial<Record<TaskId, number>>
}

export type PlanError = 'past' | 'past-midnight'

export const DEFAULT_BEDTIME = '23:00'
export const EARLIEST_BEDTIME = '18:00'
export const LATEST_BEDTIME = '23:59'

/** A plan's grace after the task's expected end, before it counts as broken. */
export const PLAN_GRACE_MIN = 15
/** Long tasks make the duck tap once the slack before bedtime is this small. */
const TAPPING_SLACK_MIN = 60
/** Short tasks only count this close to bedtime. */
const SHORT_TASK_WINDOW_MIN = 30
const WATER_MIN_PER_LITRE = 60
const READING_MIN_PER_PAGE = 2
const QUICK_TASK_MIN = 2
const MINUTES_PER_DAY = 24 * 60

/** Tasks that take real time; the others fit in a few minutes. */
const LONG_TASKS: readonly TaskId[] = ['workouts', 'water']

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** "HH:mm" (24-hour) → minutes since midnight, or null when it isn't a valid time. */
export function parseHHmm(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Minutes since midnight → "HH:mm". */
export function formatHHmm(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Whether "HH:mm" is an allowed bedtime: 18:00–23:59. */
export function isValidBedtime(value: string): boolean {
  const minutes = parseHHmm(value)
  return minutes !== null && minutes >= parseHHmm(EARLIEST_BEDTIME)! && minutes <= parseHHmm(LATEST_BEDTIME)!
}

/** A stored bedtime as minutes; anything missing or invalid falls back to 23:00. */
export function bedtimeMinutes(value: unknown): number {
  return typeof value === 'string' && isValidBedtime(value) ? parseHHmm(value)! : parseHHmm(DEFAULT_BEDTIME)!
}

/** A day's saved plan ("HH:mm" values) as minutes, skipping anything malformed. */
export function plansToMinutes(plans: Partial<Record<TaskId, string>> | undefined): Partial<Record<TaskId, number>> {
  const result: Partial<Record<TaskId, number>> = {}
  for (const [task, time] of Object.entries(plans ?? {}) as [TaskId, string | undefined][]) {
    const minutes = time === undefined ? null : parseHHmm(time)
    if (minutes !== null) result[task] = minutes
  }
  return result
}

/** Qualifying workouts still to do, or one more if two qualify but neither is outdoors. */
function workoutsStillNeeded(data: DayTaskData): number {
  const qualifying = data.workouts.filter(isQualifyingWorkout)
  const missing = Math.max(0, REQUIRED_QUALIFYING_WORKOUTS - qualifying.length)
  if (missing > 0) return missing
  return qualifying.some((workout) => workout.isOutdoor) ? 0 : 1
}

/** Estimated minutes to finish a task from where the day stands. */
export function minutesToFinish(task: TaskId, data: DayTaskData): number {
  switch (task) {
    case 'workouts':
      return workoutsStillNeeded(data) * MIN_WORKOUT_MIN
    case 'water':
      // Integer maths first: 1700 ml → 102 min exactly, never 103.
      return Math.ceil((Math.max(0, WATER_TARGET_ML - data.water_ml) * WATER_MIN_PER_LITRE) / 1000)
    case 'reading':
      return Math.max(0, PAGES_TARGET - data.pages_read) * READING_MIN_PER_PAGE
    case 'diet':
    case 'photo':
      return QUICK_TASK_MIN
  }
}

/** Why a planned time can't work, or null when it can. A blank or malformed time means "no plan", not an error. */
export function planError(task: TaskId, time: string, data: DayTaskData, nowMin: number): PlanError | null {
  const at = parseHHmm(time)
  if (at === null) return null
  if (at < nowMin) return 'past'
  if (at + minutesToFinish(task, data) > MINUTES_PER_DAY) return 'past-midnight'
  return null
}

const earlier = (current: PlannedTask | undefined, candidate: PlannedTask): PlannedTask =>
  !current || candidate.at < current.at ? candidate : current

/**
 * How menacing the duck should be right now. He only threatens when the
 * remaining tasks no longer fit before bedtime, or when a plan was broken.
 * The full rule, with reference cases, is in section 2 of
 * docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md.
 */
export function menace({ data, nowMin, bedtimeMin, plans }: MenaceInput): Menace {
  const missing = missingTasks(data)
  if (missing.length === 0) return { level: 'content', reason: 'done' }

  const uncovered: TaskId[] = []
  let next: PlannedTask | undefined
  let broken: PlannedTask | undefined
  let planDue = false
  for (const task of missing) {
    const at = plans[task]
    if (at === undefined) {
      uncovered.push(task)
      continue
    }
    if (nowMin >= at + minutesToFinish(task, data) + PLAN_GRACE_MIN) {
      uncovered.push(task)
      broken = earlier(broken, { task, at })
      continue
    }
    if (nowMin >= at) planDue = true
    next = earlier(next, { task, at })
  }

  if (uncovered.length === 0) return { level: 'watching', reason: planDue ? 'plan-due' : 'plan-pending', next }

  const timeLeft = bedtimeMin - nowMin
  const long = uncovered.filter((task) => LONG_TASKS.includes(task))
  const short = uncovered.filter((task) => !LONG_TASKS.includes(task))
  const needed = sum(uncovered.map((task) => minutesToFinish(task, data)))
  const neededShort = sum(short.map((task) => minutesToFinish(task, data)))

  let wontFit = false
  let close = false
  if (long.length > 0) {
    const slack = timeLeft - needed
    if (slack <= 0) wontFit = true
    else if (slack <= TAPPING_SLACK_MIN) close = true
  }
  if (short.length > 0) {
    if (timeLeft - neededShort <= 0) wontFit = true
    else if (timeLeft <= SHORT_TASK_WINDOW_MIN) close = true
  }

  if (wontFit) return { level: 'hunting', reason: timeLeft <= 0 ? 'past-bedtime' : 'wont-fit', next, broken }
  if (broken) return { level: 'tapping', reason: 'plan-broken', next, broken }
  if (close) return { level: 'tapping', reason: 'close', next, broken }
  return { level: 'watching', reason: 'plenty', next, broken }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/logic/__tests__/menace.test.ts`
Expected: PASS, 26 tests (16 reference cases plus 10 others).

- [ ] **Step 5: Commit**

```bash
git add src/logic/menace.ts src/logic/__tests__/menace.test.ts
git commit -F - <<'EOF'
feat: add the duck's menace rule: threaten only when tasks stop fitting before bedtime

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: The motion rig

**Files:**
- Create: `src/components/mascot/rig.ts`
- Test: `src/components/mascot/__tests__/rig.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure TypeScript).
- Produces:
  - Types: `DuckMood = 'content' | 'watching' | 'tapping' | 'hunting' | 'celebrating' | 'triumphant' | 'judging' | 'waiting' | 'sad'` and `DuckReaction = 'poke' | 'lunge' | 'approve' | 'glare' | 'relax'`.
  - `MOOD_POSES: Record<DuckMood, MoodPose>`
  - `tapAngle(phase: number): number`
  - `tossAt(seconds: number): { arm: number; spin: number; lift: number }` and `TOSS_PERIOD = 2.4`
  - `RigPose` (numeric pose) and `DuckTransforms` (SVG transform strings)
  - `createRig(options: { mood: DuckMood; reducedMotion?: boolean; random?: () => number }): Rig`, where `Rig` has `mood`, `setMood`, `setReducedMotion`, `react`, `touch`, `scrolled` and `step(dt)` → `RigPose`
  - `poseToTransforms(pose: RigPose): DuckTransforms`
  - `registerPoke(recent: readonly number[], now: number): { kind: 'poke' | 'lunge'; recent: number[] }`

- [ ] **Step 1: Write the failing test**

Create `src/components/mascot/__tests__/rig.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createRig,
  MOOD_POSES,
  poseToTransforms,
  registerPoke,
  tapAngle,
  TOSS_PERIOD,
  tossAt,
  type DuckMood,
  type Rig,
  type RigPose,
} from '../rig'

const FRAME = 1 / 60

/** A deterministic stand-in for Math.random. */
function seeded(): () => number {
  let state = 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

function run(rig: Rig, seconds: number): RigPose {
  let pose = rig.step(FRAME)
  for (let i = 1; i < Math.round(seconds / FRAME); i++) pose = rig.step(FRAME)
  return pose
}

/** Smallest difference between two angles, in degrees. */
const angleGap = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180)

describe('tapAngle', () => {
  it('lifts, strikes and settles without jumps', () => {
    expect(tapAngle(0)).toBeCloseTo(0)
    expect(tapAngle(0.72 - 1e-9)).toBeCloseTo(tapAngle(0.72), 5)
    expect(tapAngle(0.72)).toBeCloseTo(-12)
    expect(tapAngle(0.8 - 1e-9)).toBeCloseTo(tapAngle(0.8), 5)
    expect(tapAngle(0.8)).toBeCloseTo(3)
    expect(tapAngle(1 - 1e-9)).toBeCloseTo(0, 5)
  })
})

describe('tossAt', () => {
  it('is continuous at every phase join', () => {
    for (const s of [0.25, 0.4, 1.1, 1.6]) {
      const before = tossAt(s - 1e-9)
      const after = tossAt(s)
      expect(before.arm).toBeCloseTo(after.arm, 5)
      expect(before.lift).toBeCloseTo(after.lift, 5)
      expect(angleGap(before.spin, after.spin)).toBeCloseTo(0, 3)
    }
  })

  it('only lifts the knife while it is in the air', () => {
    expect(tossAt(0.2).lift).toBe(0)
    expect(tossAt(0.75).lift).toBeGreaterThan(100)
    expect(tossAt(2).lift).toBe(0)
  })
})

describe('createRig', () => {
  const HELD: DuckMood[] = ['content', 'watching', 'tapping', 'hunting', 'triumphant', 'judging', 'waiting', 'sad']

  it.each(HELD)('keeps the knife in the hand while %s', (mood) => {
    const rig = createRig({ mood, random: seeded() })
    for (let i = 0; i < 600; i++) expect(rig.step(FRAME).knifeOffset).toEqual([0, 0])
  })

  it('throws and catches the knife while celebrating, without jumps', () => {
    const rig = createRig({ mood: 'celebrating', random: seeded() })
    let previous = rig.step(FRAME)
    let flew = false
    for (let i = 0; i < Math.round((2 * TOSS_PERIOD) / FRAME); i++) {
      const pose = rig.step(FRAME)
      const jump = Math.hypot(
        pose.knifeOffset[0] - previous.knifeOffset[0],
        pose.knifeOffset[1] - previous.knifeOffset[1],
      )
      expect(jump).toBeLessThan(25)
      if (Math.hypot(...pose.knifeOffset) > 100) flew = true
      previous = pose
    }
    expect(flew).toBe(true)
  })

  it('settles on the pose of a new mood', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    rig.setMood('hunting')
    const pose = run(rig, 3)
    expect(pose.arm).toBeGreaterThan(-27.5)
    expect(pose.arm).toBeLessThan(-24.5)
    expect(pose.knife).toBeCloseTo(26, 0)
    expect(pose.browsOpacity).toBeCloseTo(1, 1)
  })

  it('crossfades to happy eyes instead of swapping them', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    rig.setMood('content')
    const first = rig.step(FRAME)
    expect(first.happyOpacity).toBeGreaterThan(0)
    expect(first.happyOpacity).toBeLessThan(0.1)
    const settled = run(rig, 2)
    expect(settled.happyOpacity).toBeCloseTo(1, 2)
    expect(settled.eyesOpacity).toBeCloseTo(0, 2)
  })

  it('holds a still pose under reduced motion, and ignores reactions', () => {
    const rig = createRig({ mood: 'hunting', reducedMotion: true, random: seeded() })
    const still = rig.step(FRAME)
    rig.react('lunge')
    rig.react('poke')
    rig.touch({ x: 0, y: 0 })
    expect(run(rig, 2)).toEqual(still)
    expect(still.arm).toBe(MOOD_POSES.hunting.arm)
    expect(still.knife).toBe(MOOD_POSES.hunting.knife)
    expect(Math.abs(still.hop)).toBe(0)
    expect(Math.abs(still.shake)).toBe(0)
  })

  it('looks where a finger touches, then looks around again', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    run(rig, 0.5)
    rig.touch({ x: 480, y: 175 })
    expect(run(rig, 0.5).gazeX).toBeGreaterThan(8)
    expect(run(rig, 5).gazeX).toBeLessThan(9)
  })

  it('lunges: winds the knife up overhead, then strikes back down', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    run(rig, 1)
    rig.react('lunge')
    const windUp = run(rig, 0.3)
    expect(windUp.arm).toBeLessThan(-40)
    expect(windUp.scaleY).toBeGreaterThan(1.15)
    expect(Math.abs(run(rig, 2.5).arm)).toBeLessThan(0.5)
  })
})

describe('poseToTransforms', () => {
  it('turns the arm about the shoulder and the knife about the grip', () => {
    const rig = createRig({ mood: 'hunting', reducedMotion: true })
    const transforms = poseToTransforms(rig.step(0))
    expect(transforms.leftWing).toBe('rotate(-26 51 195)')
    expect(transforms.knife).toBe('translate(0 0) rotate(26 100 332)')
  })
})

describe('registerPoke', () => {
  it('turns the third poke within 1.8 s into a lunge', () => {
    let result = registerPoke([], 0)
    expect(result.kind).toBe('poke')
    result = registerPoke(result.recent, 500)
    expect(result.kind).toBe('poke')
    result = registerPoke(result.recent, 1000)
    expect(result.kind).toBe('lunge')
    expect(registerPoke(result.recent, 1100).kind).toBe('poke')
  })

  it('forgets pokes older than the window', () => {
    let result = registerPoke([], 0)
    result = registerPoke(result.recent, 1000)
    expect(registerPoke(result.recent, 2500).kind).toBe('poke')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/mascot/__tests__/rig.test.ts`
Expected: FAIL, with `Failed to resolve import "../rig"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/mascot/rig.ts`. The constants come from the approved prototype (`docs/superpowers/specs/2026-09-25-knife-duck-companion/prototype.html`).

```ts
/**
 * The duck's motion model. It is pure TypeScript (no DOM, no React), so every
 * behaviour is unit-testable. Mascot.tsx creates one rig per duck, feeds it
 * the elapsed time and events, and writes the pose it returns into the SVG.
 *
 * Angles are in degrees in SVG space (negative raises the arm or the knife).
 * Lengths are the art's SVG units (viewBox -10 20 490 500).
 *
 * The knife never moves on its own: the left wing carries it, and the wrist
 * only rotates it about the grip. The single exception is the celebration
 * toss, where the arm throws it and catches it again.
 */

export type DuckMood =
  | 'content'
  | 'watching'
  | 'tapping'
  | 'hunting'
  | 'celebrating'
  | 'triumphant'
  | 'judging'
  | 'waiting'
  | 'sad'

export type DuckReaction = 'poke' | 'lunge' | 'approve' | 'glare' | 'relax'

export interface MoodPose {
  arm: number
  knife: number
  lean: number
  /** Brow visibility, 0–1. */
  brow: number
  /** Brow slope: 0 flat (suspicious) to 1 furious. */
  anger: number
  /** Eye height: 1 is fully open. */
  squint: number
  /** Crossfade to the ^ ^ happy eyes, 0–1. */
  happy: number
  sweat: number
  /** Seconds per tap cycle; 0 means no tapping. */
  tapPeriod: number
  /** Whether each tap strike makes the blade glint. */
  strikeGlint: boolean
  tremble: boolean
  bob: boolean
  wave: boolean
  toss: boolean
  /** Mean seconds between blade glints; 0 means only strikes glint. */
  glintEvery: number
  /** Stares at you instead of glancing around, and blinks slowly. */
  stare: boolean
  /** A fixed gaze instead of glances, e.g. looking down when sad. */
  gaze?: readonly [number, number]
}

const CALM = { strikeGlint: false, tremble: false, bob: false, wave: false, toss: false, stare: false, sweat: 0 }

export const MOOD_POSES: Record<DuckMood, MoodPose> = {
  content: { ...CALM, arm: 5, knife: 28, lean: 1, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, glintEvery: 0 },
  watching: { ...CALM, arm: 0, knife: 0, lean: 1, brow: 0, anger: 0, squint: 1, happy: 0, tapPeriod: 0, glintEvery: 4.2 },
  tapping: { ...CALM, arm: -15, knife: 15, lean: 1.03, brow: 1, anger: 0.15, squint: 0.9, happy: 0, tapPeriod: 1, strikeGlint: true, glintEvery: 0 },
  hunting: { ...CALM, arm: -26, knife: 26, lean: 1.08, brow: 1, anger: 1, squint: 0.72, happy: 0, tapPeriod: 0, tremble: true, glintEvery: 1.1, stare: true },
  celebrating: { ...CALM, arm: -10, knife: 10, lean: 1, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, toss: true, glintEvery: 0 },
  triumphant: { ...CALM, arm: -70, knife: 0, lean: 1.02, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, glintEvery: 2 },
  judging: { ...CALM, arm: -15, knife: 15, lean: 1.02, brow: 1, anger: 0.6, squint: 0.8, happy: 0, tapPeriod: 1.6, strikeGlint: true, glintEvery: 0, stare: true },
  waiting: { ...CALM, arm: -15, knife: 15, lean: 1, brow: 0, anger: 0, squint: 1, happy: 0, tapPeriod: 1.6, glintEvery: 0 },
  sad: { ...CALM, arm: 8, knife: 35, lean: 0.98, brow: 0, anger: 0, squint: 0.85, happy: 0, sweat: 1, tapPeriod: 0, glintEvery: 0, gaze: [0, 5] },
}

/** The tap cycle's arm angle at `phase` (0–1): a slow lift to −12°, a quick strike to +3°, then a settle to 0. */
export function tapAngle(phase: number): number {
  if (phase < 0.72) {
    const u = phase / 0.72
    return -12 * u * u * (3 - 2 * u)
  }
  if (phase < 0.8) {
    const u = (phase - 0.72) / 0.08
    return -12 + 15 * u * u
  }
  const u = (phase - 0.8) / 0.2
  return 3 * (1 - u * u * (3 - 2 * u))
}

/** Seconds per knife toss while celebrating. */
export const TOSS_PERIOD = 2.4
const RELEASE = 0.4
const CATCH = 1.1
const SETTLED = 1.6
const TOSS_HEIGHT = 180
const smooth = (u: number) => u * u * (3 - 2 * u)

/**
 * The toss `seconds` into its cycle: the extra arm angle, the knife's spin,
 * and how high the knife is above the hand, in world space. The arm winds down,
 * flicks up and releases at its peak. The knife flies a parabola, spinning
 * once, and the raised hand catches it and lowers.
 */
export function tossAt(seconds: number): { arm: number; spin: number; lift: number } {
  if (seconds < 0.25) return { arm: 12 * smooth(seconds / 0.25), spin: 0, lift: 0 }
  if (seconds < RELEASE) {
    const u = (seconds - 0.25) / (RELEASE - 0.25)
    return { arm: 12 - 57 * (1 - (1 - u) * (1 - u)), spin: 0, lift: 0 }
  }
  if (seconds < CATCH) {
    const u = (seconds - RELEASE) / (CATCH - RELEASE)
    return { arm: -45, spin: 360 * u, lift: TOSS_HEIGHT * 4 * u * (1 - u) }
  }
  if (seconds < SETTLED) return { arm: -45 * (1 - smooth((seconds - CATCH) / (SETTLED - CATCH))), spin: 0, lift: 0 }
  return { arm: 0, spin: 0, lift: 0 }
}

/** Everything Mascot.tsx needs to draw one frame. */
export interface RigPose {
  shake: number
  hop: number
  sway: number
  scaleX: number
  scaleY: number
  breathe: number
  /** Left-wing rotation about the shoulder. */
  arm: number
  /** Knife rotation about the grip. */
  knife: number
  /** Knife translation in the wing's space: [0, 0] unless it's in the air. */
  knifeOffset: [number, number]
  rightWing: number
  gazeX: number
  gazeY: number
  eyeScaleY: number
  eyesOpacity: number
  happyOpacity: number
  happyLift: number
  browsOpacity: number
  browFlat: number
  browsDx: number
  browsDy: number
  glintX: number
  sweatOpacity: number
}

export interface DuckTransforms {
  whole: string
  body: string
  leftWing: string
  knife: string
  rightWing: string
  eyeL: string
  eyeR: string
  happy: string
  brows: string
  browL: string
  browR: string
  glint: string
}

export interface Rig {
  readonly mood: DuckMood
  setMood(mood: DuckMood): void
  setReducedMotion(reduced: boolean): void
  react(kind: DuckReaction): void
  /** A finger touched or dragged at this point, in the art's SVG units. */
  touch(point: { x: number; y: number }): void
  /** The page scrolled: glance down at the list. */
  scrolled(): void
  /** Advances `dt` seconds and returns the pose to draw. */
  step(dt: number): RigPose
}

interface Spring {
  x: number
  v: number
  to: number
  k: number
  c: number
}

const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, to: x, k, c })

/** Time-based, so it's frame-rate independent; substeps keep the stiff springs stable. */
function stepSpring(s: Spring, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h
    s.x += s.v * h
  }
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const TAU = Math.PI * 2
const EYES_CENTRE = { x: 235, y: 175 }
const GLANCES: readonly (readonly [number, number])[] = [
  [0, 3],
  [5, 9],
  [-9, 1],
  [8, -1],
]
const STARE: readonly [number, number] = [0, 2]
const TOUCH_HOLD = 1.3
const SCROLL_HOLD = 1
const GLINT_DURATION = 0.52
const LUNGE_WIND_UP = 0.32
const GLARE_DURATION = 1.5
const RELAX_DURATION = 1.5
const MAX_DT = 0.05

export function createRig(options: { mood: DuckMood; reducedMotion?: boolean; random?: () => number }): Rig {
  const random = options.random ?? Math.random
  let mood = options.mood
  let reduced = options.reducedMotion ?? false
  let t = 0
  const start = MOOD_POSES[mood]
  const S = {
    arm: spring(start.arm, 140, 18),
    knife: spring(start.knife, 160, 20),
    lean: spring(start.lean, 120, 20),
    brow: spring(start.brow, 200, 26),
    anger: spring(start.anger, 200, 26),
    squint: spring(start.squint, 220, 28),
    happy: spring(start.happy, 180, 24),
    sweat: spring(start.sweat, 120, 20),
    gx: spring(0, 520, 42),
    gy: spring(0, 520, 42),
    squash: spring(1, 380, 16),
    nod: spring(0, 300, 18),
    tap: spring(0, 60, 16),
    tremble: spring(0, 60, 16),
    bob: spring(0, 60, 16),
    wave: spring(0, 60, 16),
    toss: spring(0, 60, 16),
    shake: spring(0, 60, 14),
  }
  let blinkAt = -1
  let nextBlink = 0.9
  let glintAt = -1
  let nextGlint = 1.6
  let holdGazeUntil = 0
  let nextGlance = 0
  let lungeAt = -1
  let glareUntil = -1
  let relaxUntil = -1
  let lastTapPhase = 0
  let lastTossSeconds = 0

  function setTargets(): void {
    const p = MOOD_POSES[mood]
    const lunging = lungeAt >= 0
    const glaring = t < glareUntil
    const relaxing = t < relaxUntil
    S.arm.to = lunging ? -70 : relaxing ? 10 : p.arm
    S.knife.to = lunging ? 0 : relaxing ? 30 : p.knife
    S.lean.to = lunging ? 1.32 : p.lean
    S.brow.to = lunging || glaring ? 1 : p.brow
    S.anger.to = lunging || glaring ? 1 : p.anger
    S.squint.to = glaring ? Math.min(p.squint, 0.7) : p.squint
    S.happy.to = lunging || glaring ? 0 : p.happy
    S.sweat.to = p.sweat
    const motion = reduced ? 0 : 1
    S.tap.to = p.tapPeriod > 0 ? motion : 0
    S.tremble.to = p.tremble ? motion : 0
    S.bob.to = p.bob ? motion : 0
    S.wave.to = p.wave ? motion : 0
    S.toss.to = p.toss ? motion : 0
    S.shake.to = 0
    S.squash.to = 1
    S.nod.to = 0
  }

  return {
    get mood() {
      return mood
    },

    setMood(next) {
      mood = next
      nextGlance = t
      nextGlint = t + 0.6
    },

    setReducedMotion(next) {
      reduced = next
      if (reduced) {
        t = 0
        blinkAt = -1
        glintAt = -1
        lungeAt = -1
        glareUntil = -1
        relaxUntil = -1
      }
    },

    react(kind) {
      if (reduced) return
      switch (kind) {
        case 'poke':
          S.squash.v -= 5
          S.arm.v -= 420
          S.knife.v -= 260
          S.brow.v += 12
          S.anger.v += 12
          break
        case 'lunge':
          lungeAt = t
          break
        case 'approve':
          S.nod.v += 120
          S.squash.v -= 2
          break
        case 'glare':
          glareUntil = t + GLARE_DURATION
          break
        case 'relax':
          relaxUntil = t + RELAX_DURATION
          break
      }
    },

    touch({ x, y }) {
      if (reduced) return
      const dx = x - EYES_CENTRE.x
      const dy = y - EYES_CENTRE.y
      const distance = Math.hypot(dx, dy) || 1
      const reach = Math.min(distance / 200, 1) * 10
      S.gx.to = (dx / distance) * reach
      S.gy.to = (dy / distance) * reach * 0.8
      holdGazeUntil = t + TOUCH_HOLD
    },

    scrolled() {
      if (reduced) return
      S.gx.to = 4
      S.gy.to = 9
      holdGazeUntil = t + SCROLL_HOLD
    },

    step(dtIn) {
      const dt = Math.min(Math.max(dtIn, 0), MAX_DT)
      if (!reduced) t += dt
      const p = MOOD_POSES[mood]

      // The lunge winds the knife up overhead, then stabs back down.
      if (lungeAt >= 0 && t - lungeAt >= LUNGE_WIND_UP) {
        lungeAt = -1
        S.arm.v += 900
        S.shake.x = 1
        S.shake.v = 0
      }
      setTargets()

      if (p.gaze) {
        S.gx.to = p.gaze[0]
        S.gy.to = p.gaze[1]
      } else if (!reduced && t >= holdGazeUntil && t >= nextGlance) {
        const glance = p.stare ? STARE : GLANCES[Math.floor(random() * GLANCES.length)]
        S.gx.to = glance[0]
        S.gy.to = glance[1]
        nextGlance = t + (p.stare ? 3.5 : 1.8 + random() * 2.6)
      }

      let blink = 1
      if (!reduced) {
        if (blinkAt < 0 && t >= nextBlink) blinkAt = t
        if (blinkAt >= 0) {
          const duration = p.stare ? 0.46 : 0.15
          const elapsed = t - blinkAt
          if (elapsed >= duration) {
            blinkAt = -1
            nextBlink = t + (p.stare ? 4.5 : 1.6) + random() * 3.2
          } else {
            blink = 1 - 0.92 * Math.sin((elapsed / duration) * Math.PI)
          }
        }
      }

      const tapPhase = p.tapPeriod > 0 ? (t % p.tapPeriod) / p.tapPeriod : 0
      const tapA = p.tapPeriod > 0 ? tapAngle(tapPhase) : 0
      if (!reduced && p.tapPeriod > 0 && S.tap.x > 0.5 && lastTapPhase < 0.8 && tapPhase >= 0.8) {
        S.squash.v -= 1.4
        if (p.strikeGlint && glintAt < 0) glintAt = t
      }
      lastTapPhase = tapPhase

      const tossSeconds = t % TOSS_PERIOD
      const toss = p.toss ? tossAt(tossSeconds) : { arm: 0, spin: 0, lift: 0 }
      if (!reduced && p.toss && lastTossSeconds < CATCH && tossSeconds >= CATCH) S.squash.v -= 1.5
      lastTossSeconds = tossSeconds

      if (!reduced && p.glintEvery > 0 && glintAt < 0 && t >= nextGlint) glintAt = t
      let glintX = -80
      if (glintAt >= 0) {
        const g = (t - glintAt) / GLINT_DURATION
        if (g >= 1) {
          glintAt = -1
          nextGlint = t + p.glintEvery * (0.75 + random() * 0.5)
        } else {
          const eased = g < 0.5 ? 2 * g * g : 1 - Math.pow(-2 * g + 2, 2) / 2
          glintX = -60 + eased * 330
        }
      }

      for (const s of Object.values(S)) {
        if (reduced) {
          s.x = s.to
          s.v = 0
        } else {
          stepSpring(s, dt)
        }
      }

      const arm =
        S.arm.x + 1.1 * S.tremble.x * Math.sin((TAU * t) / 0.09) + tapA * S.tap.x + toss.arm * S.toss.x
      // The knife's lift is straight up in world space; the knife lives in the
      // rotated wing, so turn that vector back by the arm's angle.
      const lift = toss.lift * S.toss.x
      const radians = (arm * Math.PI) / 180
      const knifeOffset: [number, number] = lift === 0 ? [0, 0] : [-lift * Math.sin(radians), -lift * Math.cos(radians)]
      const happy = clamp01(S.happy.x)
      const brow = clamp01(S.brow.x)

      return {
        shake: 9 * S.shake.x * Math.sin((TAU * t) / 0.07),
        hop: -9 * S.bob.x * Math.pow(Math.sin((TAU * t) / 1.8), 2),
        sway: 1.8 * Math.sin((TAU * t) / 4.2) + S.nod.x,
        scaleX: S.lean.x * (2 - S.squash.x),
        scaleY: S.lean.x * S.squash.x,
        breathe: 1 + 0.012 * Math.sin((TAU * t) / 2.6),
        arm,
        knife: S.knife.x + tapA * 0.5 * S.tap.x + toss.spin * S.toss.x,
        knifeOffset,
        rightWing: 6 * S.wave.x * Math.sin((TAU * t) / 0.7),
        gazeX: S.gx.x,
        gazeY: S.gy.x,
        eyeScaleY: Math.max(0.02, (1 - happy) * blink * S.squint.x),
        eyesOpacity: 1 - happy,
        happyOpacity: happy,
        happyLift: (1 - happy) * 8,
        browsOpacity: Math.min(1, brow * 1.6),
        browFlat: 12 * (1 - Math.min(Math.max(S.anger.x, 0), 1.2)),
        browsDx: S.gx.x * 0.4,
        browsDy: S.gy.x * 0.4 + 10 * (1 - brow) + 7 * (1 - S.squint.x),
        glintX,
        sweatOpacity: clamp01(S.sweat.x),
      }
    },
  }
}

const n = (value: number) => Number(value.toFixed(3))

/** The pose as SVG `transform` values, with pivots from duck-rig.svg. */
export function poseToTransforms(pose: RigPose): DuckTransforms {
  const eye = (cx: number, cy: number) =>
    `translate(${n(pose.gazeX)} ${n(pose.gazeY)}) translate(${cx} ${cy}) scale(1 ${n(pose.eyeScaleY)}) translate(${-cx} ${-cy})`
  return {
    whole: `translate(${n(pose.shake)} ${n(pose.hop)}) rotate(${n(pose.sway)} 234 500) translate(234 500) scale(${n(pose.scaleX)} ${n(pose.scaleY)}) translate(-234 -500)`,
    body: `translate(234 490) scale(1 ${n(pose.breathe)}) translate(-234 -490)`,
    leftWing: `rotate(${n(pose.arm)} 51 195)`,
    knife: `translate(${n(pose.knifeOffset[0])} ${n(pose.knifeOffset[1])}) rotate(${n(pose.knife)} 100 332)`,
    rightWing: `rotate(${n(pose.rightWing)} 405 225)`,
    eyeL: eye(155.5, 177.4),
    eyeR: eye(314.8, 170.6),
    happy: `translate(0 ${n(pose.happyLift)})`,
    brows: `translate(${n(pose.browsDx)} ${n(pose.browsDy)})`,
    browL: `rotate(${n(-pose.browFlat)} 154 154.5)`,
    browR: `rotate(${n(pose.browFlat)} 316.5 148)`,
    glint: `translate(${n(pose.glintX + 100)} 0)`,
  }
}

export const LUNGE_POKES = 3
export const LUNGE_WINDOW_MS = 1800

/** Adds a poke at `now` (ms): the third within 1.8 s is a lunge, and starts the count over. */
export function registerPoke(recent: readonly number[], now: number): { kind: 'poke' | 'lunge'; recent: number[] } {
  const inWindow = [...recent.filter((at) => now - at < LUNGE_WINDOW_MS), now]
  return inWindow.length >= LUNGE_POKES ? { kind: 'lunge', recent: [] } : { kind: 'poke', recent: inWindow }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/mascot/__tests__/rig.test.ts`
Expected: PASS, 19 tests (4 for the helpers, 8 held moods, 6 more rig behaviours, 1 for transforms, 2 for `registerPoke`). If "settles on the pose of a new mood" is off by a tremble amplitude, check that `hunting` has `tremble: true` and that the tremble term uses `1.1 * S.tremble.x`.

- [ ] **Step 5: Commit**

```bash
git add src/components/mascot/rig.ts src/components/mascot/__tests__/rig.test.ts
git commit -F - <<'EOF'
feat: add the duck's motion rig: spring poses per mood, tap cycle and knife toss

The knife only ever turns about the grip while held; tests pin that for
every mood, plus the toss's continuity and the reduced-motion still pose.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: The animated duck on every screen

**Files:**
- Create: `src/components/mascot/duckArt.tsx`, `src/components/mascot/useTouchGaze.ts`, `src/components/mascot/__tests__/Mascot.test.tsx`
- Rewrite: `src/components/mascot/Mascot.tsx`
- Modify: `src/screens/Today/TodayScreen.tsx:73`, `src/screens/Today/DayCompleteCelebration.tsx:44`, `src/screens/Victory/VictoryScreen.tsx:61`, `src/screens/Today/PreStartView.tsx:19`, `src/screens/RestartFlow/DayFailedScreen.tsx:41,61`, `src/components/StorageErrorScreen.tsx:42`, `src/components/AppErrorBoundary.tsx:51`

**Interfaces:**
- Consumes: `createRig`, `poseToTransforms`, `DuckMood`, `DuckReaction`, `Rig`, `RigPose` (Task 2).
- Produces:
  - `Mascot({ mood, size?, reaction?, decorative? })`, re-exporting `DuckMood` and `DuckReaction`. `reaction` is `{ kind: DuckReaction; id: number }`, and a new object triggers the reaction again.
  - `DuckArt({ ref?, size, label? })`, whose parts carry `data-part` attributes.
  - `useTouchGaze(svgRef, rigRef)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/mascot/__tests__/Mascot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MotionConfig, MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it } from 'vitest'
import { Mascot } from '../Mascot'

describe('Mascot', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('names the duck and his mood for screen readers', () => {
    render(<Mascot mood="sad" />)
    expect(screen.getByRole('img', { name: 'The duck, looking sad' })).toBeInTheDocument()
  })

  it('stays out of the accessibility tree when decorative', () => {
    const { container } = render(<Mascot mood="watching" decorative />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws the still pose of the mood right away under reduced motion', () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <Mascot mood="hunting" />
      </MotionConfig>,
    )
    expect(container.querySelector('[data-part="left-wing"]')).toHaveAttribute('transform', 'rotate(-26 51 195)')
    expect(container.querySelector('[data-part="knife"]')).toHaveAttribute(
      'transform',
      'translate(0 0) rotate(26 100 332)',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/mascot/__tests__/Mascot.test.tsx`
Expected: FAIL. TypeScript/Vitest reports that `mood` is not a prop (the old component takes `state`), or the `img` role query fails with `Unable to find an accessible element with the role "img" and name "The duck, looking sad"`.

- [ ] **Step 3: Create the art**

Create `src/components/mascot/duckArt.tsx`. The paths are copied verbatim from `docs/superpowers/specs/2026-09-25-knife-duck-companion/duck-rig.svg`.

```tsx
import { useId, type Ref } from 'react'

// Colours from the reference image. They stay the same in both themes; on the
// dark canvas the yellow body carries the silhouette.
const OUTLINE = '#5a1a16'
const BODY_FILL = '#f9dd97'
const ORANGE = '#ffb624'
const BLADE_GREY = '#d8d7d5'
const HANDLE_PINK = '#ffa6c5'
const ACCENT = '#ffc605'
const SWEAT_BLUE = '#38b6ff'

const FOOT_LEFT =
  'M96 460 C91 460 99 467 101 471 C103 475 103 480 106 484 C109 488 113 491 117 494 C121 497 126 499 131 501 C136 503 144 505 150 506 C156 507 160 507 165 507 C170 507 174 507 177 505 C180 503 182 500 184 497 C186 494 188 490 186 487 C184 484 179 481 170 478 C161 475 142 473 130 470 C118 467 101 460 96 460 Z'
const FOOT_RIGHT =
  'M279 478 C276 481 278 488 281 491 C284 494 290 496 294 498 C298 500 302 500 307 500 C312 500 316 500 321 499 C326 498 330 498 334 496 C338 494 344 491 348 488 C352 485 354 483 356 480 C358 477 359 472 360 468 C361 464 366 459 361 458 C356 457 340 462 330 464 C320 466 308 470 300 472 C292 474 282 475 279 478 Z'
/** Head and body in one piece, including the edges the wings cover (seen when an arm lifts). */
const BODY =
  'M238 39 C229 38 222 39 215 39 C208 39 203 40 196 41 C189 42 182 44 173 47 C164 50 154 55 145 60 C136 65 129 70 122 75 C115 80 109 86 104 91 C99 96 95 100 90 106 C85 112 80 121 76 127 C72 133 72 134 69 140 C66 146 62 157 59 165 C56 173 54 180 52 190 C50 200 48 212 47 225 C46 238 44 252 43 265 C42 278 41 292 40 305 C39 318 39 330 39 340 C39 350 39 357 40 365 C41 373 41 378 44 387 C47 396 52 410 58 420 C64 430 70 438 77 446 C84 454 90 463 101 469 C112 475 131 478 145 481 C159 484 171 485 183 486 C195 487 205 486 215 486 C225 486 235 486 243 486 C251 486 258 485 265 484 C272 483 280 480 287 479 C294 478 303 476 310 475 C317 474 324 472 330 470 C336 468 343 465 348 463 C353 461 357 462 362 458 C367 454 373 446 377 440 C381 434 384 431 388 424 C392 417 396 405 399 398 C402 391 402 387 403 381 C404 375 404 368 404 360 C404 352 403 345 403 335 C403 325 403 312 403 300 C403 288 404 275 405 262 C406 249 408 237 407 224 C406 211 401 196 397 184 C393 172 391 163 385 151 C379 139 372 123 363 111 C354 99 343 87 334 79 C325 71 318 68 311 63 C304 58 298 55 291 52 C284 49 277 46 268 44 C259 42 247 40 238 39 Z'
const RIGHT_WING_FILL =
  'M405 215 C407 215 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 404 338 402 331 C400 324 396 312 394 300 C392 288 393 274 393 262 C393 250 394 234 396 226 C398 218 403 215 405 215 Z'
const RIGHT_WING_STROKE =
  'M405 215 C405 216 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 402 333 402 331'
const LEFT_WING_FILL =
  'M51 195 C46 197 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 86 350 88 346 C90 342 93 334 96 325 C99 316 103 307 104 295 C105 283 103 267 100 255 C97 243 91 231 86 222 C81 213 74 204 68 200 C62 196 56 193 51 195 Z'
const LEFT_WING_STROKE =
  'M51 195 C49 198 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 87 347 88 346'
const BLADE =
  'M112 313 L224 310 C232 310 237 314 237 321 C236 330 229 339 221 346 C206 360 188 372 164 375 C146 376 128 366 112 353 Z'
const HANDLE = 'M95 314 L112 313 L111 350 L88 350 Z'
const SWEAT = 'M330 92 C322 108 318 117 330 124 C342 117 338 108 330 92 Z'

/** The art's viewBox: its width over height is 490 / 500. */
export const DUCK_VIEWBOX = '-10 20 490 500'

interface DuckArtProps {
  ref?: Ref<SVGSVGElement>
  size: number
  /** Accessible name; omit to hide the art from assistive tech. */
  label?: string
}

/**
 * The knife-holding duck as layered SVG, traced from the user's reference
 * image. Each animated layer has a `data-part` that Mascot.tsx drives; the
 * pivots in rig.ts match this geometry.
 */
export function DuckArt({ ref, size, label }: DuckArtProps) {
  const clipId = `duck-blade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }

  return (
    <svg ref={ref} viewBox={DUCK_VIEWBOX} width={size} height={(size * 500) / 490} overflow="visible" {...a11y}>
      <defs>
        <clipPath id={clipId}>
          <path d={BLADE} />
        </clipPath>
      </defs>
      <g data-part="whole">
        <g stroke={OUTLINE} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round">
          <path fill={ORANGE} d={FOOT_LEFT} />
          <path fill={ORANGE} d={FOOT_RIGHT} />
          <g data-part="body">
            <path fill={BODY_FILL} d={BODY} />
            <g data-part="right-wing">
              <path fill={BODY_FILL} stroke="none" d={RIGHT_WING_FILL} />
              <path fill="none" d={RIGHT_WING_STROKE} />
              <line x1={398} y1={306} x2={400} y2={319} stroke={ACCENT} strokeWidth={10} />
            </g>
            <g data-part="eyes" stroke="none" fill={OUTLINE}>
              <ellipse data-part="eye-left" cx={155.5} cy={177.4} rx={12.8} ry={12.8} />
              <ellipse data-part="eye-right" cx={314.8} cy={170.6} rx={12.8} ry={12.8} />
            </g>
            <g data-part="happy" fill="none" strokeWidth={10} opacity={0}>
              <path d="M139 184 Q155.5 164 172 184" />
              <path d="M298 177 Q314.8 157 331 177" />
            </g>
            <g data-part="brows" strokeWidth={11} opacity={0}>
              <path data-part="brow-left" d="M128 146 L180 163" />
              <path data-part="brow-right" d="M342 139 L291 157" />
            </g>
            <path data-part="sweat" d={SWEAT} fill={SWEAT_BLUE} strokeWidth={8} opacity={0} />
            <ellipse cx={239} cy={213} rx={64} ry={26} fill={ORANGE} strokeWidth={13} />
            <g data-part="left-wing">
              <path fill={BODY_FILL} stroke="none" d={LEFT_WING_FILL} />
              <path fill="none" d={LEFT_WING_STROKE} />
              <line x1={114} y1={271} x2={98} y2={303} stroke={ACCENT} strokeWidth={9} />
              <g data-part="knife">
                <path fill={BLADE_GREY} strokeWidth={13} d={BLADE} />
                <g clipPath={`url(#${clipId})`} stroke="none">
                  <path
                    data-part="glint"
                    d="M0 290 L22 290 L-8 390 L-30 390 Z"
                    fill="#ffffff"
                    opacity={0.9}
                    transform="translate(20 0)"
                  />
                </g>
                <path fill={HANDLE_PINK} strokeWidth={13} d={HANDLE} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
```

- [ ] **Step 4: Create the touch gaze hook**

Create `src/components/mascot/useTouchGaze.ts`:

```ts
import { useEffect, type RefObject } from 'react'
import type { Rig } from './rig'

/**
 * Tells the rig where fingers touch the screen, converted to the art's SVG
 * units, and when the page scrolls. There's no hover tracking: an iPhone has
 * none. A mouse only counts while a button is pressed, like a finger.
 */
export function useTouchGaze(svgRef: RefObject<SVGSVGElement | null>, rigRef: RefObject<Rig | null>): void {
  useEffect(() => {
    const look = (event: PointerEvent) => {
      const ctm = svgRef.current?.getScreenCTM?.()
      if (!ctm) return
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
      rigRef.current?.touch({ x: point.x, y: point.y })
    }
    const onMove = (event: PointerEvent) => {
      if (event.buttons !== 0) look(event)
    }
    const onScroll = () => rigRef.current?.scrolled()

    window.addEventListener('pointerdown', look, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', look)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [svgRef, rigRef])
}
```

- [ ] **Step 5: Rewrite the component**

Replace the whole of `src/components/mascot/Mascot.tsx` with:

```tsx
import { useAnimationFrame, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { DuckArt } from './duckArt'
import { createRig, poseToTransforms, type DuckMood, type DuckReaction, type Rig, type RigPose } from './rig'
import { useTouchGaze } from './useTouchGaze'

export type { DuckMood, DuckReaction } from './rig'

const MOOD_LABELS: Record<DuckMood, string> = {
  content: 'The duck, satisfied',
  watching: 'The duck, watching you',
  tapping: 'The duck, tapping his knife',
  hunting: 'The duck, knife raised',
  celebrating: 'The duck, celebrating',
  triumphant: 'The duck, knife held high',
  judging: 'The duck, staring at you',
  waiting: 'The duck, waiting',
  sad: 'The duck, looking sad',
}

const PART_NAMES = [
  'whole',
  'body',
  'left-wing',
  'knife',
  'right-wing',
  'eyes',
  'eye-left',
  'eye-right',
  'happy',
  'brows',
  'brow-left',
  'brow-right',
  'glint',
  'sweat',
] as const

type Parts = Record<(typeof PART_NAMES)[number], SVGElement>

function collectParts(svg: SVGSVGElement): Parts {
  const parts: Partial<Parts> = {}
  for (const name of PART_NAMES) {
    const element = svg.querySelector<SVGElement>(`[data-part="${name}"]`)
    if (element) parts[name] = element
  }
  return parts as Parts
}

/** Writes one pose into the SVG: attributes only, so React never re-renders per frame. */
function draw(parts: Parts, pose: RigPose): void {
  const t = poseToTransforms(pose)
  parts.whole.setAttribute('transform', t.whole)
  parts.body.setAttribute('transform', t.body)
  parts['left-wing'].setAttribute('transform', t.leftWing)
  parts.knife.setAttribute('transform', t.knife)
  parts['right-wing'].setAttribute('transform', t.rightWing)
  parts['eye-left'].setAttribute('transform', t.eyeL)
  parts['eye-right'].setAttribute('transform', t.eyeR)
  parts.eyes.setAttribute('opacity', pose.eyesOpacity.toFixed(3))
  parts.happy.setAttribute('opacity', pose.happyOpacity.toFixed(3))
  parts.happy.setAttribute('transform', t.happy)
  parts.brows.setAttribute('opacity', pose.browsOpacity.toFixed(3))
  parts.brows.setAttribute('transform', t.brows)
  parts['brow-left'].setAttribute('transform', t.browL)
  parts['brow-right'].setAttribute('transform', t.browR)
  parts.glint.setAttribute('transform', t.glint)
  parts.sweat.setAttribute('opacity', pose.sweatOpacity.toFixed(3))
}

interface MascotProps {
  mood: DuckMood
  size?: number
  /** A one-off reaction; pass a new object (a new `id`) to trigger it again. */
  reaction?: { kind: DuckReaction; id: number }
  /** Hidden from assistive tech, for when nearby text already carries the message. */
  decorative?: boolean
}

/**
 * The companion: the knife-holding duck, animated by the motion rig in
 * rig.ts. One frame loop per duck writes SVG attributes directly (the most
 * reliable transform path on WebKit). Under reduced motion he holds his
 * mood's pose.
 */
export function Mascot({ mood, size = 120, reaction, decorative = false }: MascotProps) {
  const reducedMotion = useReducedMotionConfig() ?? false
  const svgRef = useRef<SVGSVGElement>(null)
  const partsRef = useRef<Parts | null>(null)
  const rigRef = useRef<Rig | null>(null)
  if (rigRef.current === null) rigRef.current = createRig({ mood, reducedMotion })

  useLayoutEffect(() => {
    if (!svgRef.current || !rigRef.current) return
    partsRef.current = collectParts(svgRef.current)
    draw(partsRef.current, rigRef.current.step(0))
  }, [])

  useEffect(() => {
    rigRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    rigRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    if (reaction) rigRef.current?.react(reaction.kind)
  }, [reaction])

  useTouchGaze(svgRef, rigRef)

  useAnimationFrame((_, delta) => {
    if (partsRef.current && rigRef.current) draw(partsRef.current, rigRef.current.step(delta / 1000))
  })

  return <DuckArt ref={svgRef} size={size} label={decorative ? undefined : MOOD_LABELS[mood]} />
}
```

- [ ] **Step 6: Run the component test to verify it passes**

Run: `npx vitest run src/components/mascot/__tests__/Mascot.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 7: Switch every screen to a mood**

Edit these call sites. The old `state` prop no longer exists, so `npx tsc -b` finds any that are missed.

`src/screens/Today/TodayScreen.tsx:73` (this is temporary; Task 8 replaces the whole block):
```tsx
          <Mascot mood={completion.isComplete ? 'content' : 'watching'} size={88} decorative />
```

`src/screens/Today/DayCompleteCelebration.tsx:44`:
```tsx
          <Mascot mood="celebrating" size={140} />
```

`src/screens/Victory/VictoryScreen.tsx:61`:
```tsx
        <Mascot mood="triumphant" size={160} />
```

`src/screens/Today/PreStartView.tsx:19`:
```tsx
      <Mascot mood="waiting" size={120} />
```

`src/screens/RestartFlow/DayFailedScreen.tsx:41`:
```tsx
      <Mascot mood="judging" />
```
and replace the closing line at `DayFailedScreen.tsx:61`:
```tsx
      <p className="mt-2 font-rounded font-bold text-ink">Again. From Day 1. I'm watching.</p>
```

`src/components/StorageErrorScreen.tsx:42`:
```tsx
      <Mascot mood={problem === 'failed' ? 'sad' : 'waiting'} size={110} />
```

`src/components/AppErrorBoundary.tsx:51`:
```tsx
        <Mascot mood="sad" size={110} />
```

- [ ] **Step 8: Type-check, lint, and run all tests**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: the type check finishes with no output, lint reports 0 errors, and all tests pass. The existing `mascotLine` tests still pass: nothing has changed them yet.

- [ ] **Step 9: Look at it**

Start the dev server with the `preview_start` tool, `{ name: "dev" }`. Then open `http://localhost:5173/?db=duck` and seed the scenario from the browser console:

```js
const s = await import('/src/dev/scenarios.ts'); await s.seedPreStart(3)
```

Take a screenshot. The pre-start screen should show the duck tapping his knife slowly, knife in hand, with no stray outline at the shoulder. Then run `await s.seedMissedDay()`: you should see the `judging` duck and the line "Again. From Day 1. I'm watching."

- [ ] **Step 10: Commit**

```bash
git add src/components/mascot src/screens/Today/TodayScreen.tsx src/screens/Today/DayCompleteCelebration.tsx src/screens/Victory/VictoryScreen.tsx src/screens/Today/PreStartView.tsx src/screens/RestartFlow/DayFailedScreen.tsx src/components/StorageErrorScreen.tsx src/components/AppErrorBoundary.tsx
git commit -F - <<'EOF'
feat: replace the blob mascot with the animated knife-holding duck

A traced, layered SVG driven by the motion rig: he breathes, blinks,
glances around, follows touches (never hover), and each screen gets its
mood: celebrating, triumphant, waiting, judging or sad.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Store the bedtime and the day's plans

**Files:**
- Modify: `src/db/types.ts:10-23`, `src/db/repositories/dayEntryRepo.ts:96-98`, `src/db/repositories/settingsRepo.ts:4-14`, `src/db/exportImport.ts:1-6,108-120`, `src/hooks/useSettings.ts`
- Test: `src/db/__tests__/repositories.test.ts`, `src/db/__tests__/exportImport.test.ts`, `src/hooks/__tests__/useSettings.test.ts` (new)

**Interfaces:**
- Consumes: `parseHHmm`, `isValidBedtime`, `bedtimeMinutes`, `formatHHmm`, `DEFAULT_BEDTIME` (Task 1); `TASK_IDS` (`src/logic/dayCompletion.ts`).
- Produces: `DayEntry.plans?: Partial<Record<TaskId, string>>`; `dayEntryRepo.setPlans(id: number, plans: Partial<Record<TaskId, string>>): Promise<void>`; `SETTING_KEYS.bedtime`; `useSettings()` returns `bedtime: string` ("HH:mm") and `setBedtime(value: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

In `src/db/__tests__/repositories.test.ts`, add this block at the end of the file:

```ts
describe('dayEntryRepo.setPlans', () => {
  it('saves a day plan, drops malformed times, and removes an empty plan', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', workouts: '25:00' })
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })

    await dayEntryRepo.setPlans(entry.id, {})
    expect(await db.dayEntries.get(entry.id)).not.toHaveProperty('plans')
  })
})
```

In `src/db/__tests__/exportImport.test.ts`, add this test inside `describe('export → reset → import', …)`:

```ts
  it('keeps day plans through a backup', async () => {
    await seedEverything()
    const [entry] = await db.dayEntries.toArray()
    await db.dayEntries.update(entry.id, { plans: { reading: '22:30' } })

    await roundTrip()

    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })
  })
```

And add this test inside `describe('validateExportPayload', …)`:

```ts
  it('rejects a day plan with an unknown task or an impossible time', async () => {
    const base = await validPayload()
    for (const plans of [{ reading: '25:00' }, { naps: '14:00' }, 'tonight']) {
      const payload = structuredClone(base)
      ;(payload.dayEntries as Record<string, unknown>[])[0].plans = plans
      expect(validateExportPayload(payload).ok).toBe(false)
    }
  })
```

Create `src/hooks/__tests__/useSettings.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import { useSettings } from '../useSettings'

describe('useSettings: bedtime', () => {
  beforeEach(freshDatabase)

  it('loads a saved bedtime', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '21:45')
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtime).toBe('21:45'))
  })

  it('falls back to 23:00 for a stored value it cannot use', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '03:00')
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtime).toBe('23:00'))
  })

  it('saves a bedtime in range and refuses one out of range', async () => {
    const { result } = renderHook(() => useSettings())
    await act(() => result.current.setBedtime('22:30'))
    await waitFor(() => expect(result.current.bedtime).toBe('22:30'))

    await act(() => result.current.setBedtime('17:00'))
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, null)).toBe('22:30')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts src/hooks/__tests__/useSettings.test.ts`
Expected: FAIL, because `dayEntryRepo.setPlans is not a function`, `SETTING_KEYS.bedtime` is undefined, and the malformed-plan payload validates as ok.

- [ ] **Step 3: Implement**

In `src/db/types.ts`, add the import at the top of the file:

```ts
import type { TaskId } from '../logic/types'
```

and add the field to `DayEntry`, just before `completed: boolean`:

```ts
  /** Today's plan: when each task will be done, as local "HH:mm". Read by the Today duck only. */
  plans?: Partial<Record<TaskId, string>>
```

In `src/db/repositories/dayEntryRepo.ts`, change the imports at the top to:

```ts
import { hasAnyProgress, TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { parseHHmm } from '../../logic/menace'
import type { TaskId } from '../../logic/types'
import { syncDayCompletion } from '../completion'
import { db } from '../db'
import { groupWorkoutsByEntry, toDayTaskData } from '../mappers'
import type { DayEntry } from '../types'
```

and add this method to the object, after `update`:

```ts
  /** Replaces the day's plan; an empty plan removes the field. Plans never affect completion, so there's no re-sync. */
  async setPlans(id: number, plans: Partial<Record<TaskId, string>>): Promise<void> {
    const cleaned: Partial<Record<TaskId, string>> = {}
    for (const task of TASK_IDS) {
      const time = plans[task]
      if (time !== undefined && parseHHmm(time) !== null) cleaned[task] = time
    }
    await db.dayEntries.update(id, { plans: Object.keys(cleaned).length > 0 ? cleaned : undefined })
  },
```

In `src/db/repositories/settingsRepo.ts`, add this key to `SETTING_KEYS`, after `theme`:

```ts
  /** "HH:mm", 18:00–23:59 — the duck only turns menacing when what's left no longer fits before it. */
  bedtime: 'bedtime',
```

Replace the whole of `src/hooks/useSettings.ts` with:

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'
import { bedtimeMinutes, DEFAULT_BEDTIME, formatHHmm, isValidBedtime } from '../logic/menace'

/** App-wide preferences, persisted in Dexie's settings table: sound and haptics (both default on) and the bedtime. */
export function useSettings() {
  const soundEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.soundEnabled, true), []) ?? true
  const hapticsEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.hapticsEnabled, true), []) ?? true
  const storedBedtime = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.bedtime, DEFAULT_BEDTIME), [])
  const bedtime = formatHHmm(bedtimeMinutes(storedBedtime ?? DEFAULT_BEDTIME))

  return {
    soundEnabled,
    hapticsEnabled,
    bedtime,
    setSoundEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.soundEnabled, value),
    setHapticsEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.hapticsEnabled, value),
    /** Saves an "HH:mm" bedtime; values outside 18:00–23:59 are ignored. */
    setBedtime: async (value: string) => {
      if (isValidBedtime(value)) await settingsRepo.set(SETTING_KEYS.bedtime, value)
    },
  }
}
```

In `src/db/exportImport.ts`, add these imports under the existing `import { todayISO } from '../lib/dates'`:

```ts
import { TASK_IDS } from '../logic/dayCompletion'
import { parseHHmm } from '../logic/menace'
```

Add this checker after `isOptional`:

```ts
const isPlanMap = (value: unknown): boolean =>
  isRow(value) &&
  Object.entries(value).every(
    ([task, time]) => (TASK_IDS as readonly string[]).includes(task) && isString(time) && parseHHmm(time) !== null,
  )
```

And add `plans` to the `dayEntries` row checks, after `photoId: isOptional(isNumber),`:

```ts
    plans: isOptional(isPlanMap),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts src/hooks/__tests__/useSettings.test.ts`
Expected: PASS: the existing tests plus the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/db/types.ts src/db/repositories/dayEntryRepo.ts src/db/repositories/settingsRepo.ts src/db/exportImport.ts src/hooks/useSettings.ts src/db/__tests__/repositories.test.ts src/db/__tests__/exportImport.test.ts src/hooks/__tests__/useSettings.test.ts
git commit -F - <<'EOF'
feat: store a bedtime setting and each day's plan, and check plans on import

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: The minute clock

**Files:**
- Create: `src/hooks/useNow.ts`
- Test: `src/hooks/__tests__/useNow.test.ts`

**Interfaces:**
- Consumes: `parseHHmm` (Task 1).
- Produces: `useNow(): number`, the minutes since local midnight. Dev builds honour `?now=HH:mm`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useNow.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 25, 21, 14, 50))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('returns the minutes since local midnight', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe(21 * 60 + 14)
  })

  it('keeps ticking while the app stays open', () => {
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current).toBe(21 * 60 + 15)
  })

  it('re-checks the time when the app becomes visible again', () => {
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 25, 23, 5))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(23 * 60 + 5)
  })

  it('can be frozen with ?now= in development', () => {
    window.history.replaceState(null, '', '/?now=22:30')
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe(22 * 60 + 30)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useNow.test.ts`
Expected: FAIL, with `Failed to resolve import "../useNow"`.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useNow.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { parseHHmm } from '../logic/menace'

const TICK_MS = 30_000

/** Dev only: `?now=HH:mm` freezes the clock, to see every menace level. Production builds ignore it. */
function devOverride(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('now')
  return value ? parseHHmm(value) : null
}

function currentMinutes(): number {
  const override = devOverride()
  if (override !== null) return override
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS)
  // Timers are throttled or frozen while the app is hidden or the phone sleeps.
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('focus', onChange)
  window.addEventListener('pageshow', onChange)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('focus', onChange)
    window.removeEventListener('pageshow', onChange)
  }
}

/** Minutes since local midnight, kept current while the app is open. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, currentMinutes)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useNow.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNow.ts src/hooks/__tests__/useNow.test.ts
git commit -F - <<'EOF'
feat: add a minute clock, with a dev-only ?now= override

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: The duck's lines

**Files:**
- Modify: `src/content/microcopy.ts` (append after `taskCheer`; `mascotLine` stays until Task 8)
- Test: `src/content/__tests__/microcopy.test.ts` (append)

**Interfaces:**
- Consumes: `Menace`, `formatHHmm` (Task 1); `TASK_IDS`, `TASK_NAMES`.
- Produces:
  - `duckLine(params: { menace: Menace; missing: readonly TaskId[]; dayNumber: number }): string`
  - `pokeLine(count: number): string`
  - `planSavedLine(at: number): string`
  - Constants: `POKE_LINES`, `LUNGE_LINE = "That's it."`, `GLARE_LINE = 'I saw that.'`

- [ ] **Step 1: Write the failing test**

Append to `src/content/__tests__/microcopy.test.ts`. First extend the imports at the top:

```ts
import type { Menace, MenaceLevel, MenaceReason } from '../../logic/menace'
import { duckLine, GLARE_LINE, LUNGE_LINE, mascotLine, planSavedLine, pokeLine, POKE_LINES, taskCheer } from '../microcopy'
```

(That replaces the existing `import { mascotLine, taskCheer } from '../microcopy'`.) Then add at the end of the file:

```ts
const threat = (level: MenaceLevel, reason: MenaceReason, extra: Partial<Menace> = {}): Menace => ({
  level,
  reason,
  ...extra,
})

describe('duckLine', () => {
  it('rests the knife on a perfect day, with a line that rotates by day', () => {
    expect(duckLine({ menace: threat('content', 'done'), missing: [], dayNumber: 1 })).toBe(
      'Perfect day. The knife rests.',
    )
    expect(duckLine({ menace: threat('content', 'done'), missing: [], dayNumber: 2 })).toBe('All five. You may live.')
  })

  it('watches an untouched day, then counts progress', () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1 })).toBe(
      "New day. I'm watching.",
    )
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['water', 'reading'], dayNumber: 1 })).toBe(
      "3 down, 2 to go. I'm watching.",
    )
  })

  it('names the last task left', () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['photo'], dayNumber: 1 })).toBe(
      'Just the photo left. Smile. Or else.',
    )
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['water'], dayNumber: 1 })).toBe(
      'Just the water left. Drink.',
    )
  })

  it('quotes the plan back', () => {
    const plan = { task: 'reading' as const, at: 22 * 60 + 30 }
    expect(duckLine({ menace: threat('watching', 'plan-pending', { next: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      "Reading at 22:30. I'll be there.",
    )
    expect(duckLine({ menace: threat('watching', 'plan-due', { next: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      "It's 22:30. Reading. I'm watching.",
    )
    expect(duckLine({ menace: threat('tapping', 'plan-broken', { broken: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      'You said 22:30.',
    )
  })

  it('escalates as time runs out', () => {
    const missing = ['reading'] as const
    expect(duckLine({ menace: threat('tapping', 'close'), missing, dayNumber: 1 })).toBe(
      "Tick. Tock. You're cutting it close.",
    )
    expect(duckLine({ menace: threat('hunting', 'wont-fit'), missing, dayNumber: 1 })).toBe(
      "Midnight's coming. So am I.",
    )
    expect(duckLine({ menace: threat('hunting', 'past-bedtime'), missing, dayNumber: 1 })).toBe(
      'Past your bedtime. Not mine.',
    )
  })
})

describe('reaction lines', () => {
  it('cycles through the poke lines', () => {
    expect(pokeLine(0)).toBe('Hands off. Hands on your water bottle.')
    expect(pokeLine(POKE_LINES.length)).toBe(pokeLine(0))
    expect(LUNGE_LINE).toBe("That's it.")
    expect(GLARE_LINE).toBe('I saw that.')
  })

  it('confirms the earliest plan', () => {
    expect(planSavedLine(20 * 60 + 5)).toBe('20:05. Not a minute later.')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/__tests__/microcopy.test.ts`
Expected: FAIL, with `duckLine is not a function` (and the same for the other new exports).

- [ ] **Step 3: Write the implementation**

In `src/content/microcopy.ts`, add these imports at the top, below the existing ones:

```ts
import { formatHHmm, type Menace } from '../logic/menace'
```

Then append at the end of the file:

```ts
/** The duck's lines once every task is done, rotated by day number. */
const CONTENT_LINES = ['Perfect day. The knife rests.', 'All five. You may live.', 'Acceptable. Same time tomorrow.'] as const

/** What the duck says when only this task is left, and there's still time. */
const ONE_LEFT_LINES: Record<TaskId, string> = {
  workouts: 'Just the workouts left. Go.',
  diet: "Tick off your diet. I'll wait.",
  water: 'Just the water left. Drink.',
  reading: 'Just your pages left. Read.',
  photo: 'Just the photo left. Smile. Or else.',
}

export const POKE_LINES = [
  'Hands off. Hands on your water bottle.',
  'Poke me again. I dare you.',
  'That tickles. The knife does not.',
] as const
export const LUNGE_LINE = "That's it."
export const GLARE_LINE = 'I saw that.'

/** The poke line for the `count`th poke (0-based), cycling. */
export function pokeLine(count: number): string {
  return POKE_LINES[count % POKE_LINES.length]
}

/** The duck's answer once a plan is saved, quoting its earliest time. */
export function planSavedLine(at: number): string {
  return `${formatHHmm(at)}. Not a minute later.`
}

function watchingLine(missing: readonly TaskId[]): string {
  const done = TASK_IDS.length - missing.length
  if (missing.length === 1) return ONE_LEFT_LINES[missing[0]]
  if (done === 0) return "New day. I'm watching."
  return `${done} down, ${missing.length} to go. I'm watching.`
}

/** The duck's speech bubble on Today, from his menace and the tasks still missing. */
export function duckLine({ menace, missing, dayNumber }: { menace: Menace; missing: readonly TaskId[]; dayNumber: number }): string {
  switch (menace.reason) {
    case 'done':
      return CONTENT_LINES[(dayNumber - 1) % CONTENT_LINES.length]
    case 'plenty':
      return watchingLine(missing)
    case 'plan-pending':
      return menace.next
        ? `${TASK_NAMES[menace.next.task]} at ${formatHHmm(menace.next.at)}. I'll be there.`
        : watchingLine(missing)
    case 'plan-due':
      return menace.next
        ? `It's ${formatHHmm(menace.next.at)}. ${TASK_NAMES[menace.next.task]}. I'm watching.`
        : watchingLine(missing)
    case 'close':
      return "Tick. Tock. You're cutting it close."
    case 'plan-broken':
      return menace.broken ? `You said ${formatHHmm(menace.broken.at)}.` : "Tick. Tock. You're cutting it close."
    case 'wont-fit':
      return "Midnight's coming. So am I."
    case 'past-bedtime':
      return 'Past your bedtime. Not mine.'
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/content/__tests__/microcopy.test.ts`
Expected: PASS: the existing `taskCheer`/`mascotLine` tests plus the 7 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/content/microcopy.ts src/content/__tests__/microcopy.test.ts
git commit -F - <<'EOF'
feat: write the duck's lines for each menace level, plan and reaction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: The knife sound

**Files:**
- Modify: `src/lib/sound.ts` (append `playKnifeShing`), `src/hooks/useSound.ts` (add `useKnifeSound`)
- Test: `src/lib/__tests__/sound.test.ts` (append)

**Interfaces:**
- Consumes: `getContext`/`resume` (private to `sound.ts`); `useSettings` (Task 4).
- Produces: `playKnifeShing(): void`; `useKnifeSound(): () => void`, gated by `soundEnabled`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/sound.test.ts`:

```ts
const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null as unknown })

/** Records which Web Audio nodes a sound builds. */
class RecordingAudioContext {
  static last: RecordingAudioContext | null = null
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  created: string[] = []
  resume = vi.fn(async () => {})

  constructor() {
    RecordingAudioContext.last = this
  }

  createBuffer(_channels: number, length: number) {
    this.created.push('buffer')
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    this.created.push('noise')
    return node()
  }
  createBiquadFilter() {
    this.created.push('filter')
    return { ...node(), type: '', Q: param(), frequency: param() }
  }
  createGain() {
    this.created.push('gain')
    return { ...node(), gain: param() }
  }
  createOscillator() {
    this.created.push('oscillator')
    return { ...node(), type: '', frequency: param() }
  }
}

describe('playKnifeShing', () => {
  beforeEach(() => {
    vi.resetModules()
    RecordingAudioContext.last = null
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'AudioContext')
  })

  it('plays a rising noise sweep and a three-partial metallic ring', async () => {
    Object.defineProperty(window, 'AudioContext', { value: RecordingAudioContext, configurable: true, writable: true })
    const { playKnifeShing } = await import('../sound')
    playKnifeShing()
    const created = RecordingAudioContext.last?.created ?? []
    expect(created).toContain('noise')
    expect(created).toContain('filter')
    expect(created.filter((kind) => kind === 'oscillator')).toHaveLength(3)
  })

  it('does nothing without Web Audio', async () => {
    const { playKnifeShing } = await import('../sound')
    expect(() => playKnifeShing()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/sound.test.ts`
Expected: FAIL, with `playKnifeShing is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/sound.ts`:

```ts
const RING_PARTIALS_HZ = [3100, 4700, 6200]

/**
 * A short synthesized blade "shing" with no audio file. It's band-passed
 * noise sweeping up (the blade sliding), then a quick metallic ring of three
 * inharmonic partials.
 */
export function playKnifeShing(): void {
  const ctx = getContext()
  if (!ctx) return
  void resume(ctx)
  const now = ctx.currentTime

  const length = Math.floor(ctx.sampleRate * 0.25)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1

  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 6
  band.frequency.setValueAtTime(2000, now)
  band.frequency.exponentialRampToValueAtTime(8000, now + 0.25)
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.25, now + 0.03)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  noise.connect(band)
  band.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.25)

  RING_PARTIALS_HZ.forEach((frequency, i) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const start = now + 0.18
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.08 / (i + 1), start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.5)
  })
}
```

Replace the whole of `src/hooks/useSound.ts` with:

```ts
import { useCallback } from 'react'
import { playChime, playKnifeShing } from '../lib/sound'
import { useSettings } from './useSettings'

/** Plays the success chime, gated by the user's sound setting. */
export function useSound() {
  const { soundEnabled } = useSettings()

  return useCallback(() => {
    if (soundEnabled) playChime()
  }, [soundEnabled])
}

/** Plays the duck's knife "shing", gated by the user's sound setting. */
export function useKnifeSound() {
  const { soundEnabled } = useSettings()

  return useCallback(() => {
    if (soundEnabled) playKnifeShing()
  }, [soundEnabled])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/sound.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sound.ts src/hooks/useSound.ts src/lib/__tests__/sound.test.ts
git commit -F - <<'EOF'
feat: synthesize the duck's knife sound, gated by the sound setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Menace on the Today screen

**Files:**
- Create: `src/hooks/useMenace.ts`, `src/screens/Today/MenaceAtmosphere.tsx`, `src/screens/Today/DuckHeader.tsx`, `src/screens/Today/__tests__/DuckHeader.test.tsx`
- Rewrite: `src/screens/Today/TodayScreen.tsx`
- Modify: `src/content/microcopy.ts` (delete `LAST_TASK_LINES` and `mascotLine`), `src/content/__tests__/microcopy.test.ts` (delete the `mascotLine` describe block, and drop `mascotLine` from the import)

**Interfaces:**
- Consumes:
  - Task 1: `menace`, `bedtimeMinutes`, `plansToMinutes`, `Menace`, `MenaceLevel`
  - Task 3: `Mascot`, `DuckMood`, `DuckReaction`, plus `registerPoke` from Task 2's rig
  - Task 4: `useSettings().bedtime`
  - Task 5: `useNow`
  - Task 6: `duckLine`, `pokeLine`, `LUNGE_LINE`, `GLARE_LINE`
  - Task 7: `useKnifeSound`
- Produces:
  - `useMenace(data: DayTaskData | undefined, entry: DayEntry | undefined, nowMin: number): Menace | undefined`
  - `MenaceAtmosphere({ level, flashes })`
  - `DuckHeader({ menace, missing, completion, dayNumber, announcement?, onLunge, children? })`
  - `DuckAnnouncement { text: string; reaction: DuckReaction; id: number }`

- [ ] **Step 1: Write the failing test**

Create `src/screens/Today/__tests__/DuckHeader.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { TASK_IDS } from '../../../logic/dayCompletion'
import type { Menace } from '../../../logic/menace'
import type { TaskId } from '../../../logic/types'
import { DuckHeader } from '../DuckHeader'

const completionOf = (missing: TaskId[]) =>
  Object.fromEntries(TASK_IDS.map((task) => [task, !missing.includes(task)])) as Record<TaskId, boolean>

const TAPPING: Menace = { level: 'tapping', reason: 'close' }

describe('DuckHeader', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('says the line for his menace', () => {
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)
    expect(screen.getByText("Tick. Tock. You're cutting it close.")).toBeInTheDocument()
  })

  it('answers a poke, and lunges on the third quick poke', async () => {
    const onLunge = vi.fn()
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={onLunge} />)
    const duck = screen.getByRole('button', { name: 'Poke the duck' })

    fireEvent.click(duck)
    expect(await screen.findByText('Hands off. Hands on your water bottle.')).toBeInTheDocument()

    fireEvent.click(duck)
    fireEvent.click(duck)
    expect(await screen.findByText("That's it.")).toBeInTheDocument()
    expect(onLunge).toHaveBeenCalledOnce()
  })

  it('glares when a task is unticked', async () => {
    const onLunge = vi.fn()
    const { rerender } = render(
      <DuckHeader menace={{ level: 'content', reason: 'done' }} missing={[]} completion={completionOf([])} dayNumber={3} onLunge={onLunge} />,
    )
    rerender(<DuckHeader menace={TAPPING} missing={['water']} completion={completionOf(['water'])} dayNumber={3} onLunge={onLunge} />)
    expect(await screen.findByText('I saw that.')).toBeInTheDocument()
  })

  it('does not glare when a new day starts', () => {
    const onLunge = vi.fn()
    const { rerender } = render(
      <DuckHeader menace={{ level: 'content', reason: 'done' }} missing={[]} completion={completionOf([])} dayNumber={3} onLunge={onLunge} />,
    )
    rerender(
      <DuckHeader menace={{ level: 'watching', reason: 'plenty' }} missing={TASK_IDS} completion={completionOf([...TASK_IDS])} dayNumber={4} onLunge={onLunge} />,
    )
    expect(screen.queryByText('I saw that.')).not.toBeInTheDocument()
    expect(screen.getByText("New day. I'm watching.")).toBeInTheDocument()
  })

  it('shows an announcement pushed from outside', async () => {
    render(
      <DuckHeader
        menace={TAPPING}
        missing={['reading']}
        completion={completionOf(['reading'])}
        dayNumber={3}
        onLunge={vi.fn()}
        announcement={{ text: '22:30. Not a minute later.', reaction: 'relax', id: 1 }}
      />,
    )
    expect(await screen.findByText('22:30. Not a minute later.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Today/__tests__/DuckHeader.test.tsx`
Expected: FAIL, with `Failed to resolve import "../DuckHeader"`.

- [ ] **Step 3: Create the hook, the atmosphere and the header**

Create `src/hooks/useMenace.ts`:

```ts
import { useMemo } from 'react'
import type { DayEntry } from '../db/types'
import { bedtimeMinutes, menace, plansToMinutes, type Menace } from '../logic/menace'
import type { DayTaskData } from '../logic/types'
import { useSettings } from './useSettings'

/** The Today duck's menace, from today's progress, today's plan, the bedtime setting and the time. */
export function useMenace(data: DayTaskData | undefined, entry: DayEntry | undefined, nowMin: number): Menace | undefined {
  const { bedtime } = useSettings()
  return useMemo(
    () =>
      data && entry
        ? menace({ data, nowMin, bedtimeMin: bedtimeMinutes(bedtime), plans: plansToMinutes(entry.plans) })
        : undefined,
    [data, entry, nowMin, bedtime],
  )
}
```

Create `src/screens/Today/MenaceAtmosphere.tsx`:

```tsx
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import type { MenaceLevel } from '../../logic/menace'

const DARK_VIGNETTE = 'radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(40, 14, 10, 0.26) 100%)'
const RED_GLOW = 'radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(190, 24, 34, 0.4) 100%)'
/** Keeps the top of the screen clear: the header's text sits on the canvas there. */
const TOP_CLEAR_MASK = 'linear-gradient(to bottom, transparent 0, transparent 160px, black 260px)'

interface MenaceAtmosphereProps {
  level: MenaceLevel
  /** Goes up by one per lunge: each flashes the screen red once. */
  flashes: number
}

/**
 * The Today screen's mood lighting, behind the content: a dark vignette when
 * time is tight, a slow red pulse (2.8 s, far below any flashing threshold)
 * when it's out. Cards sit on top, so no text is ever over it.
 */
export function MenaceAtmosphere({ level, flashes }: MenaceAtmosphereProps) {
  const reduceMotion = useReducedMotionConfig() ?? false

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 mx-auto max-w-md"
      style={{ maskImage: TOP_CLEAR_MASK, WebkitMaskImage: TOP_CLEAR_MASK }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: DARK_VIGNETTE }}
        initial={false}
        animate={{ opacity: level === 'tapping' ? 1 : 0 }}
        transition={{ duration: 1 }}
      />
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: level === 'hunting' ? 1 : 0 }} transition={{ duration: 1 }}>
        <motion.div
          className="absolute inset-0"
          style={{ background: RED_GLOW }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.78, 1, 0.78] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <AnimatePresence>
        {flashes > 0 && !reduceMotion && (
          <motion.div
            key={flashes}
            className="absolute inset-0"
            style={{ background: RED_GLOW }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

Create `src/screens/Today/DuckHeader.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
import { registerPoke } from '../../components/mascot/rig'
import { duckLine, GLARE_LINE, LUNGE_LINE, pokeLine } from '../../content/microcopy'
import { useKnifeSound } from '../../hooks/useSound'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel } from '../../logic/menace'
import type { TaskId } from '../../logic/types'

/** How long a reaction's line stays up before his menace line returns. */
const REACTION_LINE_MS = 2200

const LEVEL_MOODS: Record<MenaceLevel, DuckMood> = {
  content: 'content',
  watching: 'watching',
  tapping: 'tapping',
  hunting: 'hunting',
}

/** A line and a reaction pushed in from outside, e.g. once a plan is saved. A new `id` shows it again. */
export interface DuckAnnouncement {
  text: string
  reaction: DuckReaction
  id: number
}

interface DuckHeaderProps {
  menace: Menace
  missing: readonly TaskId[]
  completion: Record<TaskId, boolean>
  dayNumber: number
  announcement?: DuckAnnouncement
  /** Three quick pokes make him lunge; the screen flashes red once. */
  onLunge: () => void
  /** Shown under the speech bubble: the plan button. */
  children?: ReactNode
}

/**
 * The Today screen's duck. His mood follows the menace; he answers pokes
 * (the third quick one makes him lunge), nods when a task is ticked, and
 * glares when one is unticked.
 */
export function DuckHeader({ menace, missing, completion, dayNumber, announcement, onLunge, children }: DuckHeaderProps) {
  const playShing = useKnifeSound()
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  const [override, setOverride] = useState<{ text: string; id: number }>()
  const pokes = useRef<number[]>([])
  const pokeCount = useRef(0)

  const react = (kind: DuckReaction, text?: string) => {
    setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
    if (text !== undefined) setOverride((previous) => ({ text, id: (previous?.id ?? 0) + 1 }))
  }

  // React's "adjust state when a prop changes" pattern: compare with the previous render.
  const [seen, setSeen] = useState({ dayNumber, completion, announcement })
  if (seen.dayNumber !== dayNumber || seen.completion !== completion || seen.announcement !== announcement) {
    setSeen({ dayNumber, completion, announcement })
    if (announcement && announcement !== seen.announcement) {
      react(announcement.reaction, announcement.text)
    } else if (seen.dayNumber === dayNumber) {
      // A new day starts with nothing ticked; that isn't a task being unticked.
      if (TASK_IDS.some((task) => seen.completion[task] && !completion[task])) react('glare', GLARE_LINE)
      else if (TASK_IDS.some((task) => !seen.completion[task] && completion[task])) react('approve')
    }
  }

  useEffect(() => {
    if (!override) return
    const timer = setTimeout(() => setOverride(undefined), REACTION_LINE_MS)
    return () => clearTimeout(timer)
  }, [override])

  const poke = () => {
    const result = registerPoke(pokes.current, performance.now())
    pokes.current = result.recent
    playShing()
    if (result.kind === 'lunge') {
      react('lunge', LUNGE_LINE)
      onLunge()
    } else {
      react('poke', pokeLine(pokeCount.current))
      pokeCount.current += 1
    }
  }

  const line = override?.text ?? duckLine({ menace, missing, dayNumber })

  return (
    <div className="flex items-center gap-3 px-4 pb-4">
      <button
        type="button"
        onClick={poke}
        aria-label="Poke the duck"
        className="shrink-0 touch-manipulation rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Mascot mood={LEVEL_MOODS[menace.level]} size={88} reaction={reaction} decorative />
      </button>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="relative rounded-2xl bg-surface px-4 py-2 font-rounded text-sm font-bold text-ink shadow-sm">
          <span aria-hidden="true" className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rotate-45 bg-surface" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={line}
              className="relative block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {line}
            </motion.span>
          </AnimatePresence>
        </p>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Put it on the Today screen**

Replace `TodayTasks` in `src/screens/Today/TodayScreen.tsx`, and update its imports. The whole file becomes:

```tsx
import { useState } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { taskCheer } from '../../content/microcopy'
import type { Challenge, DayEntry } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useMenace } from '../../hooks/useMenace'
import { useNow } from '../../hooks/useNow'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { DayNotesCard } from './DayNotesCard'
import { DietCard } from './DietCard'
import { DuckHeader } from './DuckHeader'
import { MenaceAtmosphere } from './MenaceAtmosphere'
import { PhotoCard } from './PhotoCard'
import { PreStartView } from './PreStartView'
import { ReadingCard } from './ReadingCard'
import { WaterCard } from './WaterCard'
import { WorkoutCard } from './WorkoutCard'

interface TodayScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  today: string
  todayDayNumber: number
  streak: number
}

export function TodayScreen(props: TodayScreenProps) {
  if (!isChallengeDay(props.todayDayNumber)) {
    return <PreStartView challenge={props.challenge} todayDayNumber={props.todayDayNumber} />
  }
  return <TodayTasks {...props} />
}

function TodayTasks({ challenge, dayEntries, today, todayDayNumber, streak }: TodayScreenProps) {
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts)
  const nowMin = useNow()
  const menace = useMenace(completion?.data, entry, nowMin)
  const { xp } = useChallengeStats(challenge.id)
  const [lunges, setLunges] = useState(0)

  if (!entry || !workouts || !completion || !menace) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const completedCount = Object.values(completion.completion).filter(Boolean).length

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <MenaceAtmosphere level={menace.level} flashes={lunges} />
      <div className="relative z-10">
        <header className="flex items-center justify-between px-4 pt-6 pb-4">
          <div>
            <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
            <h1 className="font-rounded text-2xl font-extrabold text-ink">
              Day {todayDayNumber} / {CHALLENGE_LENGTH}
            </h1>
            <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-ink">⭐ {xp} XP</p>
          </div>
          <div className="flex items-center gap-3">
            <FlameStreak streak={streak} />
            <ProgressRing value={completedCount} max={TASK_IDS.length}>
              <span className="font-rounded text-sm font-extrabold text-ink">
                {completedCount}/{TASK_IDS.length}
              </span>
            </ProgressRing>
          </div>
        </header>

        <DuckHeader
          menace={menace}
          missing={completion.missing}
          completion={completion.completion}
          dayNumber={todayDayNumber}
          onLunge={() => setLunges((count) => count + 1)}
        />

        <main className="flex flex-col gap-4 px-4">
          <WorkoutCard
            dayEntryId={entry.id}
            workouts={workouts}
            complete={completion.completion.workouts}
            cheer={taskCheer('workouts', todayDayNumber)}
          />
          <DietCard entry={entry} complete={completion.completion.diet} cheer={taskCheer('diet', todayDayNumber)} />
          <WaterCard entry={entry} complete={completion.completion.water} cheer={taskCheer('water', todayDayNumber)} />
          <ReadingCard
            entry={entry}
            complete={completion.completion.reading}
            cheer={taskCheer('reading', todayDayNumber)}
          />
          <PhotoCard entry={entry} complete={completion.completion.photo} cheer={taskCheer('photo', todayDayNumber)} />
          <DayNotesCard entry={entry} />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Remove the old mascot line**

In `src/content/microcopy.ts`, delete the `LAST_TASK_LINES` constant and the `mascotLine` function (the "What the mascot says when only this task is left" block and the next one). In `src/content/__tests__/microcopy.test.ts`, delete the `describe('mascotLine', …)` block and remove `mascotLine` from the import.

- [ ] **Step 6: Run the tests, type-check and lint**

Run: `npx vitest run src/screens/Today/__tests__/DuckHeader.test.tsx && npx tsc -b && npm run lint && npm run test`
Expected: the DuckHeader tests pass (5), and so does everything else: no type or lint errors, and no test still references `mascotLine`.

- [ ] **Step 7: Look at every level in the browser**

With the dev server running, open `http://localhost:5173/?db=duck` and seed Day 1 with the water half-done from the console. (Task 11 adds a proper scenario; for now this is enough.)

```js
const s = await import('/src/dev/scenarios.ts'); await s.seedDayOneWithLogs()
```

Visit `?db=duck&now=10:00`, `?db=duck&now=21:00` and `?db=duck&now=23:10`, resizing the pane to 390×844. Check:
- the duck's mood matches `watching`, `tapping` and `hunting` respectively;
- the vignette appears only at the edges, and the header text stays clear;
- tapping the duck shows a poke line, and three quick taps make him lunge with one red flash.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useMenace.ts src/screens/Today/MenaceAtmosphere.tsx src/screens/Today/DuckHeader.tsx src/screens/Today/__tests__/DuckHeader.test.tsx src/screens/Today/TodayScreen.tsx src/content/microcopy.ts src/content/__tests__/microcopy.test.ts
git commit -F - <<'EOF'
feat: make the Today duck menacing only when tasks stop fitting before bedtime

He watches, taps or hunts by the menace rule, over a vignette that stays
behind the cards; answers pokes, lunges on the third, nods at ticked
tasks and glares at unticked ones.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: "I've got a plan" and the bedtime setting

**Files:**
- Create: `src/screens/Today/PlanSheet.tsx`, `src/screens/Today/__tests__/PlanSheet.test.tsx`, `src/screens/Settings/CompanionSection.tsx`, `src/screens/Settings/__tests__/CompanionSection.test.tsx`
- Modify: `src/screens/Today/TodayScreen.tsx` (plan button, sheet, announcement), `src/screens/Settings/SettingsScreen.tsx` (add the section)

**Interfaces:**
- Consumes:
  - Task 1: `planError`, `PlanError`, `parseHHmm`, `isValidBedtime`, `EARLIEST_BEDTIME`, `LATEST_BEDTIME`
  - Task 4: `dayEntryRepo.setPlans`, `useSettings().bedtime/setBedtime`
  - Task 6: `planSavedLine`
  - Task 8: `DuckHeader` (with `children` and `announcement`), `DuckAnnouncement`
- Produces:
  - `PlanSheet({ open, entry, data, missing, nowMin, onClose, onSaved })`, where `onSaved(earliest: number | null)`
  - `CompanionSection({ bedtime, onBedtimeChange })`

- [ ] **Step 1: Write the failing tests**

Create `src/screens/Today/__tests__/PlanSheet.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { MIN_WORKOUT_MIN, WATER_TARGET_ML } from '../../../logic/constants'
import type { DayTaskData } from '../../../logic/types'
import { PlanSheet } from '../PlanSheet'

/** Everything done but the reading and the photo. */
const DATA: DayTaskData = {
  water_ml: WATER_TARGET_ML,
  pages_read: 0,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: false,
  workouts: [
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: false },
  ],
}

async function setup({ nowMin = 20 * 60, plans }: { nowMin?: number; plans?: Record<string, string> } = {}) {
  const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  const created = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
  if (plans) await dayEntryRepo.setPlans(created.id, plans)
  const entry = (await db.dayEntries.get(created.id))!
  const onSaved = vi.fn()
  render(
    <PlanSheet open entry={entry} data={DATA} missing={['reading', 'photo']} nowMin={nowMin} onClose={vi.fn()} onSaved={onSaved} />,
  )
  return { entry, onSaved }
}

describe('PlanSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('saves a time for a task and reports the earliest plan', async () => {
    const { entry, onSaved } = await setup()
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(22 * 60 + 30))
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })
  })

  it('refuses a time that has passed', async () => {
    await setup({ nowMin: 21 * 60 })
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '20:00' } })
    expect(screen.getByText('Pick a time later than now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
  })

  it('refuses a task that would run past midnight', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '23:50' } })
    expect(screen.getByText("That won't fit before midnight.")).toBeInTheDocument()
  })

  it('keeps an earlier plan whose time has passed without blocking the save', async () => {
    const { entry, onSaved } = await setup({ plans: { photo: '19:00' } })
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(19 * 60))
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30', photo: '19:00' })
  })

  it('clears a planned time', async () => {
    const { entry } = await setup({ plans: { reading: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear Reading' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    await waitFor(async () => expect(await db.dayEntries.get(entry.id)).not.toHaveProperty('plans'))
  })
})
```

Create `src/screens/Settings/__tests__/CompanionSection.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompanionSection } from '../CompanionSection'

describe('CompanionSection', () => {
  it('saves a bedtime in range', () => {
    const onBedtimeChange = vi.fn(async () => {})
    render(<CompanionSection bedtime="23:00" onBedtimeChange={onBedtimeChange} />)
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '22:30' } })
    expect(onBedtimeChange).toHaveBeenCalledWith('22:30')
  })

  it('explains a bedtime out of range instead of saving it', () => {
    const onBedtimeChange = vi.fn(async () => {})
    render(<CompanionSection bedtime="23:00" onBedtimeChange={onBedtimeChange} />)
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '17:00' } })
    expect(onBedtimeChange).not.toHaveBeenCalled()
    expect(screen.getByText('Pick a time between 18:00 and 23:59.')).toBeInTheDocument()
  })

  it('follows the saved bedtime when it loads', () => {
    const { rerender } = render(<CompanionSection bedtime="23:00" onBedtimeChange={vi.fn(async () => {})} />)
    rerender(<CompanionSection bedtime="21:30" onBedtimeChange={vi.fn(async () => {})} />)
    expect(screen.getByLabelText('Bedtime')).toHaveValue('21:30')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Today/__tests__/PlanSheet.test.tsx src/screens/Settings/__tests__/CompanionSection.test.tsx`
Expected: FAIL, because the imports `../PlanSheet` and `../CompanionSection` cannot be resolved.

- [ ] **Step 3: Create the plan sheet**

Create `src/screens/Today/PlanSheet.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { TASK_NAMES } from '../../content/microcopy'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import { parseHHmm, planError, type PlanError } from '../../logic/menace'
import type { DayTaskData, TaskId } from '../../logic/types'

const ERROR_TEXT: Record<PlanError, string> = {
  past: 'Pick a time later than now.',
  'past-midnight': "That won't fit before midnight.",
}

interface PlanSheetProps {
  open: boolean
  entry: DayEntry
  data: DayTaskData
  missing: readonly TaskId[]
  nowMin: number
  onClose: () => void
  /** Called after saving, with the earliest planned minute (null when the plan is now empty). */
  onSaved: (earliest: number | null) => void
}

/** "Tell the duck your plan": a time for each task still missing today. */
export function PlanSheet(props: PlanSheetProps) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <PlanForm {...props} />
    </Modal>
  )
}

/** Mounted each time the sheet opens, so the draft starts from the saved plan. */
function PlanForm({ entry, data, missing, nowMin, onClose, onSaved }: PlanSheetProps) {
  const saved = entry.plans ?? {}
  const [draft, setDraft] = useState<Partial<Record<TaskId, string>>>(() => ({ ...saved }))
  const [saving, setSaving] = useState(false)

  // Only rows changed since the sheet opened are checked, so an earlier plan
  // whose time has passed never blocks saving the others.
  const errorFor = (task: TaskId): PlanError | null => {
    const value = draft[task]
    if (!value || value === saved[task]) return null
    return planError(task, value, data, nowMin)
  }
  const hasErrors = missing.some((task) => errorFor(task) !== null)

  const save = async () => {
    if (hasErrors) return
    setSaving(true)
    const plans: Partial<Record<TaskId, string>> = {}
    for (const task of missing) {
      const value = draft[task]
      if (value && parseHHmm(value) !== null) plans[task] = value
    }
    await dayEntryRepo.setPlans(entry.id, plans)
    const times = Object.values(plans).map((value) => parseHHmm(value!)!)
    onSaved(times.length > 0 ? Math.min(...times) : null)
  }

  return (
    <>
      <h3 className="font-rounded text-lg font-extrabold text-ink">Tell the duck your plan</h3>
      <p className="mt-1 text-sm text-ink-muted">He leaves a task alone until its time comes. Break the plan and he'll know.</p>
      {missing.map((task) => {
        const error = errorFor(task)
        return (
          <Field key={task} label={TASK_NAMES[task]} error={error ? ERROR_TEXT[error] : undefined}>
            <span className="flex gap-2">
              <input
                type="time"
                aria-label={TASK_NAMES[task]}
                value={draft[task] ?? ''}
                onChange={(e) => setDraft((previous) => ({ ...previous, [task]: e.target.value }))}
                className="min-h-touch min-w-0 flex-1 rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
              />
              {draft[task] && (
                <button
                  type="button"
                  aria-label={`Clear ${TASK_NAMES[task]}`}
                  onClick={() =>
                    setDraft((previous) => {
                      const next = { ...previous }
                      delete next[task]
                      return next
                    })
                  }
                  className="min-h-touch shrink-0 rounded-xl px-3 font-rounded text-sm font-bold text-ink-muted"
                >
                  Clear
                </button>
              )}
            </span>
          </Field>
        )
      })}
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void save()} disabled={saving || hasErrors}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </>
  )
}
```

`draft` starts from every saved plan, but `save` only keeps the missing tasks. Plans for tasks finished since then are dropped, which matches the spec.

The input's `aria-label` repeats the task name on purpose. The `<label>` from `Field` also contains the "Clear" button, so its text alone would read "ReadingClear".

- [ ] **Step 4: Create the Companion section**

Create `src/screens/Settings/CompanionSection.tsx`:

```tsx
import { useState } from 'react'
import { Field } from '../../components/ui/Field'
import { EARLIEST_BEDTIME, isValidBedtime, LATEST_BEDTIME } from '../../logic/menace'

interface CompanionSectionProps {
  bedtime: string
  onBedtimeChange: (value: string) => Promise<void>
}

/** The duck's settings: the bedtime his menace counts down to. */
export function CompanionSection({ bedtime, onBedtimeChange }: CompanionSectionProps) {
  // A local draft, so an out-of-range time can be shown while it's being fixed.
  // It follows the saved value when that loads or changes; no remount,
  // because that would close the iOS time wheel mid-scroll.
  const [draft, setDraft] = useState(bedtime)
  const [previousBedtime, setPreviousBedtime] = useState(bedtime)
  if (bedtime !== previousBedtime) {
    setPreviousBedtime(bedtime)
    setDraft(bedtime)
  }
  const valid = isValidBedtime(draft)

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">🦆 Companion</h2>
      <Field label="Bedtime" error={valid ? undefined : `Pick a time between ${EARLIEST_BEDTIME} and ${LATEST_BEDTIME}.`}>
        <input
          type="time"
          min={EARLIEST_BEDTIME}
          max={LATEST_BEDTIME}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (isValidBedtime(e.target.value)) void onBedtimeChange(e.target.value)
          }}
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      </Field>
      <p className="mt-2 text-sm text-ink-muted">
        The duck only gets menacing when what's left no longer fits before this time. Reading, the photo and the diet
        only count in the last half hour.
      </p>
    </section>
  )
}
```

- [ ] **Step 5: Wire them in**

In `src/screens/Settings/SettingsScreen.tsx`:
- add `import { CompanionSection } from './CompanionSection'` to the imports;
- change the `useSettings` line to:

  ```tsx
    const { soundEnabled, hapticsEnabled, bedtime, setSoundEnabled, setHapticsEnabled, setBedtime } = useSettings()
  ```

- and add this line right after the closing `</section>` of "Sound & haptics":

  ```tsx
          <CompanionSection bedtime={bedtime} onBedtimeChange={setBedtime} />
  ```

In `src/screens/Today/TodayScreen.tsx`:
- change the microcopy import to `import { planSavedLine, taskCheer } from '../../content/microcopy'`;
- change the DuckHeader import to `import { DuckHeader, type DuckAnnouncement } from './DuckHeader'`;
- add `import { PlanSheet } from './PlanSheet'`.

Then make these three changes inside `TodayTasks`.

1. Under `const [lunges, setLunges] = useState(0)`, add:

```tsx
  const [planOpen, setPlanOpen] = useState(false)
  const [announcement, setAnnouncement] = useState<DuckAnnouncement>()
```

2. Replace the `<DuckHeader … />` element with:

```tsx
        <DuckHeader
          menace={menace}
          missing={completion.missing}
          completion={completion.completion}
          dayNumber={todayDayNumber}
          announcement={announcement}
          onLunge={() => setLunges((count) => count + 1)}
        >
          {completion.missing.length > 0 && (
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              className="min-h-touch rounded-2xl bg-surface px-4 font-rounded text-sm font-bold text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              🗓 {Object.keys(entry.plans ?? {}).length > 0 ? 'Edit plan' : "I've got a plan"}
            </button>
          )}
        </DuckHeader>
```

3. Before the outermost closing `</div>` (after the `relative z-10` wrapper closes), add:

```tsx
      <PlanSheet
        open={planOpen}
        entry={entry}
        data={completion.data}
        missing={completion.missing}
        nowMin={nowMin}
        onClose={() => setPlanOpen(false)}
        onSaved={(earliest) => {
          setPlanOpen(false)
          if (earliest !== null) {
            setAnnouncement((previous) => ({ text: planSavedLine(earliest), reaction: 'relax', id: (previous?.id ?? 0) + 1 }))
          }
        }}
      />
```

- [ ] **Step 6: Run the tests, type-check and lint**

Run: `npx vitest run src/screens/Today/__tests__/PlanSheet.test.tsx src/screens/Settings/__tests__/CompanionSection.test.tsx && npx tsc -b && npm run lint && npm run test`
Expected: PlanSheet passes (5 tests), CompanionSection passes (3), and the full suite passes with no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Today/PlanSheet.tsx src/screens/Today/__tests__/PlanSheet.test.tsx src/screens/Settings/CompanionSection.tsx src/screens/Settings/__tests__/CompanionSection.test.tsx src/screens/Settings/SettingsScreen.tsx src/screens/Today/TodayScreen.tsx
git commit -F - <<'EOF'
feat: let you tell the duck your plan, and set the bedtime he counts down to

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: The duck app icon

**Files:**
- Modify: `public/mascot.svg`, `pwa-assets.config.ts:4`
- Regenerate: `public/favicon.ico`, `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`

**Interfaces:**
- Consumes: the art paths (Task 3's `duckArt.tsx` constants, copied as static SVG).
- Produces: the new icons. `index.html` and `vite.config.ts` already reference these file names.

- [ ] **Step 1: Replace the icon source**

Replace the whole of `public/mascot.svg` with the duck in his `watching` pose, cropped square. These are the same paths as `duckArt.tsx`, without the animation layers.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 23 500 500" width="512" height="512">
  <!-- The watching duck from src/components/mascot/duckArt.tsx, cropped square for icons. Source for `npm run generate-pwa-assets`. -->
  <g stroke="#5a1a16" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">
    <path fill="#ffb624" d="M96 460 C91 460 99 467 101 471 C103 475 103 480 106 484 C109 488 113 491 117 494 C121 497 126 499 131 501 C136 503 144 505 150 506 C156 507 160 507 165 507 C170 507 174 507 177 505 C180 503 182 500 184 497 C186 494 188 490 186 487 C184 484 179 481 170 478 C161 475 142 473 130 470 C118 467 101 460 96 460 Z"/>
    <path fill="#ffb624" d="M279 478 C276 481 278 488 281 491 C284 494 290 496 294 498 C298 500 302 500 307 500 C312 500 316 500 321 499 C326 498 330 498 334 496 C338 494 344 491 348 488 C352 485 354 483 356 480 C358 477 359 472 360 468 C361 464 366 459 361 458 C356 457 340 462 330 464 C320 466 308 470 300 472 C292 474 282 475 279 478 Z"/>
    <path fill="#f9dd97" d="M238 39 C229 38 222 39 215 39 C208 39 203 40 196 41 C189 42 182 44 173 47 C164 50 154 55 145 60 C136 65 129 70 122 75 C115 80 109 86 104 91 C99 96 95 100 90 106 C85 112 80 121 76 127 C72 133 72 134 69 140 C66 146 62 157 59 165 C56 173 54 180 52 190 C50 200 48 212 47 225 C46 238 44 252 43 265 C42 278 41 292 40 305 C39 318 39 330 39 340 C39 350 39 357 40 365 C41 373 41 378 44 387 C47 396 52 410 58 420 C64 430 70 438 77 446 C84 454 90 463 101 469 C112 475 131 478 145 481 C159 484 171 485 183 486 C195 487 205 486 215 486 C225 486 235 486 243 486 C251 486 258 485 265 484 C272 483 280 480 287 479 C294 478 303 476 310 475 C317 474 324 472 330 470 C336 468 343 465 348 463 C353 461 357 462 362 458 C367 454 373 446 377 440 C381 434 384 431 388 424 C392 417 396 405 399 398 C402 391 402 387 403 381 C404 375 404 368 404 360 C404 352 403 345 403 335 C403 325 403 312 403 300 C403 288 404 275 405 262 C406 249 408 237 407 224 C406 211 401 196 397 184 C393 172 391 163 385 151 C379 139 372 123 363 111 C354 99 343 87 334 79 C325 71 318 68 311 63 C304 58 298 55 291 52 C284 49 277 46 268 44 C259 42 247 40 238 39 Z"/>
    <path fill="#f9dd97" stroke="none" d="M405 215 C407 215 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 404 338 402 331 C400 324 396 312 394 300 C392 288 393 274 393 262 C393 250 394 234 396 226 C398 218 403 215 405 215 Z"/>
    <path fill="none" d="M405 215 C405 216 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 402 333 402 331"/>
    <line x1="398" y1="306" x2="400" y2="319" stroke="#ffc605" stroke-width="10"/>
    <ellipse cx="155.5" cy="177.4" rx="12.8" ry="12.8" fill="#5a1a16" stroke="none"/>
    <ellipse cx="314.8" cy="170.6" rx="12.8" ry="12.8" fill="#5a1a16" stroke="none"/>
    <ellipse cx="239" cy="213" rx="64" ry="26" fill="#ffb624" stroke-width="13"/>
    <path fill="#f9dd97" stroke="none" d="M51 195 C46 197 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 86 350 88 346 C90 342 93 334 96 325 C99 316 103 307 104 295 C105 283 103 267 100 255 C97 243 91 231 86 222 C81 213 74 204 68 200 C62 196 56 193 51 195 Z"/>
    <path fill="none" d="M51 195 C49 198 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 87 347 88 346"/>
    <line x1="114" y1="271" x2="98" y2="303" stroke="#ffc605" stroke-width="9"/>
    <path fill="#d8d7d5" stroke-width="13" d="M112 313 L224 310 C232 310 237 314 237 321 C236 330 229 339 221 346 C206 360 188 372 164 375 C146 376 128 366 112 353 Z"/>
    <path fill="#ffa6c5" stroke-width="13" d="M95 314 L112 313 L111 350 L88 350 Z"/>
  </g>
</svg>
```

- [ ] **Step 2: Warm the icon background**

In `pwa-assets.config.ts`, replace the `ICON_BACKGROUND` line and the comment above it with:

```ts
/** Behind the duck for icons that can't be transparent (Android maskable, iOS): the reference image's backdrop. */
const ICON_BACKGROUND = '#e2ddca'
```

- [ ] **Step 3: Regenerate the icons and look at them**

Run: `npm run generate-pwa-assets`
Expected: the generator reports writing `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` and `apple-touch-icon-180x180.png` into `public/`.

Open `public/pwa-512x512.png` and `public/maskable-icon-512x512.png` with the Read tool. The duck should be whole and centred, with the maskable version padded on the beige background.

- [ ] **Step 4: Commit**

```bash
git add public/mascot.svg pwa-assets.config.ts public/favicon.ico public/pwa-64x64.png public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png
git commit -F - <<'EOF'
feat: make the knife-holding duck the app icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Dev scenarios and the README

**Files:**
- Modify: `src/dev/scenarios.ts` (append two scenarios), `README.md` (Features, Dev scenarios, Project structure)

**Interfaces:**
- Consumes: `DayEntry.plans` (Task 4); `useNow`'s `?now=` (Task 5).
- Produces: `seedMenaceDay()`, `seedPlannedReading()`.

- [ ] **Step 1: Add the scenarios**

Append to `src/dev/scenarios.ts`:

```ts
/** Two qualifying workouts, one outdoors: Day 3's workouts task is done. */
const doneWorkouts: SeedDay['workouts'] = [
  { type: 'Running', durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
  { type: 'Weights', durationMin: 60, isOutdoor: false },
]

/**
 * Days 1–2 complete. Day 3 (today) has the workouts done, 2.1 L of water,
 * and the reading, photo and diet still to do. Open it with ?now=10:00,
 * ?now=20:00 or ?now=22:45 to see the duck watch, tap and hunt.
 */
export async function seedMenaceDay(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -2), attemptNumber: 1, status: 'active' },
      days: [await perfectDay(1), await perfectDay(2), { dayNumber: 3, entry: { water_ml: 2100 }, workouts: doneWorkouts }],
    },
  ])
}

/**
 * Days 1–2 complete. On Day 3 (today) only the reading is left, planned for
 * 22:30. Open it with ?now=19:00 (plan pending), ?now=22:35 (plan due) or
 * ?now=23:10 (plan broken).
 */
export async function seedPlannedReading(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -2), attemptNumber: 1, status: 'active' },
      days: [
        await perfectDay(1),
        await perfectDay(2),
        {
          dayNumber: 3,
          entry: { water_ml: WATER_TARGET_ML, dietFollowed: true, noAlcohol: true, plans: { reading: '22:30' } },
          photo: await fakePhoto('Day 3', 120),
          workouts: doneWorkouts,
        },
      ],
    },
  ])
}
```

- [ ] **Step 2: Update the README**

In `README.md`, add this bullet under **Features**, right after the **Today** bullet:

```markdown
- **The duck** — your companion is a knife-holding duck, drawn in code and animated: he breathes, blinks, watches what you touch and answers pokes. He only gets menacing when what's left no longer fits before your bedtime (Settings → Companion), and backs off once you tell him your plan ("I've got a plan" on Today). With "reduce motion" on, he holds still.
```

Under **Dev scenarios**, after the paragraph that ends with `seeds a scratch database from the browser console:`, and before the code block, add:

```markdown
`?now=HH:mm` freezes the duck's clock in development (production ignores it), so each menace level can be checked, e.g. `?db=duck&now=22:45`.
```

Add two rows to the scenario table:

```markdown
| `seedMenaceDay()` | Day 3 with water at 2.1 L and the reading, photo and diet to do: try `?now=10:00`, `20:00` and `22:45`. |
| `seedPlannedReading()` | Only the reading left, planned for 22:30: try `?now=19:00`, `22:35` and `23:10`. |
```

Under **Project structure**, add:

```markdown
- `src/components/mascot/` — the duck: the traced SVG art, the pure motion rig (`rig.ts`) and the `Mascot` component. The design is in `docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md`.
- `public/media/` — the missed-day clip, generated with Higgsfield from the duck drawing.
```

- [ ] **Step 3: Check that the scenarios type-check and seed**

Run: `npx tsc -b`
Expected: no output.

With the dev server running, open `http://localhost:5173/?db=duck&now=22:35` and run in the console:

```js
const s = await import('/src/dev/scenarios.ts'); await s.seedPlannedReading()
```

The bubble should read "It's 22:30. Reading. I'm watching." Then open `?db=duck&now=23:10`: the duck should hunt, with the line "Past your bedtime. Not mine."

- [ ] **Step 4: Commit**

```bash
git add src/dev/scenarios.ts README.md
git commit -F - <<'EOF'
docs: add menace and plan dev scenarios, and describe the duck in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: The missed-day clip (Higgsfield)

**Files:**
- Create: `public/media/failed-day.mp4`, `public/media/failed-day-poster.webp`, `src/screens/RestartFlow/FailedDayCinematic.tsx`, `src/screens/RestartFlow/__tests__/FailedDayCinematic.test.tsx`
- Modify: `src/screens/RestartFlow/DayFailedScreen.tsx` (render the clip), `vite.config.ts:15` (precache the clip)

**Interfaces:**
- Consumes: the duck art (`docs/superpowers/specs/2026-09-25-knife-duck-companion/duck-rig.svg`).
- Produces: `FailedDayCinematic({ challengeId, failedDayNumber })`.

**Run Steps 1–4 in the main session, not in a subagent:** they use the Higgsfield tools and need the user's approval.

**User gate:** the start frame and the clip are both shown to the user, and nothing is integrated until they approve. The budget is ≤ 20 of the 163.5 credits, with at most 2 attempts. If neither attempt passes the spec's acceptance criteria, skip Steps 5–11, leave `DayFailedScreen` without the clip, and record that in the final report.

- [ ] **Step 1: Render the start image**

Set `SCRATCHPAD` to the session's scratchpad directory and `REPO` to the repository root. Then, in the scratchpad (never in the repo), render the rig SVG at 1024 px wide with `@resvg/resvg-js`:

```bash
cd "$SCRATCHPAD" && npm init -y >/dev/null && npm install --silent @resvg/resvg-js@2
node -e "const {Resvg}=require('@resvg/resvg-js');const fs=require('fs');fs.writeFileSync('duck-1024.png',new Resvg(fs.readFileSync('$REPO/docs/superpowers/specs/2026-09-25-knife-duck-companion/duck-rig.svg','utf8'),{fitTo:{mode:'width',value:1024},background:'#e2ddca'}).render().asPng())"
```

Expected: `duck-1024.png` shows the watching duck on beige. Open it with the Read tool to check.

- [ ] **Step 2: Upload it and make the start frame**

1. Call the Higgsfield `media_upload` tool with `{ filename: 'duck-1024.png' }`. PUT the bytes to the returned `upload_url` with `curl -X PUT --data-binary @duck-1024.png -H 'Content-Type: image/png' "<upload_url>"`, then call `media_confirm` with the returned media id.
2. Preflight the cost: call `generate_image` with `get_cost: true`. Then call `generate_image` for real:

```json
{
  "model": "gpt_image_2_5",
  "quality": "high",
  "resolution": "1k",
  "aspect_ratio": "9:16",
  "medias": [{ "value": "<duck media id>", "role": "image_references" }],
  "prompt": "Use the reference cartoon duck exactly as drawn: flat 2D sticker style, thick dark maroon outline, pale yellow round body, orange oval beak, small dark dot eyes, a kitchen knife with a grey blade and pink handle held in its left wing, orange feet. Place it standing in a pitch-dark empty room, lit from below by a single dim warm bulb on the floor, deep shadows, quietly menacing mood. The duck is small, in the lower middle of a tall vertical frame, with darkness above. Keep the character's proportions, colours and line weight identical to the reference. No text, no extra characters, no extra limbs."
}
```

3. Show the result to the user and ask whether it matches the style. Retry once with the same prompt if they say no.

- [ ] **Step 3: Animate it**

1. Preflight with `generate_video` and `get_cost: true`. Expected: about 7.5 credits.
2. Call `generate_video`:

```json
{
  "model": "kling3_0",
  "mode": "std",
  "duration": 5,
  "sound": "off",
  "aspect_ratio": "9:16",
  "medias": [{ "value": "<start frame job id>", "role": "start_image" }],
  "prompt": "The cartoon duck slowly steps forward out of the darkness toward the camera, then raises the kitchen knife in its wing to face height; the knife stays gripped in its wing the whole time. The single bulb flickers twice. Static camera, flat 2D cartoon style preserved, no morphing, no new objects, no text."
}
```

3. Wait with `jobs_wait` and show the clip with `show_generation_by_ids`.
4. Check it against the acceptance criteria:
   - the same duck;
   - the knife never leaves the wing;
   - no extra limbs, faces, text or watermark.
5. Ask the user to approve it. One retry is allowed.

- [ ] **Step 4: Encode it for the app**

Download the approved MP4 into the scratchpad as `failed-day-raw.mp4` (use `curl -L -o` with the result URL). Then:

```bash
python -m venv "$SCRATCHPAD/ffvenv" && "$SCRATCHPAD/ffvenv/Scripts/python" -m pip install --quiet imageio-ffmpeg
FFMPEG=$("$SCRATCHPAD/ffvenv/Scripts/python" -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p "$REPO/public/media"
"$FFMPEG" -y -i "$SCRATCHPAD/failed-day-raw.mp4" -t 4.5 -vf "scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=30" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 28 -preset slow -an -movflags +faststart "$REPO/public/media/failed-day.mp4"
"$FFMPEG" -y -i "$REPO/public/media/failed-day.mp4" -frames:v 1 -vf scale=270:480 -c:v libwebp -quality 70 "$REPO/public/media/failed-day-poster.webp"
ls -la "$REPO/public/media"
```

Expected: `failed-day.mp4` is ≤ 700 KB and the poster about 20–40 KB. If the MP4 is larger, re-run the first ffmpeg command with `-crf 31`.

- [ ] **Step 5: Write the failing test**

Create `src/screens/RestartFlow/__tests__/FailedDayCinematic.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionConfig, MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FailedDayCinematic } from '../FailedDayCinematic'

describe('FailedDayCinematic', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['clip'], { type: 'video/mp4' }) })))
    URL.createObjectURL = vi.fn(() => 'blob:clip')
    URL.revokeObjectURL = vi.fn()
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays the clip once, and can be skipped', async () => {
    render(<FailedDayCinematic challengeId={1} failedDayNumber={4} />)
    const skip = await screen.findByRole('button', { name: 'Skip' })
    await waitFor(() => expect(document.querySelector('video')).toHaveAttribute('src', 'blob:clip'))

    fireEvent.click(skip)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument())
    expect(localStorage.getItem('75hard-cinematic-seen:1:4')).toBe('1')
  })

  it('does not play again for the same missed day', () => {
    localStorage.setItem('75hard-cinematic-seen:1:4', '1')
    render(<FailedDayCinematic challengeId={1} failedDayNumber={4} />)
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never plays under reduced motion', () => {
    render(
      <MotionConfig reducedMotion="always">
        <FailedDayCinematic challengeId={1} failedDayNumber={4} />
      </MotionConfig>,
    )
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })

  it('gets out of the way when the clip cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob() })))
    render(<FailedDayCinematic challengeId={1} failedDayNumber={4} />)
    await act(async () => {})
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/screens/RestartFlow/__tests__/FailedDayCinematic.test.tsx`
Expected: FAIL, with `Failed to resolve import "../FailedDayCinematic"`.

- [ ] **Step 7: Write the component**

Create `src/screens/RestartFlow/FailedDayCinematic.tsx`:

```tsx
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const CLIP_URL = '/media/failed-day.mp4'
const POSTER_URL = '/media/failed-day-poster.webp'
/** Give up on a clip that takes longer than this to load, rather than keep the screen dark. */
const LOAD_TIMEOUT_MS = 3000

const seenKey = (challengeId: number, dayNumber: number) => `75hard-cinematic-seen:${challengeId}:${dayNumber}`

function hasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Storage is blocked (private mode): the clip simply plays again next time.
  }
}

interface FailedDayCinematicProps {
  challengeId: number
  failedDayNumber: number
}

/**
 * The missed-day clip: about 4 s, played once per missed day over the
 * missed-day screen; a tap skips it. It plays from a Blob URL because iOS
 * Safari asks for video in Range requests, which the service worker's
 * precache doesn't answer. Reduced motion, or a clip that won't load or
 * play, simply shows the screen.
 */
export function FailedDayCinematic({ challengeId, failedDayNumber }: FailedDayCinematicProps) {
  const reduceMotion = useReducedMotionConfig() ?? false
  const key = seenKey(challengeId, failedDayNumber)
  const [shouldPlay] = useState(() => !reduceMotion && !hasSeen(key))
  const [src, setSrc] = useState<string | null>(null)
  const [done, setDone] = useState(!shouldPlay)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!shouldPlay) return
    markSeen(key)
    let url: string | null = null
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!url) setDone(true)
    }, LOAD_TIMEOUT_MS)
    fetch(CLIP_URL)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setDone(true)
      })
    return () => {
      cancelled = true
      clearTimeout(timeout)
      if (url) URL.revokeObjectURL(url)
    }
  }, [shouldPlay, key])

  useEffect(() => {
    const video = videoRef.current
    if (!src || !video) return
    const playing = video.play()
    if (playing) playing.catch(() => setDone(true))
  }, [src])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="cinematic"
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => setDone(true)}
        >
          {src ? (
            <video
              ref={videoRef}
              src={src}
              poster={POSTER_URL}
              muted
              playsInline
              autoPlay
              onEnded={() => setDone(true)}
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={POSTER_URL} alt="" className="h-full w-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => setDone(true)}
            className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] min-h-touch rounded-full bg-white/15 px-5 font-rounded text-sm font-bold text-white"
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/screens/RestartFlow/__tests__/FailedDayCinematic.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 9: Show it on the missed-day screen and precache it**

In `src/screens/RestartFlow/DayFailedScreen.tsx`, add `import { FailedDayCinematic } from './FailedDayCinematic'`. Then add this line just before the outer `</div>` closes, after the restart `<Button>`:

```tsx
      <FailedDayCinematic challengeId={challenge.id} failedDayNumber={failedDayNumber} />
```

In `vite.config.ts`, replace the `includeAssets` line with:

```ts
      includeAssets: ['favicon.ico', 'mascot.svg', 'apple-touch-icon-180x180.png', 'media/failed-day.mp4', 'media/failed-day-poster.webp'],
```

- [ ] **Step 10: Build and check the precache**

Run: `npm run build && grep -c "media/failed-day.mp4" dist/sw.js`
Expected: the build succeeds and the count is at least 1.

- [ ] **Step 11: Commit**

```bash
git add public/media/failed-day.mp4 public/media/failed-day-poster.webp src/screens/RestartFlow/FailedDayCinematic.tsx src/screens/RestartFlow/__tests__/FailedDayCinematic.test.tsx src/screens/RestartFlow/DayFailedScreen.tsx vite.config.ts
git commit -F - <<'EOF'
feat: play a short Higgsfield clip of the duck, once per missed day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 13: Final verification

**Files:** none changed unless a check fails. Each fix gets its own `fix:` commit.

- [ ] **Step 1: Run the gates**

Run: `npm run lint && npm run test && npm run build`
Expected: 0 lint errors, every test file passes, and the build finishes with `sw.js` generated.

- [ ] **Step 2: Walk every screen at iPhone size**

Start the dev server with the `preview_start` tool (`{ name: "dev" }`), then use `resize_window` at 390×844 in light mode. For each row below:
1. seed the scenario at `?db=duck` from the console with `const s = await import('/src/dev/scenarios.ts'); await s.<scenario>()`;
2. open the URL;
3. take a screenshot.

| Scenario | URL suffix | Expect |
| --- | --- | --- |
| `seedMenaceDay` | `&now=10:00` | `watching`, "3 down, 2 to go. I'm watching.", no vignette |
| `seedMenaceDay` | `&now=20:00` | `tapping` (the arm lifts and strikes once a second), dark vignette at the edges |
| `seedMenaceDay` | `&now=22:45` | `hunting`, a red pulse at the side and bottom edges, the header clear |
| `seedPlannedReading` | `&now=19:00` | "Reading at 22:30. I'll be there.", and "🗓 Edit plan" |
| `seedPlannedReading` | `&now=23:10` | `hunting`, "Past your bedtime. Not mine." |
| `seedDay75Pending` | (none) | tap +500 ml: the celebration duck tosses the knife and catches it; then Victory shows the `triumphant` duck |
| `seedPreStart` | (none) | the `waiting` duck taps slowly |
| `seedMissedDay` | (none) | the clip plays once (Skip works), then the `judging` duck; a reload shows no clip |

Then open Settings → Companion, set 22:00 and check that `?now=21:05` with `seedMenaceDay` now makes him tap. Repeat the `22:45` and `20:00` rows with `resize_window` `colorScheme: 'dark'`.

- [ ] **Step 3: Measure smoothness and the knife rule**

On Today, with `seedMenaceDay` at `&now=20:00`, run this in the page with the `javascript_tool`:

```js
const svg = document.querySelector('button[aria-label="Poke the duck"] svg')
const wing = svg.querySelector('[data-part="left-wing"]'), knife = svg.querySelector('[data-part="knife"]')
const grip = (el) => new DOMPoint(100, 332).matrixTransform(el.getCTM())
const rec = []
await new Promise((done) => {
  const t0 = performance.now()
  const tick = (t) => {
    const a = grip(knife), b = grip(wing)
    rec.push({ t, drift: Math.hypot(a.x - b.x, a.y - b.y), arm: Number(wing.getAttribute('transform').match(/-?[\d.]+/)[0]) })
    t - t0 < 3000 ? requestAnimationFrame(tick) : done()
  }
  requestAnimationFrame(tick)
})
const gaps = rec.slice(1).map((r, i) => r.t - rec[i].t)
JSON.stringify({ frames: rec.length, maxGapMs: Math.max(...gaps).toFixed(1), maxDrift: Math.max(...rec.map((r) => r.drift)).toFixed(4), maxArmStep: Math.max(...rec.slice(1).map((r, i) => Math.abs(r.arm - rec[i].arm))).toFixed(2) })
```

Expected: `maxDrift` is `0.0000`, `maxGapMs` is under 34 (no run of dropped frames), and `maxArmStep` is under 5.

Also check with `getBoundingClientRect` that the header's bottom edge is above 160 px, which is where the atmosphere's clear area ends:

```js
document.querySelector('header').getBoundingClientRect().bottom
```

Expected: < 160.

- [ ] **Step 4: Report, then hand off**

Stop the dev server (`preview_stop`). Send the user the screenshots and the measurements. Then use **superpowers:finishing-a-development-branch** to offer a PR or a merge into `main`.
