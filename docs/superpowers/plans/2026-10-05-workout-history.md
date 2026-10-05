# Workout history Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Workouts page (from Stats' Training tile) listing every session of the running attempt as a stack of activity cards with logos, plus a logo picker and a "How did it feel?" mood on each workout in Today's sheet.

**Architecture:** A pure `workoutHistory()` in `src/logic/` groups the attempt's sessions by activity; `useWorkoutHistory` feeds it from Dexie; `WorkoutsPage` renders it as the screenshot's stack. Workouts gain an optional `feel` (no schema version bump). Seven icons join the app's set; `MoodPicker` is shared by the day's mood and the workout's feel.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Dexie 4 (`useLiveQuery`), Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-10-05-workout-history-design.md`

## Global Constraints

- UI copy is English; answers to the owner in French.
- iPhone PWA: touch only (no hover), buttons at least 44 px where space allows, text fields ≥ 16 px.
- Text contrast ≥ 4.5:1 in light and dark (tested).
- Honour "reduce motion": transitions only under `motion-safe:`.
- No Dexie version bump: `feel` is optional and unindexed; old workouts have none.
- Persistence only through `src/db/repositories/`; rules and aggregations are pure functions in `src/logic/`.
- Database tests use `freshDatabase` / `addChallenge` from `src/db/__tests__/fixtures.ts`; UI tests set `MotionGlobalConfig.skipAnimations = true`; tests that store Blobs run under `// @vitest-environment node`.
- Before every commit: `npx tsc -b`, `npm run lint`, `npm run test`, `npm run build` all pass (run the full set at least before the last commit and before the PR; a task's own tests after each step).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The seven activity logos

**Files:**
- Modify: `src/components/icons/icons.tsx` (seven entries right after `workout`)
- Modify: `src/components/icons/Icon.tsx` (optional `strokeWidth`)
- Test: `src/components/__tests__/Icon.test.tsx`

**Interfaces:**
- Produces: icon names `running`, `walking`, `weights`, `yoga`, `cycling`, `swimming`, `stopwatch`; `Icon` prop `strokeWidth?: number` (default 2).

- [ ] **Step 1: Write the failing test** — add to `Icon.test.tsx`:

```tsx
  it('draws thinner lines when asked, for the big drawings', () => {
    const { container } = render(<Icon name="cycling" size={220} strokeWidth={1} />)
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1')
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/__tests__/Icon.test.tsx`
Expected: FAIL (type error / `cycling` unknown, stroke-width is 2).

- [ ] **Step 3: Implement** — `Icon.tsx`:

```tsx
interface IconProps {
  name: IconName
  size?: number
  /** Line weight on the 24 px grid; thinner suits the big drawings. */
  strokeWidth?: number
  /** Announced to screen readers; without one the icon is decorative and hidden. */
  label?: string
  className?: string
}

export function Icon({ name, size = 24, strokeWidth = 2, label, className }: IconProps) {
```

and `strokeWidth={strokeWidth}` on the `<svg>`. In `icons.tsx`, after `workout: (…),`:

```tsx
  // The activities a workout can be (ACTIVITY_ICONS in src/content/activities.ts).
  running: (
    <>
      <circle cx="15" cy="4.5" r="2" {...SOFT} />
      <path d="M14 7.5L11 13.5M8 12l2-3 3.5-.5 2.5 2.5 2.5-.5M11 13.5l3.5 2.5-1 4.5M11 13.5l-1.5 4.5-4.5.5" />
    </>
  ),
  walking: (
    <>
      <g transform="rotate(-8 7.5 13)">
        <path d="M4.6 13.5c-.5-3.6.4-7.5 2.9-7.5s3.3 3.9 2.8 7.5c-.3 1.9-1.3 2.9-2.8 2.9s-2.6-1-2.9-2.9z" {...SOFT} />
        <path d="M5.4 18.5h4.2a2.1 2.1 0 0 1-4.2 0z" {...SOFT} />
      </g>
      <g transform="rotate(8 16.5 10)">
        <path d="M13.6 10c-.5-3.6.4-7.5 2.9-7.5s3.3 3.9 2.8 7.5c-.3 1.9-1.3 2.9-2.8 2.9s-2.6-1-2.9-2.9z" {...SOFT} />
        <path d="M14.4 15h4.2a2.1 2.1 0 0 1-4.2 0z" {...SOFT} />
      </g>
    </>
  ),
  weights: (
    <>
      <path d="M7.6 9.9C6.9 9 6.5 8 6.5 7.2 6.5 5.4 9 4 12 4s5.5 1.4 5.5 3.2c0 .8-.4 1.8-1.1 2.7" />
      <path d="M5.5 14.5a6.5 6.5 0 0 1 13 0c0 2.3-.7 4.3-1.8 5.5H7.3c-1.1-1.2-1.8-3.2-1.8-5.5z" {...SOFT} />
    </>
  ),
  yoga: (
    <>
      <path d="M12 5c1.8 1.8 2.7 4 2.7 6.4S13.8 15.7 12 17c-1.8-1.3-2.7-3.2-2.7-5.6S10.2 6.8 12 5z" {...SOFT} />
      <path d="M9.6 9.3C7.3 8.6 5 8.8 3.5 9.6c.3 3.6 2.9 6.6 6.4 7.2M14.4 9.3c2.3-.7 4.6-.5 6.1.3-.3 3.6-2.9 6.6-6.4 7.2M4 19.5h16" />
    </>
  ),
  cycling: (
    <>
      <circle cx="5.5" cy="15.5" r="3.5" {...SOFT} />
      <circle cx="18.5" cy="15.5" r="3.5" {...SOFT} />
      <path d="M5.5 15.5l4-7h6M11.5 15.5h-6M11.5 15.5l-2-7M11.5 15.5l4-7 3 7M9.5 8.5V6.5M8 6.5h3M15.5 8.5l-1-3h2.5" />
    </>
  ),
  swimming: (
    <>
      <circle cx="17.5" cy="9.5" r="2" {...SOFT} />
      <path d="M15 12.5L10.5 7 5.5 11" />
      <path d="M2.5 15.5c1.6 0 1.9-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2M2.5 19.5c1.6 0 1.9-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.5" r="7" {...SOFT} />
      <path d="M12 13.5V10M10 3.5h4M12 3.5v3M17.5 7.5l1.5-1.5" />
    </>
  ),
```

- [ ] **Step 4: Run the icon tests** — `npx vitest run src/components/__tests__/Icon.test.tsx`: PASS (the `it.each(ICON_NAMES)` case covers the seven new icons).

- [ ] **Step 5: Commit** — `feat(icons): logos for the seven workout activities; Icon takes a stroke width`

---

### Task 2: Workout types in the logic module, the feel, and backups

**Files:**
- Modify: `src/logic/types.ts` (add `WorkoutType`), `src/logic/constants.ts` (add `WORKOUT_TYPES`)
- Modify: `src/db/types.ts` (import and re-export `WorkoutType`; `Workout.feel`)
- Modify: `src/db/exportImport.ts` (workout row checks)
- Modify: `src/screens/Today/WorkoutTask.tsx` (use `WORKOUT_TYPES` from constants)
- Test: `src/db/__tests__/exportImport.test.ts`

**Interfaces:**
- Produces: `type WorkoutType` (logic/types, re-exported by db/types); `WORKOUT_TYPES: readonly WorkoutType[]` (logic/constants); `Workout.feel?: 1 | 2 | 3 | 4 | 5`.

- [ ] **Step 1: Write the failing tests** — in `exportImport.test.ts`, in `describe('export → reset → import')`:

```ts
  it('keeps how a workout felt through a backup', async () => {
    await seedEverything()
    const [workout] = await db.workouts.toArray()
    await db.workouts.update(workout.id, { feel: 4 })

    await roundTrip()

    expect((await db.workouts.get(workout.id))?.feel).toBe(4)
  })
```

and in `describe('validateExportPayload')`:

```ts
  it('rejects a workout of an unknown activity, or a feel outside the five moods', async () => {
    const base = await validPayload()
    for (const change of [{ type: 'Boxing' }, { feel: 9 }, { feel: 'great' }]) {
      const payload = structuredClone(base)
      Object.assign((payload.workouts as Record<string, unknown>[])[0], change)
      expect(validateExportPayload(payload).ok).toBe(false)
    }
  })
```

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/db/__tests__/exportImport.test.ts`: the round trip fails to type-check (`feel` unknown on `Workout`) or the validation test fails (both payloads accepted).

- [ ] **Step 3: Implement**

`src/logic/types.ts`, after `TaskId`:

```ts
/** What a workout was; the names double as the English labels. */
export type WorkoutType = 'Running' | 'Walking' | 'Weights' | 'Yoga' | 'Cycling' | 'Swimming' | 'Other'
```

`src/logic/constants.ts` (top: `import type { WorkoutType } from './types'`):

```ts
/** Every activity a workout can be, in the order the app lists them. */
export const WORKOUT_TYPES: readonly WorkoutType[] = ['Running', 'Walking', 'Weights', 'Yoga', 'Cycling', 'Swimming', 'Other']
```

`src/db/types.ts`: `import type { TaskId, WorkoutType } from '../logic/types'`, `export type { WorkoutType }`, delete the local union, and in `Workout`:

```ts
  /** How the session felt, on the five moods of "How was today?" (1 Rough … 5 Great). Unset when not given. */
  feel?: 1 | 2 | 3 | 4 | 5
```

`src/db/exportImport.ts`: import `WORKOUT_TYPES` from `../logic/constants` (the file already imports `CHALLENGE_LENGTH` from there), and:

```ts
const isWorkoutType = (value: unknown): boolean => (WORKOUT_TYPES as readonly unknown[]).includes(value)
const isFeel = (value: unknown): boolean => value === 1 || value === 2 || value === 3 || value === 4 || value === 5
```

```ts
  workouts: {
    id: isNumber,
    dayEntryId: isNumber,
    type: isWorkoutType,
    durationMin: isNumber,
    isOutdoor: isBoolean,
    feel: isOptional(isFeel),
  },
```

(The seven types have never changed since the first version, so every real backup passes.)

`WorkoutTask.tsx`: delete the local `WORKOUT_TYPES` and import it with `MAX_WORKOUTS` from `../../logic/constants`.

- [ ] **Step 4: Run** — `npx vitest run src/db/__tests__/exportImport.test.ts src/screens/Today` → PASS; `npx tsc -b` → no errors.

- [ ] **Step 5: Commit** — `feat(db): a workout's feel, kept in backups; backups check the activity`

---

### Task 3: `workoutHistory`, the pure grouping

**Files:**
- Create: `src/logic/workoutHistory.ts`
- Test: `src/logic/__tests__/workoutHistory.test.ts`

**Interfaces:**
- Consumes: `WORKOUT_TYPES`, `WorkoutType` (Task 2).
- Produces:

```ts
export type Feel = 1 | 2 | 3 | 4 | 5
export interface WorkoutSession { id: number; dayNumber: number; date: string; type: WorkoutType; durationMin: number; isOutdoor: boolean; feel?: Feel }
export interface ActivityHistory { type: WorkoutType; sessions: WorkoutSession[]; minutes: number; outdoors: number; feels: { feel: Feel; count: number }[] }
export interface WorkoutHistory { sessions: number; minutes: number; outdoors: number; activities: ActivityHistory[]; untried: WorkoutType[] }
export function workoutHistory(sessions: readonly WorkoutSession[]): WorkoutHistory
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORKOUT_TYPES } from '../constants'
import { workoutHistory, type WorkoutSession } from '../workoutHistory'

let nextId = 1
function session(dayNumber: number, type: WorkoutSession['type'], extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return { id: nextId++, dayNumber, date: '2026-10-05', type, durationMin: 45, isOutdoor: false, ...extra }
}

describe('workoutHistory', () => {
  it('groups the sessions by activity, most practised first, ties in the app’s order', () => {
    const history = workoutHistory([
      session(1, 'Cycling'),
      session(1, 'Running'),
      session(2, 'Yoga'),
      session(2, 'Running'),
      session(3, 'Weights'),
    ])

    expect(history.activities.map((a) => [a.type, a.sessions.length])).toEqual([
      ['Running', 2],
      ['Weights', 1],
      ['Yoga', 1],
      ['Cycling', 1],
    ])
    expect(history.untried).toEqual(['Walking', 'Swimming', 'Other'])
  })

  it('lists an activity’s sessions newest first, the later-logged first on the same day', () => {
    const day1 = session(1, 'Running')
    const day3First = session(3, 'Running')
    const day3Second = session(3, 'Running')
    const day2 = session(2, 'Running')

    const [running] = workoutHistory([day1, day3First, day3Second, day2]).activities

    expect(running.sessions).toEqual([day3Second, day3First, day2, day1])
  })

  it('adds up the minutes and the outdoor sessions, overall and per activity', () => {
    const history = workoutHistory([
      session(1, 'Running', { durationMin: 45, isOutdoor: true }),
      session(2, 'Running', { durationMin: 50, isOutdoor: true }),
      session(2, 'Weights', { durationMin: 60 }),
    ])

    expect([history.sessions, history.minutes, history.outdoors]).toEqual([3, 155, 2])
    expect(history.activities.map((a) => [a.type, a.minutes, a.outdoors])).toEqual([
      ['Running', 95, 2],
      ['Weights', 60, 0],
    ])
  })

  it('counts the feels given, best first, leaving out the ones never given', () => {
    const [running] = workoutHistory([
      session(1, 'Running', { feel: 4 }),
      session(2, 'Running', { feel: 2 }),
      session(3, 'Running', { feel: 4 }),
      session(4, 'Running'),
    ]).activities

    expect(running.feels).toEqual([
      { feel: 4, count: 2 },
      { feel: 2, count: 1 },
    ])
  })

  it('with no sessions, has no activities and every activity untried', () => {
    expect(workoutHistory([])).toEqual({ sessions: 0, minutes: 0, outdoors: 0, activities: [], untried: [...WORKOUT_TYPES] })
  })
})
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/logic/__tests__/workoutHistory.test.ts`: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/logic/workoutHistory.ts`:

```ts
import { WORKOUT_TYPES } from './constants'
import type { WorkoutType } from './types'

/** How a session felt, on the five moods of "How was today?" (1 Rough … 5 Great). */
export type Feel = 1 | 2 | 3 | 4 | 5

/** One logged workout, with the day it belongs to. */
export interface WorkoutSession {
  id: number
  dayNumber: number
  /** Its day's ISO date. */
  date: string
  type: WorkoutType
  durationMin: number
  isOutdoor: boolean
  feel?: Feel
}

/** Everything done in one activity. */
export interface ActivityHistory {
  type: WorkoutType
  /** Newest first: by day, then the later-logged first. */
  sessions: WorkoutSession[]
  minutes: number
  outdoors: number
  /** How the sessions felt, best first; only the feels given at least once. */
  feels: { feel: Feel; count: number }[]
}

/** An attempt's workouts, as the Workouts page shows them. */
export interface WorkoutHistory {
  sessions: number
  minutes: number
  outdoors: number
  /** The activities practised, most sessions first; ties keep WORKOUT_TYPES' order. */
  activities: ActivityHistory[]
  /** The activities never practised, in WORKOUT_TYPES' order. */
  untried: WorkoutType[]
}

const FEELS_BEST_FIRST: readonly Feel[] = [5, 4, 3, 2, 1]

const totalMinutes = (sessions: readonly WorkoutSession[]) => sessions.reduce((sum, s) => sum + s.durationMin, 0)
const outdoorCount = (sessions: readonly WorkoutSession[]) => sessions.filter((s) => s.isOutdoor).length

/** Groups an attempt's sessions by activity. */
export function workoutHistory(sessions: readonly WorkoutSession[]): WorkoutHistory {
  const activities = WORKOUT_TYPES.map((type) => activityHistory(type, sessions.filter((s) => s.type === type)))
    .filter((activity) => activity.sessions.length > 0)
    // sort is stable, so equal counts keep WORKOUT_TYPES' order.
    .sort((a, b) => b.sessions.length - a.sessions.length)

  return {
    sessions: sessions.length,
    minutes: totalMinutes(sessions),
    outdoors: outdoorCount(sessions),
    activities,
    untried: WORKOUT_TYPES.filter((type) => !activities.some((activity) => activity.type === type)),
  }
}

function activityHistory(type: WorkoutType, sessions: WorkoutSession[]): ActivityHistory {
  return {
    type,
    sessions: [...sessions].sort((a, b) => b.dayNumber - a.dayNumber || b.id - a.id),
    minutes: totalMinutes(sessions),
    outdoors: outdoorCount(sessions),
    feels: FEELS_BEST_FIRST.map((feel) => ({ feel, count: sessions.filter((s) => s.feel === feel).length })).filter(
      (f) => f.count > 0,
    ),
  }
}
```

- [ ] **Step 4: Run** — `npx vitest run src/logic/__tests__/workoutHistory.test.ts` → PASS.

- [ ] **Step 5: Commit** — `feat(logic): group an attempt's workouts by activity`

---

### Task 4: Activity logos and training time, shared

**Files:**
- Create: `src/content/activities.ts`
- Modify: `src/screens/Stats/StatsScreen.tsx` (use `formatMinutes`)
- Test: `src/content/__tests__/activities.test.ts`

**Interfaces:**
- Consumes: icon names (Task 1), `WORKOUT_TYPES` (Task 2).
- Produces: `ACTIVITY_ICONS: Record<WorkoutType, IconName>`, `formatMinutes(total: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { ICON_NAMES } from '../../components/icons/icons'
import { WORKOUT_TYPES } from '../../logic/constants'
import { ACTIVITY_ICONS, formatMinutes } from '../activities'

describe('activities', () => {
  it('gives every activity a logo of its own', () => {
    const icons = WORKOUT_TYPES.map((type) => ACTIVITY_ICONS[type])
    expect(new Set(icons).size).toBe(WORKOUT_TYPES.length)
    for (const icon of icons) expect(ICON_NAMES).toContain(icon)
  })

  it('reads training time like the Stats tile', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1h 0m')
    expect(formatMinutes(535)).toBe('8h 55m')
  })
})
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/content/__tests__/activities.test.ts`: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/content/activities.ts`:

```ts
import type { IconName } from '../components/icons/icons'
import type { WorkoutType } from '../logic/types'

/** Each activity's logo. */
export const ACTIVITY_ICONS: Record<WorkoutType, IconName> = {
  Running: 'running',
  Walking: 'walking',
  Weights: 'weights',
  Yoga: 'yoga',
  Cycling: 'cycling',
  Swimming: 'swimming',
  Other: 'stopwatch',
}

/** Training time: "45 min" under an hour, "8h 55m" from one. */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`
}
```

`StatsScreen.tsx`: delete `hours` / `minutes`; the Training tile's value becomes `formatMinutes(stats.workoutMinutes)`.

- [ ] **Step 4: Run** — `npx vitest run src/content` → PASS; `npx tsc -b` → clean.

- [ ] **Step 5: Commit** — `feat(content): each activity's logo; training time in one helper`

---

### Task 5: Today — the logo row and "How did it feel?"

**Files:**
- Create: `src/components/MoodPicker.tsx`
- Modify: `src/screens/Today/DayNotesTask.tsx` (use `MoodPicker`)
- Modify: `src/screens/Today/WorkoutTask.tsx` (title, `ActivityPicker`, feel)
- Test: `src/screens/Today/__tests__/WorkoutTask.test.tsx`

**Interfaces:**
- Consumes: `ACTIVITY_ICONS` (Task 4), `WORKOUT_TYPES` (Task 2), `Workout.feel` (Task 2), `Icon` `strokeWidth` (Task 1), `MOODS` / `Mood` (`src/content/moods.ts`).
- Produces: `MoodPicker({ label, value, onPick, selectedClassName, idleClassName? })`.

- [ ] **Step 1: Write the failing tests** — add to `WorkoutTask.test.tsx` (imports: `within` from Testing Library, `workoutRepo`, `type Workout`):

```tsx
  async function dayWithOneWorkout(workout: Partial<Workout> = {}) {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
    const id = await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true, ...workout })
    return { entryId: entry.id, id }
  }

  const renderTask = async (entryId: number, id: number) =>
    render(
      <WorkoutTask
        dayEntryId={entryId}
        workouts={[(await db.workouts.get(id))!]}
        complete={false}
        rules={RULESETS.hard}
        restDay={false}
        weekRestDay={undefined}
      />,
    )

  it('picks the activity by its logo', async () => {
    const { entryId, id } = await dayWithOneWorkout()
    await renderTask(entryId, id)

    expect(screen.getByRole('button', { name: 'Running' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Cycling' }))

    await waitFor(async () => expect((await db.workouts.get(id))?.type).toBe('Cycling'))
  })

  it('notes how the session felt', async () => {
    const { entryId, id } = await dayWithOneWorkout()
    await renderTask(entryId, id)

    fireEvent.click(within(screen.getByRole('group', { name: 'How did it feel?' })).getByRole('button', { name: 'Good' }))

    await waitFor(async () => expect((await db.workouts.get(id))?.feel).toBe(4))
  })

  it('clears the feel when the chosen mood is tapped again', async () => {
    const { entryId, id } = await dayWithOneWorkout({ feel: 4 })
    await renderTask(entryId, id)

    const good = within(screen.getByRole('group', { name: 'How did it feel?' })).getByRole('button', { name: 'Good' })
    expect(good).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(good)

    await waitFor(async () => expect((await db.workouts.get(id))?.feel).toBeUndefined())
  })
```

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/screens/Today/__tests__/WorkoutTask.test.tsx`: the three new cases FAIL (no such buttons / group).

- [ ] **Step 3: Implement**

`src/components/MoodPicker.tsx`:

```tsx
import { MOODS, type Mood } from '../content/moods'

interface MoodPickerProps {
  /** The group's accessible name. */
  label: string
  value: Mood | undefined
  /** The mood tapped; callers clear the value when it's the one already chosen. */
  onPick: (mood: Mood) => void
  /** The chosen mood's look, in its task's colour. */
  selectedClassName: string
  /** The other moods' background, set against what's behind the row. */
  idleClassName?: string
}

/** The five moods of "How was today?", worst to best, as emoji buttons. */
export function MoodPicker({ label, value, onPick, selectedClassName, idleClassName = 'bg-canvas' }: MoodPickerProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-5 gap-1">
      {MOODS.map((mood) => {
        const selected = value === mood.value
        return (
          <button
            key={mood.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(mood.value)}
            className={`flex min-h-touch flex-col items-center justify-center rounded-2xl py-1 motion-safe:transition-transform ${
              selected ? `scale-105 ${selectedClassName}` : idleClassName
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {mood.emoji}
            </span>
            <span className="text-[11px] font-bold text-ink-muted">{mood.label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

`DayNotesTask.tsx`: the `role="group"` block becomes

```tsx
      <MoodPicker label="Mood" value={entry.mood} onPick={setMood} selectedClassName="bg-yellow-light ring-2 ring-yellow-ink" />
```

(drop the now-unused `MOODS` import; keep `type Mood`).

`WorkoutTask.tsx`: `WorkoutRow` becomes

```tsx
function WorkoutRow({ workout }: { workout: Workout }) {
  const setFeel = (feel: Mood) => {
    void workoutRepo.update(workout.id, { feel: workout.feel === feel ? undefined : feel })
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-rounded text-lg font-extrabold text-ink">{workout.type}</p>
        <button
          type="button"
          onClick={() => void workoutRepo.remove(workout.id)}
          aria-label="Remove workout"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted"
        >
          ✕
        </button>
      </div>

      <ActivityPicker value={workout.type} onPick={(type) => void workoutRepo.update(workout.id, { type })} />

      <Stepper
        value={workout.durationMin}
        onStep={(delta) => void workoutRepo.adjustDuration(workout.id, delta, 0, 300)}
        step={5}
        min={0}
        max={300}
        unit="min"
      />

      <Toggle
        checked={workout.isOutdoor}
        onChange={(checked) => void workoutRepo.update(workout.id, { isOutdoor: checked })}
        label={workout.isOutdoor ? 'Outdoor' : 'Indoor'}
        activeColor="blue"
      />

      <p className="font-rounded text-sm font-bold text-ink-muted">How did it feel?</p>
      <MoodPicker
        label="How did it feel?"
        value={workout.feel}
        onPick={setFeel}
        selectedClassName="bg-orange-light ring-2 ring-orange-ink"
        idleClassName="bg-surface"
      />
    </div>
  )
}

/** The seven activities as logos; the chosen one is ringed in the workouts' orange. */
function ActivityPicker({ value, onPick }: { value: WorkoutType; onPick: (type: WorkoutType) => void }) {
  return (
    <div role="group" aria-label="Activity" className="grid grid-cols-7 gap-1">
      {WORKOUT_TYPES.map((type) => {
        const selected = type === value
        return (
          <button
            key={type}
            type="button"
            aria-label={type}
            aria-pressed={selected}
            onClick={() => onPick(type)}
            className={`flex h-11 items-center justify-center rounded-xl motion-safe:transition-colors ${
              selected ? 'bg-orange-light text-orange-ink ring-2 ring-orange-ink' : 'bg-surface text-ink-muted'
            }`}
          >
            <Icon name={ACTIVITY_ICONS[type]} size={26} strokeWidth={1.8} />
          </button>
        )
      })}
    </div>
  )
}
```

(imports: `Icon`, `MoodPicker`, `ACTIVITY_ICONS`, `type Mood`.)

- [ ] **Step 4: Run** — `npx vitest run src/screens/Today` → PASS (old and new cases; TodayScreen's tests still find the mood buttons).

- [ ] **Step 5: Commit** — `feat(today): pick a workout's activity by its logo, and note how it felt`

---

### Task 6: Colours for the stack and the open card

**Files:**
- Modify: `src/styles/index.css` (`@theme` and `.dark`)
- Test: `src/lib/__tests__/brandColors.test.ts`

**Interfaces:**
- Produces: tokens `--color-stack-from`, `--color-stack-to`, `--color-on-stack`, `--color-open-card`, `--color-on-open-card` (utilities `text-on-stack`, `bg-open-card`, `text-on-open-card`).

- [ ] **Step 1: Write the failing test** — in `brandColors.test.ts`, inside the `describe`, after the brand loop:

```ts
  for (const mode of ['light', 'dark'] as const) {
    it(`keeps the Workouts page's cards readable (${mode})`, () => {
      const body = block(mode === 'dark' ? '.dark' : '@theme')
      // Every channel moves one way between the stack's ends, so its ends bound every shade.
      for (const end of ['stack-from', 'stack-to']) {
        expect(contrastRatio(token(body, 'on-stack'), token(body, end)), end).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrastRatio(token(body, 'on-open-card'), token(body, 'open-card'))).toBeGreaterThanOrEqual(4.5)
    })
  }
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/lib/__tests__/brandColors.test.ts`: FAIL (`stack-from` not found).

- [ ] **Step 3: Implement** — in `@theme`, before `--spacing-touch`:

```css
  /* The Workouts page: the stack of activity cards (strongest at the top) and the open card. */
  --color-stack-from: #ff8a3d;
  --color-stack-to: #ffcfb0;
  --color-on-stack: #3d1a05;
  --color-open-card: #38b6ff;
  --color-on-open-card: #08324f;
```

and at the end of `.dark`:

```css
  --color-stack-from: #a9461a;
  --color-stack-to: #4f2819;
  --color-on-stack: #fff1e6;
  --color-open-card: #0b5d91;
  --color-on-open-card: #e8f6ff;
```

(Ratios: light 6.64 / 10.98 / 5.89, dark 5.30 / 11.50 / 6.38.)

- [ ] **Step 4: Run** — `npx vitest run src/lib/__tests__/brandColors.test.ts` → PASS.

- [ ] **Step 5: Commit** — `feat(ui): colours for the Workouts page's cards, contrast-tested`

---

### Task 7: The Workouts page

**Files:**
- Create: `src/hooks/useWorkoutHistory.ts`
- Create: `src/screens/Stats/WorkoutsPage.tsx`
- Test: `src/screens/Stats/__tests__/WorkoutsPage.test.tsx`

**Interfaces:**
- Consumes: `workoutHistory` and its types (Task 3), `ACTIVITY_ICONS` / `formatMinutes` (Task 4), the tokens (Task 6), `MOODS`, `formatShortDay`, `dayEntryRepo.getAllForChallenge`, `workoutRepo.getForDayEntries`.
- Produces: `useWorkoutHistory(challengeId: number): WorkoutHistory | undefined`; `WorkoutsPage({ challengeId, onBack })`.

- [ ] **Step 1: Write the failing test** — `src/screens/Stats/__tests__/WorkoutsPage.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { DayEntry, Workout } from '../../../db/types'
import { addDaysISO } from '../../../lib/dates'
import { WorkoutsPage } from '../WorkoutsPage'

const START = '2026-09-30'

/** Day 1: a run (Good) and weights; Day 2: a run (Great). */
async function seedAttempt(): Promise<number> {
  const challengeId = await addChallenge({ startDate: START, attemptNumber: 1, status: 'active' })
  const day = (dayNumber: number) =>
    db.dayEntries.add({
      challengeId,
      date: addDaysISO(START, dayNumber - 1),
      dayNumber,
      water_ml: 0,
      pages_read: 0,
      dietFollowed: false,
      noAlcohol: false,
      completed: false,
    } as DayEntry)
  const day1 = await day(1)
  const day2 = await day(2)
  await db.workouts.bulkAdd([
    { dayEntryId: day1, type: 'Running', durationMin: 45, isOutdoor: true, feel: 4 },
    { dayEntryId: day1, type: 'Weights', durationMin: 50, isOutdoor: false },
    { dayEntryId: day2, type: 'Running', durationMin: 50, isOutdoor: true, feel: 5 },
  ] as Workout[])
  return challengeId
}

describe('WorkoutsPage', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('adds up the attempt and opens the most practised activity on its sessions, newest first', async () => {
    render(<WorkoutsPage challengeId={await seedAttempt()} onBack={() => {}} />)

    const running = await screen.findByRole('button', { name: 'Running, 2 sessions' })
    expect(running).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Weights, 1 session' })).toHaveAttribute('aria-expanded', 'false')

    const summary = screen.getByRole('list', { name: 'This attempt' })
    expect(summary).toHaveTextContent('3sessions')
    expect(summary).toHaveTextContent('2h 25mof training')
    expect(summary).toHaveTextContent('2outdoors')

    const rows = within(screen.getByRole('list', { name: 'Running sessions' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Day 2'),
      expect.stringContaining('Day 1'),
    ])
    expect(rows[0]).toHaveTextContent('Thu 1 Oct')
    expect(rows[0]).toHaveTextContent('50 min · Outdoor')
    expect(within(rows[0]).getByRole('img', { name: 'Great' })).toBeInTheDocument()

    const feels = within(screen.getByRole('list', { name: 'How it felt' })).getAllByRole('listitem')
    expect(feels.map((chip) => chip.textContent)).toEqual([expect.stringContaining('Great: 1'), expect.stringContaining('Good: 1')])
  })

  it('opens one card at a time, and closes the open one when tapped', async () => {
    render(<WorkoutsPage challengeId={await seedAttempt()} onBack={() => {}} />)

    const weights = await screen.findByRole('button', { name: 'Weights, 1 session' })
    fireEvent.click(weights)
    expect(weights).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Running, 2 sessions' })).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(weights)
    expect(weights).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: /sessions$/ })).not.toBeInTheDocument()
  })

  it('lists the activities not tried yet', async () => {
    render(<WorkoutsPage challengeId={await seedAttempt()} onBack={() => {}} />)

    const untried = await screen.findByRole('list', { name: 'Not tried yet' })
    expect(within(untried).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'Walking',
      'Yoga',
      'Cycling',
      'Swimming',
      'Other',
    ])
  })

  it('with no workouts yet, says so', async () => {
    const challengeId = await addChallenge({ startDate: START, attemptNumber: 1, status: 'active' })
    render(<WorkoutsPage challengeId={challengeId} onBack={() => {}} />)

    expect(await screen.findByRole('heading', { name: 'No workouts yet' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Not tried yet' })).getAllByRole('listitem')).toHaveLength(7)
  })

  it('goes back to Stats', async () => {
    const onBack = vi.fn()
    render(<WorkoutsPage challengeId={await seedAttempt()} onBack={onBack} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Stats' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/screens/Stats`: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/hooks/useWorkoutHistory.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { workoutHistory, type WorkoutHistory, type WorkoutSession } from '../logic/workoutHistory'

/** An attempt's workouts grouped by activity, live from Dexie. `undefined` while loading. */
export function useWorkoutHistory(challengeId: number): WorkoutHistory | undefined {
  return useLiveQuery(async () => {
    const entries = await dayEntryRepo.getAllForChallenge(challengeId)
    const workouts = await workoutRepo.getForDayEntries(entries.map((e) => e.id))
    const entryById = new Map(entries.map((e) => [e.id, e]))
    const sessions = workouts.flatMap((w): WorkoutSession[] => {
      const entry = entryById.get(w.dayEntryId)
      return entry ? [{ ...w, dayNumber: entry.dayNumber, date: entry.date }] : []
    })
    return workoutHistory(sessions)
  }, [challengeId])
}
```

`src/screens/Stats/WorkoutsPage.tsx`:

```tsx
import { useId, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { ACTIVITY_ICONS, formatMinutes } from '../../content/activities'
import { MOODS } from '../../content/moods'
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory'
import { formatShortDay } from '../../lib/dates'
import type { WorkoutType } from '../../logic/types'
import type { ActivityHistory, Feel, WorkoutHistory } from '../../logic/workoutHistory'

const sessionsWord = (count: number) => (count === 1 ? 'session' : 'sessions')
const moodFor = (feel: Feel) => MOODS.find((mood) => mood.value === feel)!

/** The translucent wash for chips and the session list on the open card. */
const WASH = 'bg-white/55 dark:bg-black/25'

interface WorkoutsPageProps {
  challengeId: number
  onBack: () => void
}

/** Every workout of the attempt: a card per activity, stacked, one open on its sessions. */
export function WorkoutsPage({ challengeId, onBack }: WorkoutsPageProps) {
  const history = useWorkoutHistory(challengeId)
  // undefined: the top card is open (the default); null: the player closed them all.
  const [chosen, setChosen] = useState<WorkoutType | null | undefined>(undefined)
  const open = chosen === undefined ? history?.activities[0]?.type : chosen

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-touch items-center gap-1 rounded-xl px-2 font-rounded font-bold text-world-ink"
        >
          <Icon name="chevron" size={18} className="rotate-180" />
          Stats
        </button>
        <h1 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
          <Icon name="workout" className="text-world-ink" />
          Workouts
        </h1>
      </header>

      {history && (
        <main className="flex flex-col gap-5 px-4">
          {history.sessions === 0 ? (
            <section className="rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-ink/10 dark:ring-0">
              <h2 className="font-display text-xl tracking-wide text-ink">No workouts yet</h2>
              <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">Log your first one from Today.</p>
            </section>
          ) : (
            <>
              <Summary history={history} />
              <div>
                {history.activities.map((activity, i) => (
                  <ActivityCard
                    key={activity.type}
                    activity={activity}
                    shade={history.activities.length > 1 ? i / (history.activities.length - 1) : 0}
                    open={activity.type === open}
                    onToggle={() => setChosen(activity.type === open ? null : activity.type)}
                  />
                ))}
              </div>
            </>
          )}
          {history.untried.length > 0 && <Untried types={history.untried} />}
        </main>
      )}
    </div>
  )
}

function Summary({ history }: { history: WorkoutHistory }) {
  const tiles = [
    { value: `${history.sessions}`, label: sessionsWord(history.sessions) },
    { value: formatMinutes(history.minutes), label: 'of training' },
    { value: `${history.outdoors}`, label: 'outdoors' },
  ]
  return (
    <ul aria-label="This attempt" className="grid grid-cols-3 gap-2.5">
      {tiles.map((tile) => (
        <li key={tile.label} className="rounded-[1.25rem] bg-surface px-3.5 py-3 shadow-sm ring-1 ring-ink/10 dark:ring-0">
          <span className="block font-display text-xl leading-tight tracking-wide text-world-ink">{tile.value}</span>
          <span className="font-rounded text-xs font-bold text-ink-muted">{tile.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface ActivityCardProps {
  activity: ActivityHistory
  /** Where its colour sits between the stack's strongest shade (0, the top) and its softest (1). */
  shade: number
  open: boolean
  onToggle: () => void
}

/**
 * One activity: a folder-like card drawn over the bottom of the one above. Closed, its logo,
 * count and time; open, sky blue with the logo faint behind its feels, totals and sessions.
 */
function ActivityCard({ activity, shade, open, onToggle }: ActivityCardProps) {
  const { type, sessions, minutes, outdoors, feels } = activity
  const panelId = useId()
  const count = sessions.length

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] shadow-[0_-6px_16px_rgba(0,0,0,0.1)] not-first:-mt-8 motion-safe:transition-colors ${
        open ? 'bg-open-card text-on-open-card' : 'text-on-stack'
      }`}
      style={
        open
          ? undefined
          : { backgroundColor: `color-mix(in srgb, var(--color-stack-from), var(--color-stack-to) ${Math.round(shade * 100)}%)` }
      }
    >
      {open && (
        <Icon
          name={ACTIVITY_ICONS[type]}
          size={220}
          strokeWidth={1}
          className="pointer-events-none absolute -top-4 -right-12 opacity-15"
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className={`relative flex w-full items-center gap-4 px-5 pt-5 text-left ${open ? 'pb-2' : 'pb-12'}`}
      >
        {!open && <Icon name={ACTIVITY_ICONS[type]} size={56} strokeWidth={1.5} className="shrink-0" />}
        {open ? (
          <span className="flex-1 font-rounded text-xl font-extrabold">{type}</span>
        ) : (
          <span className="flex-1">
            <span className="block font-rounded text-lg font-extrabold">{type}</span>
            <span className="block font-display text-4xl leading-none tracking-wide">{count}</span>
            <span className="block font-rounded text-sm font-extrabold">
              {sessionsWord(count)} · {formatMinutes(minutes)}
            </span>
          </span>
        )}
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full ${open ? WASH : ''}`}>
          <Icon name="chevron" size={20} className={open ? '-rotate-90' : 'rotate-90'} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="relative px-5 pb-12">
          {feels.length > 0 && (
            <ul aria-label="How it felt" className="flex flex-wrap gap-1.5">
              {feels.map(({ feel, count: times }) => (
                <li key={feel} className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 font-rounded text-sm font-extrabold ${WASH}`}>
                  <span aria-hidden="true" className="text-lg">
                    {moodFor(feel).emoji}
                  </span>
                  <span className="sr-only">{moodFor(feel).label}: </span>
                  {times}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-end gap-6">
            <p>
              <span className="block font-display text-6xl leading-[0.9] tracking-wide">{count}</span>
              <span className="font-rounded text-sm font-extrabold">{sessionsWord(count)}</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none tracking-wide">{formatMinutes(minutes)}</span>
              <span className="font-rounded text-sm font-extrabold">in total</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none tracking-wide">{outdoors}</span>
              <span className="font-rounded text-sm font-extrabold">outdoors</span>
            </p>
          </div>

          <ol aria-label={`${type} sessions`} className={`mt-4 divide-y divide-current/15 rounded-[1.25rem] px-3.5 ${WASH}`}>
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2.5 py-2.5">
                <span className="flex-1">
                  <span className="block font-rounded font-extrabold">Day {session.dayNumber}</span>
                  <span className="block font-rounded text-xs font-bold">{formatShortDay(session.date)}</span>
                </span>
                <span className="font-rounded text-sm font-extrabold">
                  {session.durationMin} min · {session.isOutdoor ? 'Outdoor' : 'Indoor'}
                </span>
                <span className="w-7 text-center text-xl">
                  {session.feel && (
                    <span role="img" aria-label={moodFor(session.feel).label}>
                      {moodFor(session.feel).emoji}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function Untried({ types }: { types: readonly WorkoutType[] }) {
  return (
    <section>
      <h2 className="px-1 font-rounded text-xs font-extrabold tracking-wide text-ink-muted uppercase">Not tried yet</h2>
      <ul aria-label="Not tried yet" className="mt-2 flex flex-wrap gap-2">
        {types.map((type) => (
          <li
            key={type}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-2 font-rounded text-sm font-bold text-ink-muted shadow-sm ring-1 ring-ink/10 dark:ring-0"
          >
            <Icon name={ACTIVITY_ICONS[type]} size={24} strokeWidth={1.8} />
            {type}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Run** — `npx vitest run src/screens/Stats` → PASS; `npx tsc -b` and `npm run lint` → clean.

- [ ] **Step 5: Commit** — `feat(stats): the Workouts page, a card per activity`

---

### Task 8: Stats — the Training tile opens the page

**Files:**
- Modify: `src/screens/Stats/StatTiles.tsx` (`StatTile` optional `onClick`)
- Modify: `src/screens/Stats/StatsScreen.tsx` (page state)
- Test: `src/screens/Stats/__tests__/StatsScreen.test.tsx`

**Interfaces:**
- Consumes: `WorkoutsPage` (Task 7), `formatMinutes` (Task 4).
- Produces: `StatTile({ art, value, label, tone, onClick? })`.

- [ ] **Step 1: Write the failing test** — `src/screens/Stats/__tests__/StatsScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { todayISO } from '../../../lib/dates'
import { StatsScreen } from '../StatsScreen'

describe('StatsScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    window.scrollTo = vi.fn()
  })

  beforeEach(freshDatabase)

  it('opens the Workouts page from the Training tile, and comes back', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId))!
    render(<StatsScreen challenge={challenge} streak={0} today={todayISO()} todayDayNumber={1} completed={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Training/ }))
    expect(await screen.findByRole('heading', { name: 'Workouts' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { name: 'Stats' })).toBeInTheDocument()
  })
})
```

(Nothing under Stats calls `matchMedia` or `ResizeObserver`, so no stubs beyond `scrollTo`.)

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/screens/Stats/__tests__/StatsScreen.test.tsx`: FAIL (no Training button).

- [ ] **Step 3: Implement**

`StatTiles.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'

const TILE = 'flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0'

/** A stats tile: a small illustration, the number, and what it counts. With `onClick`, it opens more. */
export function StatTile({ art, value, label, tone, onClick }: { art: ReactNode; value: string; label: string; tone: string; onClick?: () => void }) {
  const body = (
    <>
      <span className={`flex h-12 items-end ${tone}`}>{art}</span>
      <span className={`block font-display text-2xl leading-none tracking-wide ${tone}`}>{value}</span>
      <span className="block font-rounded text-xs font-bold text-ink-muted">{label}</span>
    </>
  )
  if (!onClick) return <div className={TILE}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={`relative text-left motion-safe:transition-transform active:scale-[0.98] ${TILE}`}>
      {body}
      <Icon name="chevron" size={18} className="absolute top-4 right-4 text-ink-muted" />
    </button>
  )
}
```

`StatsScreen.tsx`: `const [page, setPage] = useState<'workouts' | null>(null)` (after `useChallengeStats`), then, before the main `return`:

```tsx
  if (page === 'workouts') return <WorkoutsPage challengeId={challenge.id} onBack={() => setPage(null)} />
```

and the Training tile gets

```tsx
            onClick={() => {
              setPage('workouts')
              window.scrollTo(0, 0)
            }}
```

- [ ] **Step 4: Run** — `npx vitest run src/screens/Stats` → PASS.

- [ ] **Step 5: Commit** — `feat(stats): the Training tile opens the Workouts page`

---

### Task 9: Dev seeds, README, spec status

**Files:**
- Modify: `src/dev/scenarios.ts` (`perfectDay`)
- Modify: `README.md` (features), `docs/superpowers/specs/2026-10-05-workout-history-design.md` (status)

- [ ] **Step 1: Vary the seeded workouts** — in `perfectDay`:

```ts
/** Every task done: two qualifying workouts (one outdoor), diet, water, pages and a photo. The workouts vary by day, so time travel shows a lively history. */
async function perfectDay(dayNumber: number): Promise<SeedDay> {
  const outdoor = (['Running', 'Walking', 'Cycling'] as const)[dayNumber % 3]
  const indoor = (['Weights', 'Yoga', 'Weights', 'Swimming'] as const)[dayNumber % 4]
  const feel = (offset: number) => (((dayNumber + offset) % 5) + 1) as NonNullable<Workout['feel']>
  return {
    dayNumber,
    entry: {
      water_ml: RULESETS.hard.waterTargetMl,
      pages_read: RULESETS.hard.pagesTarget,
      dietFollowed: true,
      noAlcohol: true,
      completed: true,
    },
    photo: await fakePhoto(`Day ${dayNumber}`, (dayNumber * 37) % 360),
    workouts: [
      { type: outdoor, durationMin: RULESETS.hard.minWorkoutMin + (dayNumber % 3) * 5, isOutdoor: true, feel: feel(0) },
      { type: indoor, durationMin: 60, isOutdoor: false, feel: feel(2) },
    ],
  }
}
```

- [ ] **Step 2: README** — the Today bullet mentions the sheet's logos and "How did it feel?"; the Stats bullet adds: "The Training tile opens Workouts: every session of the attempt as a stack of cards, one per activity with its logo; tap one to open it on its sessions (day, minutes, outdoors, how it felt)."

- [ ] **Step 3: Spec status** — "Status: **built** (PR into `main`)".

- [ ] **Step 4: Full check** — `npx tsc -b`, `npm run lint`, `npm run test`, `npm run build`: all pass. Then the browser: the dev server from the worktree, `/?db=time-travel&travel=20`, Stats → Training, light and dark; Today's workouts sheet.

- [ ] **Step 5: Commit** — `chore: lively seeded workouts; README and spec for the workout history`
