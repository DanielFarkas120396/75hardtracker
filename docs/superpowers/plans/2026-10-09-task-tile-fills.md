# Task tile fills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each open task tile on Today fills with its chosen animation as the task progresses, and a full tile glows and shrinks into its chip, with the board closing up smoothly.

**Architecture:** One lazily loaded three.js renderer (the "engine") draws every tile's fill on a hidden canvas at the tile's live size and copies it into a plain 2D canvas inside the tile. A small pure state per task (tile → full → morphing → chip) drives the board; the Web Animations API runs the glow, the morph and the width changes, and framer-motion keeps doing the position slides it already does. The gauge counts the chips that have landed, and "Day complete!" waits for the board to settle.

**Tech Stack:** React 19, TypeScript, three.js 0.186 (already a dependency), framer-motion 13, Tailwind v4, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-09-task-tile-fills-design.md`. The visual reference is `docs/prototypes/today-preview.html` (all five fills and the flow), with each fill's exact settings in `docs/prototypes/README.md`. Executors read both.

## Global Constraints

- Target: an iPhone, installed Home Screen app in Safari. Touch only, nothing depends on hover, nothing vibrates.
- Honour reduce motion, the gentle way: no movement, a 0.25 s crossfade to each new level, no drift, a full tile fades into its chip, nothing slides.
- Text meets WCAG 4.5:1 in light and dark, in every world. Over a fill, the status line uses the ink colour (`text-ink`). Each fill's opacity is lowered only as far as the ink text needs (`fillOpacity`, Task 2).
- three.js loads only through `import('./engine')` (its own chunk). Nothing in the main chunk imports `three` at runtime; type-only imports are fine.
- Data never waits: saving stays as it is; only the display follows the animation.
- No Dexie changes. No new dependencies.
- UI tests set `MotionGlobalConfig.skipAnimations = true`. jsdom has no WebGL, no `matchMedia`, no Web Animations API and no 2D canvas: without them the board behaves as today (thin bars, chips at once).
- Before every commit all four pass: `npx tsc -b`, `npm run lint`, `npm run test`, `npm run build`.
- Branches: each part is one feature branch from `main`, in its own worktree (other sessions share the main checkout: never switch branches there), and one PR into `main`. PRs land with `gh pr merge <n> --merge`, only when the owner asks.
- UI copy is English.

## File Structure

Created:

| File | Responsibility |
|---|---|
| `src/lib/webgl.ts` | `supportsWebGL()`, asked once (moved out of `JourneyEffects.tsx`). |
| `src/screens/Today/fills/painter.ts` | Types only: `Painter`, `PainterKind`, `TASK_PAINTER`, `FillEngine`, `FillHandle`, `LevelMode`. |
| `src/screens/Today/fills/palette.ts` | Fill colours from the world palette; `fillOpacity` and the contrast rule. No three.js. |
| `src/screens/Today/fills/motion.ts` | Easings and a damped spring, shared by the painters. |
| `src/screens/Today/fills/schedule.ts` | The engine's per-frame decision (pure). |
| `src/screens/Today/fills/quad.ts` | A tile-sized shader quad and its 1:1 camera (three.js). |
| `src/screens/Today/fills/wave.ts` | Water's painter. Parts 2–4 add `ink.ts`, `sprint.ts`, `iris.ts` and `book.ts`. |
| `src/screens/Today/fills/painters.ts` | The registry of painters built so far. |
| `src/screens/Today/fills/engine.ts` | The shared renderer and frame loop (lazy chunk). |
| `src/screens/Today/fills/useFillEngine.ts` | Loads the engine; `FillEngineContext`. |
| `src/screens/Today/fills/TileFill.tsx` | The canvas in a tile; reports the level shown and when it has settled. |
| `src/screens/Today/fills/boardPhases.ts` | The pure per-task state: tile → full → morphing → chip. |
| `src/screens/Today/fills/boardMotion.ts` | Glow, morph, width change, tick pop (Web Animations API). |
| `src/screens/Today/fills/useFrozenWhile.ts` | Holds a value while a sheet covers the board. |
| `src/screens/Today/fills/boardSettle.ts` | "The board is still settling", for the gauge and "Day complete!". |
| `src/screens/Today/TaskTile.tsx` | The tile, split out of `TaskBoard.tsx`, now with its fill. |

Modified: `src/content/taskStatus.ts` (`taskFill`, `countedData`), `src/screens/Today/TaskBoard.tsx`, `DayBoard.tsx`, `TodayScreen.tsx`, `PhotoCapture.tsx` and `photoCaptureContext.ts` (`cameraOpen`), `DietSwitches.tsx` (the ink's anchor, Part 2), `src/screens/Journey/effects/JourneyEffects.tsx` (uses `supportsWebGL`), `src/App.tsx` (the celebration waits).

---

# Part 1 (PR 1): the engine, the board's flow, and Water

Worktree and branch, once, before Task 1:

```bash
git -C C:/Users/danie/Documents/Coding/Claude/75hard worktree add .claude/worktrees/tile-fills-1 -b feat/tile-fills-1 main
cd C:/Users/danie/Documents/Coding/Claude/75hard/.claude/worktrees/tile-fills-1 && npm install
```

Every path below is relative to that worktree.

### Task 1: `taskFill` and the counted status

**Files:**
- Modify: `src/content/taskStatus.ts` (after `taskProgress`, end of file)
- Test: `src/content/__tests__/taskStatus.test.ts`

**Interfaces:**
- Produces: `taskFill(task: TaskId, data: DayTaskData, rules: Ruleset): number` (0–1, all five tasks) and `countedData(task: TaskId, data: DayTaskData, rules: Ruleset, shown: number): DayTaskData`.

- [ ] **Step 1: Write the failing tests**

Add `countedData, taskFill` to the import from `'../taskStatus'`, then append:

```ts
describe('taskFill', () => {
  it('fills the diet half per switch, and whole with the one switch of a social day', () => {
    expect(taskFill('diet', empty, hard)).toBe(0)
    expect(taskFill('diet', { ...empty, dietFollowed: true }, hard)).toBe(0.5)
    expect(taskFill('diet', { ...empty, dietFollowed: true, noAlcohol: true }, hard)).toBe(1)
    const social = { ...empty, socialDay: true }
    expect(taskFill('diet', { ...social, dietFollowed: true }, strong)).toBe(1)
    // Hard has no social days: a stray flag changes nothing.
    expect(taskFill('diet', { ...social, dietFollowed: true }, hard)).toBe(0.5)
  })

  it('fills the photo all at once', () => {
    expect(taskFill('photo', empty, hard)).toBe(0)
    expect(taskFill('photo', { ...empty, hasPhoto: true }, hard)).toBe(1)
  })

  it('follows the measurable tasks like the progress bar, capped at 1', () => {
    expect(taskFill('water', { ...empty, water_ml: 1900 }, hard)).toBe(0.5)
    expect(taskFill('water', { ...empty, water_ml: 5000 }, hard)).toBe(1)
    expect(taskFill('reading', { ...empty, pages_read: 4 }, hard)).toBe(0.4)
    const one = { ...empty, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(taskFill('workouts', one, hard)).toBe(0.5)
    // Medium needs one workout: the same session fills its tile.
    expect(taskFill('workouts', one, medium)).toBe(1)
  })
})

describe('countedData', () => {
  it('counts water to the nearest 50 ml and pages one by one, leaving the rest as it is', () => {
    expect(countedData('water', empty, hard, 0.4).water_ml).toBe(1500)
    expect(countedData('reading', empty, hard, 0.36).pages_read).toBe(4)
    const day = { ...empty, water_ml: 1000 }
    expect(countedData('diet', day, hard, 0.5)).toBe(day)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/content/__tests__/taskStatus.test.ts`
Expected: FAIL, `taskFill is not a function` (and the same for `countedData`).

- [ ] **Step 3: Implement**

Append to `src/content/taskStatus.ts`:

```ts
/** How full a task's tile is, 0–1: what its fill shows. Every task has one, the tick-box ones too. */
export function taskFill(task: TaskId, data: DayTaskData, rules: Ruleset): number {
  if (task === 'diet') {
    const social = rules.socialDaysPerWeek > 0 && data.socialDay === true
    const ticked = (data.dietFollowed ? 1 : 0) + (!social && data.noAlcohol ? 1 : 0)
    return Math.min(1, ticked / (social ? 1 : 2))
  }
  if (task === 'photo') return data.hasPhoto ? 1 : 0
  return taskProgress(task, data, rules) ?? 0
}

/** The day as a tile shows it while its fill still moves: water (to the nearest 50 ml) and pages count up with the fill. */
export function countedData(task: TaskId, data: DayTaskData, rules: Ruleset, shown: number): DayTaskData {
  if (task === 'water') return { ...data, water_ml: Math.round((shown * rules.waterTargetMl) / 50) * 50 }
  if (task === 'reading') return { ...data, pages_read: Math.round(shown * rules.pagesTarget) }
  return data
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/content/__tests__/taskStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/content/taskStatus.ts src/content/__tests__/taskStatus.test.ts
git commit -m "feat(today): taskFill and countedData for the tile fills"
```

### Task 2: the fill palette and the contrast rule

**Files:**
- Create: `src/screens/Today/fills/painter.ts`, `src/screens/Today/fills/palette.ts`
- Test: `src/screens/Today/fills/__tests__/palette.test.ts`

**Interfaces:**
- Produces (painter.ts): `PainterKind`, `TASK_PAINTER`, `Painter`, `LevelMode`, `FillHandle`, `FillEngine` (below).
- Produces (palette.ts): `RGB`, `Mode`, `TILE_INK`, `rgb(hex)`, `toHex(rgb)`, `mix(a, b, t)`, `FillPalette`, `fillPalette(world: WorldPalette, mode: Mode)`, `FILL_LOOK`, `textContrastOver(palette, alpha)`, `fillOpacity(kind, palette)`.

- [ ] **Step 1: Write the types (no test of their own)**

`src/screens/Today/fills/painter.ts`:

```ts
import type { WebGLRenderer } from 'three'
import type { TaskId } from '../../../logic/types'
import type { FillPalette } from './palette'

/** The look a task's tile fills with, as chosen in docs/prototypes/. */
export type PainterKind = 'wave' | 'ink' | 'sprint' | 'iris' | 'book'

export const TASK_PAINTER: Record<TaskId, PainterKind> = {
  water: 'wave',
  diet: 'ink',
  workouts: 'sprint',
  photo: 'iris',
  reading: 'book',
}

/** One tile's fill, drawn with the board's shared three.js renderer. */
export interface Painter {
  /** Moves the fill to `level` (0–1), animated unless `instant`. */
  setLevel(level: number, instant: boolean): void
  /** Advances by `dt` seconds; `drift` is false under reduce motion. True while the fill still moves. */
  step(dt: number, drift: boolean): boolean
  /** True while the fill shows something that keeps drifting (ink, waves, flow): it wants idle frames. */
  drifts(): boolean
  /** The level the fill shows right now, 0–1. */
  shown(): number
  /** The fill has reached its level and looks complete. */
  settled(): boolean
  /** Draws the fill for a tile of this size (CSS px) into the renderer's current viewport. */
  render(renderer: WebGLRenderer, width: number, height: number): void
  setPalette(palette: FillPalette): void
  /** Where the control the fill starts from sits (the switches, a chip): px from the tile's right edge and from its top. */
  setAnchor?(right: number, top: number): void
  /** The day's photo, for the iris. */
  setImage?(image: ImageBitmap | null): void
  dispose(): void
}

/** 'animate' plays the fill's own animation; 'fade' crossfades to the new level (reduce motion); 'instant' just shows it. */
export type LevelMode = 'animate' | 'fade' | 'instant'

/** A tile's fill, as the engine hands it to the tile. */
export interface FillHandle {
  setLevel(level: number, mode: LevelMode): void
  shown(): number
  /** The level the fill has settled at, or null while it moves. */
  settledAt(): number | null
  setAnchor(right: number, top: number): void
  setImage(image: ImageBitmap | null): void
  remove(): void
}

export interface FillEngine {
  /** Whether this kind of fill is built yet (the others keep the thin bar). */
  supports(kind: PainterKind): boolean
  /** Starts drawing a fill into `canvas`; `onFrame` runs after each frame drawn for it. */
  add(kind: PainterKind, canvas: HTMLCanvasElement, onFrame: () => void): FillHandle
  /** True while the WebGL context is lost: the tiles show the thin bar meanwhile. */
  lost(): boolean
  subscribe(listener: () => void): () => void
  /** While a sheet covers the board, nothing is stepped or drawn (the drift stops too). */
  hold(held: boolean): void
}
```

- [ ] **Step 2: Write the failing palette test**

`src/screens/Today/fills/__tests__/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { WORLDS } from '../../../Journey/worlds'
import { FILL_LOOK, fillOpacity, fillPalette, rgb, textContrastOver, toHex } from '../palette'
import type { PainterKind } from '../painter'

const KINDS = Object.keys(FILL_LOOK) as PainterKind[]

describe('fill palette', () => {
  it('reads and writes hex colours', () => {
    expect(toHex(rgb('#7fb08a'))).toBe('#7fb08a')
  })

  it('gives back the forest greens the fills were chosen in', () => {
    const forest = fillPalette(WORLD_COLORS.forest.dark, 'dark')
    expect(toHex(forest.mid)).toBe('#7fb08a')
    // The water prototype's top (0.55, 0.74, 0.59) and deep (0.2, 0.34, 0.25), give or take.
    forest.top.forEach((v, i) => expect(v).toBeCloseTo([0.55, 0.74, 0.59][i], 1))
    forest.deep.forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.34, 0.25][i], 1))
  })

  for (const mode of ['light', 'dark'] as const) {
    it.each(WORLDS.map((w) => w.id))(`keeps the tile's text at 4.5:1 over every fill in %s (${mode})`, (id) => {
      const palette = fillPalette(WORLD_COLORS[id][mode], mode)
      for (const kind of KINDS) {
        const opacity = fillOpacity(kind, palette)
        expect(textContrastOver(palette, opacity * FILL_LOOK[kind].body)).toBeGreaterThanOrEqual(4.5)
        // Never so faint that the fill disappears.
        expect(opacity).toBeGreaterThanOrEqual(0.3)
      }
    })
  }
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/palette.test.ts`
Expected: FAIL, cannot find module `../palette`.

- [ ] **Step 4: Implement `palette.ts`**

```ts
import { contrastRatio, SURFACE, type WorldPalette } from '../../../lib/worldColors'
import type { PainterKind } from './painter'

export type RGB = readonly [number, number, number]
export type Mode = 'light' | 'dark'

/** The tiles' text colour in each theme (--color-ink). Over a fill the status line uses it too. */
export const TILE_INK: Record<Mode, string> = { light: '#2a211b', dark: '#f6ecdc' }

const WHITE: RGB = [1, 1, 1]
const BLACK: RGB = [0, 0, 0]

export function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function toHex(c: RGB): string {
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** A fill's colours, all from the world's palette. Kept in sRGB: the fill shaders write them as they are. */
export interface FillPalette {
  mode: Mode
  /** Thin bright lines: streaks, the water's surface line, bubbles. */
  light: RGB
  /** The lightest body tone: the top of the water, the ink's pale parts. */
  top: RGB
  /** The world's colour. */
  mid: RGB
  /** The darkest body tone: deep water, the ink's veins. */
  deep: RGB
  /** The world's edge colour: the back of a turning page. */
  edge: RGB
  /** The world's ink: an iris blade's lit edge. */
  ink: RGB
}

/** How far each tone is pushed from the world's colour (to white; to black for deep), per theme. Fitted to the prototypes' forest greens. */
const TONES: Record<Mode, { light: number; top: number; deep: number }> = {
  dark: { light: 0.72, top: 0.15, deep: 0.55 },
  light: { light: 0.8, top: 0.35, deep: 0.25 },
}

export function fillPalette(world: WorldPalette, mode: Mode): FillPalette {
  const base = rgb(world.world)
  const tones = TONES[mode]
  return {
    mode,
    light: mix(base, WHITE, tones.light),
    top: mix(base, WHITE, tones.top),
    mid: base,
    deep: mix(base, BLACK, tones.deep),
    edge: rgb(world.edge),
    ink: rgb(world.ink),
  }
}

/** Each fill as chosen in the prototypes: its opacity, and how opaque its body is under the tile's text. */
export const FILL_LOOK: Record<PainterKind, { opacity: number; body: number }> = {
  wave: { opacity: 0.78, body: 0.78 },
  ink: { opacity: 0.67, body: 1 },
  sprint: { opacity: 0.85, body: 0.62 },
  iris: { opacity: 0.85, body: 1 },
  book: { opacity: 1, body: 0.3 },
}

/** The worst contrast the tile's text gets over a fill whose body covers the tile at `alpha` (the thin bright lines don't count). */
export function textContrastOver(palette: FillPalette, alpha: number): number {
  const surface = rgb(SURFACE[palette.mode])
  return Math.min(
    ...[palette.top, palette.mid, palette.deep].map((tone) => contrastRatio(TILE_INK[palette.mode], toHex(mix(surface, tone, alpha)))),
  )
}

/** A fill's opacity: as chosen, lowered only as far as the tile's text needs to keep 4.5:1. */
export function fillOpacity(kind: PainterKind, palette: FillPalette): number {
  const look = FILL_LOOK[kind]
  let percent = Math.round(look.opacity * 100)
  while (percent > 5 && textContrastOver(palette, (percent / 100) * look.body) < 4.5) percent -= 1
  return percent / 100
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/palette.test.ts`
Expected: PASS (24 world × theme cases). If a world fails the `0.3` floor, don't lower the floor: tell the owner which world and theme, since that fill would be nearly invisible there.

- [ ] **Step 6: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/painter.ts src/screens/Today/fills/palette.ts src/screens/Today/fills/__tests__/palette.test.ts
git commit -m "feat(today): fill palette from the world colours, capped for text contrast"
```

### Task 3: WebGL check, easings and the frame decision

**Files:**
- Create: `src/lib/webgl.ts`, `src/screens/Today/fills/motion.ts`, `src/screens/Today/fills/schedule.ts`
- Modify: `src/screens/Journey/effects/JourneyEffects.tsx` (delete its local `supportsWebGL`, import the shared one)
- Test: `src/screens/Today/fills/__tests__/motion.test.ts`

**Interfaces:**
- Produces: `supportsWebGL(): boolean`; `clamp01`, `smooth`, `cubicOut`, `outQuart`, `inOut` (number → number); `spring(k, z): Spring` with `y`, `set(target, instant)`, `kick(velocity)`, `step(dt): boolean`; `DRIFT_MS`, `frameDecision(needs, driftDue): { draw, again }`.

- [ ] **Step 1: Write the failing tests**

`src/screens/Today/fills/__tests__/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cubicOut, inOut, outQuart, spring } from '../motion'
import { frameDecision } from '../schedule'

describe('easings', () => {
  it('run from 0 to 1 and clamp outside', () => {
    for (const ease of [cubicOut, outQuart, inOut]) {
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
      expect(ease(2)).toBe(1)
      expect(ease(-1)).toBe(0)
    }
  })
})

describe('spring', () => {
  it('swings past its target after a kick, then comes to rest on it', () => {
    const s = spring(25, 0.12)
    s.kick(-40)
    let lowest = 0
    let moving = true
    for (let i = 0; i < 60 * 15 && moving; i++) {
      moving = s.step(1 / 60)
      lowest = Math.min(lowest, s.y)
    }
    expect(lowest).toBeLessThan(-1)
    expect(moving).toBe(false)
    expect(s.y).toBe(0)
  })

  it('jumps to a target set at once', () => {
    const s = spring(60, 0.5)
    s.set(12, true)
    expect(s.y).toBe(12)
    expect(s.step(1 / 60)).toBe(false)
  })
})

describe('frameDecision', () => {
  const still = { moving: false, fading: false, dirty: false, drifting: false }
  it('draws what moves every frame, and drifting fills only when the 30 fps slot is due', () => {
    expect(frameDecision({ ...still, moving: true }, false)).toEqual({ draw: true, again: true })
    expect(frameDecision({ ...still, drifting: true }, false)).toEqual({ draw: false, again: true })
    expect(frameDecision({ ...still, drifting: true }, true)).toEqual({ draw: true, again: true })
    expect(frameDecision({ ...still, dirty: true }, false)).toEqual({ draw: true, again: false })
    expect(frameDecision(still, true)).toEqual({ draw: false, again: false })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/motion.test.ts`
Expected: FAIL, cannot find modules `../motion` and `../schedule`.

- [ ] **Step 3: Implement**

`src/screens/Today/fills/motion.ts`:

```ts
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const cubicOut = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const outQuart = (x: number) => 1 - (1 - clamp01(x)) ** 4
export const inOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export interface Spring {
  readonly y: number
  set(target: number, instant: boolean): void
  kick(velocity: number): void
  /** Advances by `dt` seconds; true while it still moves. */
  step(dt: number): boolean
}

/** A damped spring: `k` sets how fast it moves, `z` how little it overshoots (1 = not at all). */
export function spring(k: number, z: number): Spring {
  let y = 0
  let v = 0
  let to = 0
  return {
    get y() {
      return y
    },
    set(target, instant) {
      to = target
      if (instant) {
        y = target
        v = 0
      }
    },
    kick(velocity) {
      v += velocity
    },
    step(dt) {
      v += (k * (to - y) - 2 * z * Math.sqrt(k) * v) * dt
      y += v * dt
      const moving = Math.abs(to - y) > 0.05 || Math.abs(v) > 0.3
      if (!moving) {
        y = to
        v = 0
      }
      return moving
    },
  }
}
```

`src/screens/Today/fills/schedule.ts`:

```ts
/** Idle drift (the ink, the waves, the flow) is drawn at 30 frames a second; anything moving, every frame. */
export const DRIFT_MS = 1000 / 30

export interface FrameNeeds {
  moving: boolean
  fading: boolean
  dirty: boolean
  drifting: boolean
}

/** Whether a tile's fill is drawn this frame, and whether the loop must go on for it. */
export function frameDecision(needs: FrameNeeds, driftDue: boolean): { draw: boolean; again: boolean } {
  return {
    draw: needs.moving || needs.fading || needs.dirty || (needs.drifting && driftDue),
    again: needs.moving || needs.fading || needs.drifting,
  }
}
```

`src/lib/webgl.ts`:

```ts
let supported: boolean | undefined

/** Whether this browser can draw with WebGL. Asked once; the test context is given back at once (phones allow only a few). */
export function supportsWebGL(): boolean {
  if (supported !== undefined) return supported
  // jsdom (tests) has no WebGL at all; asking it for a context prints an error.
  if (typeof WebGLRenderingContext === 'undefined') return (supported = false)
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    supported = gl !== null
  } catch {
    supported = false
  }
  return supported
}
```

In `src/screens/Journey/effects/JourneyEffects.tsx`, delete the local `function supportsWebGL()` (and its comment), and add `import { supportsWebGL } from '../../../lib/webgl'`. `useState(supportsWebGL)` stays as it is.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/motion.test.ts src/screens/Journey`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/lib/webgl.ts src/screens/Today/fills/motion.ts src/screens/Today/fills/schedule.ts src/screens/Today/fills/__tests__/motion.test.ts src/screens/Journey/effects/JourneyEffects.tsx
git commit -m "feat(today): shared WebGL check, fill easings and the frame decision"
```

### Task 4: Water's painter

**Files:**
- Create: `src/screens/Today/fills/quad.ts`, `src/screens/Today/fills/wave.ts`, `src/screens/Today/fills/painters.ts`
- Test: `src/screens/Today/fills/__tests__/wave.test.ts`

**Interfaces:**
- Consumes: `Painter` (Task 2), `FillPalette` (Task 2), `cubicOut`, `clamp01`, `spring` (Task 3).
- Produces: `shaderQuad(fragmentShader, uniforms)` → `{ scene, camera, fit(width, height), dispose() }`; `createWave(palette): Painter`; `waveSurfaceY(level, height): number`; `PAINTERS: Partial<Record<PainterKind, (palette: FillPalette) => Painter>>`.

- [ ] **Step 1: Write the failing test**

`src/screens/Today/fills/__tests__/wave.test.ts` (three.js objects can be built without WebGL; only `render` needs it):

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { fillPalette } from '../palette'
import { createWave, waveSurfaceY } from '../wave'

describe('water fill', () => {
  it('hides the surface, waves and all, under an empty tile and lifts it past the top when full', () => {
    expect(waveSurfaceY(0, 120) + 8.5).toBeLessThan(-60)
    expect(waveSurfaceY(1, 120) - 2 * 8.5).toBeGreaterThan(60)
  })

  it('rises to its level in the chosen 2.4 s, then has settled', () => {
    const wave = createWave(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    wave.setLevel(0.5, false)
    expect(wave.settled()).toBe(false)
    for (let i = 0; i < 60; i++) wave.step(1 / 60, true)
    expect(wave.shown()).toBeGreaterThan(0.2)
    expect(wave.shown()).toBeLessThan(0.5)
    for (let i = 0; i < 60 * 2; i++) wave.step(1 / 60, true)
    expect(wave.shown()).toBeCloseTo(0.5)
    expect(wave.settled()).toBe(true)
    expect(wave.drifts()).toBe(true)
    wave.dispose()
  })

  it('jumps to a level set at once', () => {
    const wave = createWave(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    wave.setLevel(1, true)
    expect(wave.shown()).toBe(1)
    expect(wave.settled()).toBe(true)
    wave.dispose()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/wave.test.ts`
Expected: FAIL, cannot find module `../wave`.

- [ ] **Step 3: Implement**

`src/screens/Today/fills/quad.ts`:

```ts
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, type IUniform } from 'three'

/** Hands each fragment its position in CSS px from the tile's centre, y up. */
export const QUAD_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vP = world.xy;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

/** A tile-sized quad drawn by one fragment shader, and the camera that maps it 1:1 onto CSS px. */
export function shaderQuad(fragmentShader: string, uniforms: Record<string, IUniform>) {
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexShader: QUAD_VERT, fragmentShader, uniforms })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  const scene = new Scene()
  scene.add(mesh)
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1)
  return {
    scene,
    camera,
    /** Sizes the quad and the camera to the tile. */
    fit(width: number, height: number) {
      mesh.scale.set(width, height, 1)
      camera.left = -width / 2
      camera.right = width / 2
      camera.top = height / 2
      camera.bottom = -height / 2
      camera.updateProjectionMatrix()
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}
```

`src/screens/Today/fills/wave.ts` (the shader is `WAVE_FRAG` from `docs/prototypes/water-tile.html`, with the green constants turned into palette uniforms):

```ts
import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { clamp01, cubicOut, spring } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Water). */
const P = { rise: 2.4, amp: 8.5, slosh: 0.69, bubbles: 0.82, shimmer: 0.28, back: 0.66 }

/** The surface's height, px from the tile's centre (y up), for a share of the goal: just under the tile when empty, past its top (waves and all) when full. */
export function waveSurfaceY(level: number, height: number): number {
  return -height / 2 - P.amp - 3 + level * (height + 3 * P.amp + 19)
}

const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uLevel, uTime, uAmp, uSlosh, uRipA, uRipT, uRipX, uBub, uFizz, uShine, uBack;
  uniform vec3 uLight, uTop, uMid, uDeep;
  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float waves(float x, float ph) { return uAmp * (0.6 * sin(x * 0.035 + uTime * 1.6 + ph) + 0.4 * sin(x * 0.071 - uTime * 2.3 + ph * 1.7)); }
  float caustic(vec2 p) {
    vec2 q = p * vec2(0.045, 0.06);
    float c = sin(q.x + sin(q.y + uTime * 0.9) * 1.6 + uTime * 0.7) * sin(q.y - uTime * 0.6 + sin(q.x * 0.8 - uTime * 0.5) * 1.3);
    return pow(1.0 - abs(c), 10.0);
  }
  float surf(float x, float ph) {
    float d = abs(x - uRipX) - 170.0 * uRipT;
    return uLevel + waves(x, ph) + uSlosh * x / (uSize.x * 0.5) + uRipA * sin(d * 0.09) * exp(-d * d / 1800.0);
  }
  void main() {
    float x = vP.x, y = vP.y, s = surf(x, 0.0), sb = surf(x, 2.1) + 2.0 + uAmp * 0.5, depth = s - y;
    float front = smoothstep(s + 0.8, s - 0.8, y);
    float back = smoothstep(sb + 0.8, sb - 0.8, y) * (1.0 - front) * uBack;
    float bub = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i), per = 2.4 + 2.0 * hash(fi), ph = uTime / per + hash(fi + 3.3), cyc = floor(ph), a = fract(ph);
      float bx = (hash(fi * 1.7 + cyc * 3.1) - 0.5) * uSize.x * 0.92 + sin(a * 11.0 + fi) * 3.0;
      float by = -uSize.y * 0.5 + a * (uLevel + uSize.y * 0.5 + 8.0), r = 1.2 + 2.2 * hash(fi + 9.1), dd = length(vec2(x - bx, y - by));
      bub += (smoothstep(1.0, 0.0, abs(dd - r)) * 0.8 + smoothstep(r, 0.0, dd) * 0.15) * step(by + r, surf(bx, 0.0));
    }
    float hl = (exp(-depth * depth / 3.0) + caustic(vP) * uShine * exp(-max(depth, 0.0) / 70.0) + bub * uBub * (0.35 + uFizz)) * front;
    vec3 body = mix(uTop, uDeep, smoothstep(0.0, uSize.y, depth));
    float a = front * 0.78 + back * 0.35;
    vec3 c = (body * front * 0.78 + mix(uMid, uDeep, 0.3) * back * 0.35) / max(a, 0.001);
    gl_FragColor = vec4(mix(c, uLight, clamp(hl, 0.0, 1.0)), clamp(a + hl * 0.4, 0.0, 1.0));
  }
`

/** Water: the level rises with a rolling surface; each pour sloshes, sends a ripple out from the "+ 250 ml" chip and stirs the bubbles. */
export function createWave(palette: FillPalette): Painter {
  const u = {
    uSize: { value: new Vector2() },
    uLevel: { value: 0 },
    uTime: { value: 0 },
    uAmp: { value: P.amp },
    uSlosh: { value: 0 },
    uRipA: { value: 0 },
    uRipT: { value: 9 },
    uRipX: { value: 0 },
    uBub: { value: P.bubbles },
    uFizz: { value: 0 },
    uShine: { value: P.shimmer },
    uBack: { value: 0 },
    uLight: { value: new Vector3() },
    uTop: { value: new Vector3() },
    uMid: { value: new Vector3() },
    uDeep: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  const slosh = spring(25, 0.12)
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let ripT = 9
  let fizz = 0
  let ripRight = 40
  const shown = () => from + (to - from) * cubicOut(t)

  const painter: Painter = {
    setLevel(level, instant) {
      const up = level > to
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) slosh.set(0, true)
      else if (up) {
        slosh.kick(-P.slosh * 60)
        ripT = 0
        fizz = 1
      }
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / P.rise)
      if (drift) time += dt
      ripT += dt
      fizz *= Math.exp(-dt / 1.2)
      const sloshing = slosh.step(dt)
      return t < 1 || sloshing || ripT < 3
    },
    drifts: () => to > 0,
    shown,
    settled: () => Math.abs(to - shown()) < 0.005,
    setAnchor(right) {
      ripRight = right
    },
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const y = waveSurfaceY(shown(), height)
      u.uSize.value.set(width, height)
      u.uLevel.value = y
      u.uTime.value = time
      u.uSlosh.value = slosh.y
      u.uRipA.value = P.slosh * 5 * Math.exp(-ripT / 0.9)
      u.uRipT.value = ripT
      u.uRipX.value = width / 2 - ripRight
      u.uFizz.value = fizz
      // The back wave rides higher than the front one: it fades in over the first 12 px of rise so it never peeks out of an empty tile.
      u.uBack.value = P.back * clamp01((y - waveSurfaceY(0, height)) / 12)
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p) {
      u.uLight.value.set(...p.light)
      u.uTop.value.set(...p.top)
      u.uMid.value.set(...p.mid)
      u.uDeep.value.set(...p.deep)
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
```

`src/screens/Today/fills/painters.ts`:

```ts
import type { FillPalette } from './palette'
import type { Painter, PainterKind } from './painter'
import { createWave } from './wave'

/** The fills built so far; a task whose kind isn't here keeps the thin bar. */
export const PAINTERS: Partial<Record<PainterKind, (palette: FillPalette) => Painter>> = {
  wave: createWave,
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/wave.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/quad.ts src/screens/Today/fills/wave.ts src/screens/Today/fills/painters.ts src/screens/Today/fills/__tests__/wave.test.ts
git commit -m "feat(today): the water fill, ported from the chosen prototype"
```

### Task 5: the engine

**Files:**
- Create: `src/screens/Today/fills/engine.ts`, `src/screens/Today/fills/useFillEngine.ts`

**Interfaces:**
- Consumes: `FillEngine`, `FillHandle`, `LevelMode`, `Painter`, `PainterKind` (Task 2); `fillOpacity`, `fillPalette`, `Mode` (Task 2); `PAINTERS` (Task 4); `DRIFT_MS`, `frameDecision` (Task 3); `supportsWebGL` (Task 3); `isWorldId`, `WORLD_COLORS` (`src/lib/worldColors.ts`).
- Produces: `createEngine(): FillEngine`, `sharedEngine(): FillEngine` (engine.ts, lazy chunk); `FillEngineContext`, `useFillEngine(): FillEngine | null`, `useBoardFills(): FillEngine | null` (useFillEngine.ts).

The engine needs a real GPU, so it has no unit test: its pure decision is tested in Task 3, and it is checked in the browser in Task 11.

- [ ] **Step 1: Implement `engine.ts`**

```ts
import { WebGLRenderer } from 'three'
import { isWorldId, WORLD_COLORS } from '../../../lib/worldColors'
import { fillOpacity, fillPalette, type FillPalette, type Mode } from './palette'
import type { FillEngine, FillHandle, LevelMode, Painter, PainterKind } from './painter'
import { PAINTERS } from './painters'
import { DRIFT_MS, frameDecision } from './schedule'

/** Reduce motion's crossfade to a new level. */
const FADE_S = 0.25

interface Entry {
  kind: PainterKind
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  painter: Painter
  level: number
  visible: boolean
  dirty: boolean
  /** The last frame before a crossfade, drawn under the new one as it fades in. */
  prev: HTMLCanvasElement | null
  fade: number
  onFrame: () => void
}

/** The world and theme on <html> (data-world, the .dark class), as fill colours. */
function currentPalette(): FillPalette {
  const root = document.documentElement
  const world = root.dataset.world
  const mode: Mode = root.classList.contains('dark') ? 'dark' : 'light'
  return fillPalette(WORLD_COLORS[isWorldId(world) ? world : 'hell'][mode], mode)
}

/**
 * One three.js renderer for every tile on the board. It draws each tile's fill on a hidden canvas, at the tile's
 * current size, and copies it into the tile's own 2D canvas: one WebGL context however many tiles there are, and a
 * tile that resizes or shrinks into its chip is simply drawn at its new size. The loop runs only while a fill moves,
 * fades or drifts (drift at 30 frames a second), and skips tiles that are off screen.
 */
export function createEngine(): FillEngine {
  const glCanvas = document.createElement('canvas')
  const renderer = new WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setScissorTest(true)

  const entries = new Map<HTMLCanvasElement, Entry>()
  const listeners = new Set<() => void>()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let palette = currentPalette()
  let lost = false
  let held = false
  let bufferWidth = 0
  let bufferHeight = 0
  let raf = 0
  let last = 0
  let lastDrift = 0

  const notify = () => listeners.forEach((listener) => listener())
  const kick = () => {
    if (raf || lost || held || entries.size === 0) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function makePainter(kind: PainterKind): Painter {
    const make = PAINTERS[kind]
    if (!make) throw new Error(`No fill for ${kind}`)
    return make(palette)
  }

  // A tile scrolled out of sight is neither stepped nor drawn: its animation waits until it's seen.
  const seen = new IntersectionObserver((records) => {
    for (const record of records) {
      const entry = entries.get(record.target as HTMLCanvasElement)
      if (!entry) continue
      entry.visible = record.isIntersecting
      if (entry.visible) {
        entry.dirty = true
        kick()
      }
    }
  })

  // A new world or theme recolours every fill.
  new MutationObserver(() => {
    palette = currentPalette()
    for (const entry of entries.values()) {
      entry.painter.setPalette(palette)
      entry.canvas.style.opacity = String(fillOpacity(entry.kind, palette))
      entry.dirty = true
    }
    kick()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-world'] })

  glCanvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
    raf = 0
    notify()
  })
  // Everything on the GPU went with the context: every fill is made again, at its level.
  glCanvas.addEventListener('webglcontextrestored', () => {
    lost = false
    for (const entry of entries.values()) {
      entry.painter.dispose()
      entry.painter = makePainter(entry.kind)
      entry.painter.setLevel(entry.level, true)
      entry.dirty = true
    }
    notify()
    kick()
  })

  function draw(entry: Entry, width: number, height: number) {
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (entry.canvas.width !== pw || entry.canvas.height !== ph) {
      entry.canvas.width = pw
      entry.canvas.height = ph
    }
    if (width > bufferWidth || height > bufferHeight) {
      bufferWidth = Math.max(bufferWidth, width)
      bufferHeight = Math.max(bufferHeight, height)
      renderer.setSize(bufferWidth, bufferHeight, false)
    }
    renderer.setViewport(0, 0, width, height)
    renderer.setScissor(0, 0, width, height)
    entry.painter.render(renderer, width, height)
    // The viewport sits at the bottom left of the GL canvas; images count their rows from the top.
    const sourceY = glCanvas.height - ph
    const ctx = entry.ctx
    ctx.clearRect(0, 0, pw, ph)
    if (entry.prev) {
      ctx.globalAlpha = 1 - entry.fade
      ctx.drawImage(entry.prev, 0, 0, pw, ph)
      ctx.globalAlpha = entry.fade
    }
    ctx.drawImage(glCanvas, 0, sourceY, pw, ph, 0, 0, pw, ph)
    ctx.globalAlpha = 1
  }

  function frame(now: number) {
    raf = 0
    if (lost || held) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    const drift = !motionQuery.matches
    const driftDue = now - lastDrift >= DRIFT_MS
    if (driftDue) lastDrift = now
    let again = false
    for (const entry of entries.values()) {
      if (!entry.visible) continue
      const width = entry.canvas.clientWidth
      const height = entry.canvas.clientHeight
      if (!width || !height) continue
      const moving = entry.painter.step(dt, drift)
      if (entry.prev) entry.fade = Math.min(1, entry.fade + dt / FADE_S)
      const decision = frameDecision(
        { moving, fading: entry.prev !== null, dirty: entry.dirty, drifting: drift && entry.painter.drifts() },
        driftDue,
      )
      if (decision.draw) {
        draw(entry, width, height)
        entry.dirty = false
        if (entry.prev && entry.fade >= 1) entry.prev = null
        entry.onFrame()
      }
      if (decision.again) again = true
    }
    if (again) raf = requestAnimationFrame(frame)
  }

  return {
    supports: (kind) => PAINTERS[kind] !== undefined,
    lost: () => lost,
    hold(value) {
      held = value
      if (held) {
        cancelAnimationFrame(raf)
        raf = 0
      } else kick()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    add(kind, canvas, onFrame): FillHandle {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('This browser has no 2D canvas')
      const entry: Entry = { kind, canvas, ctx, painter: makePainter(kind), level: 0, visible: true, dirty: true, prev: null, fade: 1, onFrame }
      canvas.style.opacity = String(fillOpacity(kind, palette))
      entries.set(canvas, entry)
      seen.observe(canvas)
      kick()
      return {
        setLevel(level: number, mode: LevelMode) {
          if (level === entry.level && mode !== 'instant') return
          entry.level = level
          if (mode === 'fade' && canvas.width && canvas.height) {
            const prev = document.createElement('canvas')
            prev.width = canvas.width
            prev.height = canvas.height
            prev.getContext('2d')?.drawImage(canvas, 0, 0)
            entry.prev = prev
            entry.fade = 0
          }
          entry.painter.setLevel(level, mode !== 'animate')
          entry.dirty = true
          kick()
        },
        shown: () => entry.painter.shown(),
        settledAt: () => (entry.painter.settled() && !entry.prev ? entry.level : null),
        setAnchor(right, top) {
          entry.painter.setAnchor?.(right, top)
        },
        setImage(image) {
          entry.painter.setImage?.(image)
          entry.dirty = true
          kick()
        },
        remove() {
          seen.unobserve(canvas)
          entries.delete(canvas)
          entry.painter.dispose()
        },
      }
    },
  }
}

let shared: FillEngine | undefined

/** The app's one fill engine (one WebGL context), made on first use. */
export function sharedEngine(): FillEngine {
  shared ??= createEngine()
  return shared
}
```

- [ ] **Step 2: Implement `useFillEngine.ts`**

```ts
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { supportsWebGL } from '../../../lib/webgl'
import type { FillEngine } from './painter'

export const FillEngineContext = createContext<FillEngine | null>(null)

const noSubscription = () => () => {}

/**
 * Loads the board's fill engine; three.js comes with it, in its own chunk, after Today's first paint.
 * Null without WebGL, while it loads and while its context is lost: the tiles keep the thin bar meanwhile.
 */
export function useFillEngine(): FillEngine | null {
  const [engine, setEngine] = useState<FillEngine | null>(null)
  useEffect(() => {
    if (!supportsWebGL()) return
    let alive = true
    import('./engine')
      .then(({ sharedEngine }) => {
        if (alive) setEngine(sharedEngine())
      })
      // The fills are decoration: if three.js can't load or start, the tiles keep the thin bar.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const lost = useSyncExternalStore(engine?.subscribe ?? noSubscription, () => engine?.lost() ?? false)
  return engine && !lost ? engine : null
}

/** The engine the board above provides (null: no fills, the thin bar). */
export const useBoardFills = () => useContext(FillEngineContext)
```

- [ ] **Step 3: Check types and the chunk split**

Run: `npx tsc -b && npm run build`
Expected: no errors. Then check that three.js stays out of the main chunk:

Run: `grep -l "WebGLRenderer" dist/assets/*.js`
Expected: only lazy chunks (the Journey's and the engine's, or a shared `three` chunk). The `index-*.js` entry chunk must not be listed.

- [ ] **Step 4: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/engine.ts src/screens/Today/fills/useFillEngine.ts
git commit -m "feat(today): one shared WebGL engine for the tile fills, loaded lazily"
```

### Task 6: `TileFill` and `TaskTile`

**Files:**
- Create: `src/screens/Today/fills/TileFill.tsx`, `src/screens/Today/TaskTile.tsx`
- Modify: `src/screens/Today/TaskBoard.tsx` (use `TaskTile`; delete the old local `TaskTile`, `TaskTileProps`, `spoken` and the `QuickAction` interface; re-export `QuickAction` from `TaskTile`)
- Test: `src/screens/Today/__tests__/TaskTile.test.tsx`, and a shared stand-in engine `src/screens/Today/__tests__/fakeFillEngine.ts` (not a test file itself; Task 8 uses it too)

**Interfaces:**
- Consumes: `useBoardFills`, `FillEngineContext` (Task 5); `TASK_PAINTER`, `FillHandle`, `PainterKind`, `FillEngine` (Task 2); `taskFill`, `countedData` (Task 1).
- Produces (tests): `FakeHandle` (a `FillHandle` with `level`, `moving`, `show(level)`, `finish()`) and `fakeEngine(handles: FakeHandle[]): FillEngine` (only `'wave'` is supported).
- Produces: `TileFill` props `{ kind, level, steps?, image?, onShown?, onSettledAt }`; `TaskTile` props `{ task, data, rules, complete, bookTitle?, urgency, quick?, controls?, image?, morphing?, onSettledAt, onOpen }`; `QuickAction`; `spoken(status)`. Tile markers used by Task 8: `[data-fill-icon]`, `[data-fill-title]`, `[data-fill-anchor]`.

- [ ] **Step 1: Write the stand-in engine and the failing tests**

`src/screens/Today/__tests__/fakeFillEngine.ts`:

```ts
import type { FillEngine, FillHandle, LevelMode, PainterKind } from '../fills/painter'

export interface FakeHandle extends FillHandle {
  level: number
  moving: boolean
  /** Shows a level part-way, as a moving fill would. */
  show(level: number): void
  /** Ends the fill's animation at its level. */
  finish(): void
}

/** A stand-in engine (jsdom has no WebGL): only Water has a fill, and its fills move only when the test says so. */
export function fakeEngine(handles: FakeHandle[]): FillEngine {
  return {
    supports: (kind: PainterKind) => kind === 'wave',
    lost: () => false,
    subscribe: () => () => {},
    hold() {},
    add(_kind, _canvas, onFrame) {
      let shown = 0
      const handle: FakeHandle = {
        level: 0,
        moving: false,
        setLevel(level: number, mode: LevelMode) {
          handle.level = level
          handle.moving = mode === 'animate'
          if (!handle.moving) shown = level
          onFrame()
        },
        shown: () => shown,
        settledAt: () => (handle.moving ? null : handle.level),
        setAnchor() {},
        setImage() {},
        remove() {},
        show(level) {
          shown = level
          onFrame()
        },
        finish() {
          handle.moving = false
          shown = handle.level
          onFrame()
        },
      }
      handles.push(handle)
      return handle
    },
  }
}
```

`src/screens/Today/__tests__/TaskTile.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RULESETS } from '../../../logic/rulesets'
import type { DayTaskData } from '../../../logic/types'
import type { FillEngine } from '../fills/painter'
import { FillEngineContext } from '../fills/useFillEngine'
import { TaskTile } from '../TaskTile'
import { fakeEngine, type FakeHandle } from './fakeFillEngine'

const empty: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

describe('TaskTile', () => {
  let handles: FakeHandle[]
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  beforeEach(() => {
    handles = []
  })

  const tile = (data: DayTaskData, engine: FillEngine | null) => (
    <FillEngineContext.Provider value={engine}>
      <TaskTile task="water" data={data} rules={RULESETS.hard} complete={false} urgency="none" onSettledAt={() => {}} onOpen={() => {}} />
    </FillEngineContext.Provider>
  )

  it('keeps the thin bar when there is no fill', () => {
    render(tile({ ...empty, water_ml: 1900 }, null))
    expect(screen.getByTestId('progress')).toHaveStyle({ width: '50%' })
  })

  it('counts the water up with its fill, then tells the day as it is', () => {
    const engine = fakeEngine(handles)
    const { rerender } = render(tile({ ...empty, water_ml: 1000 }, engine))
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 3.8 L')).toBeInTheDocument()

    rerender(tile({ ...empty, water_ml: 2000 }, engine))
    // The fill still shows a litre: so does the line.
    expect(screen.getByText('1 / 3.8 L')).toBeInTheDocument()
    act(() => handles[0].show(0.4))
    expect(screen.getByText('1.5 / 3.8 L')).toBeInTheDocument()
    act(() => handles[0].finish())
    expect(screen.getByText('2 / 3.8 L')).toBeInTheDocument()
  })

  it('writes the status in the ink colour over a fill', () => {
    render(tile({ ...empty, water_ml: 1000 }, fakeEngine(handles)))
    expect(screen.getByText('1 / 3.8 L')).toHaveClass('text-ink')
    expect(screen.getByText('1 / 3.8 L')).not.toHaveClass('text-ink-muted')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/screens/Today/__tests__/TaskTile.test.tsx`
Expected: FAIL, cannot find module `../TaskTile`.

- [ ] **Step 3: Implement `TileFill.tsx`**

```tsx
import { useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { FillHandle, PainterKind } from './painter'
import { useBoardFills } from './useFillEngine'

interface TileFillProps {
  kind: PainterKind
  /** 0–1: taskFill. */
  level: number
  /** How finely the status counts up (76 steps of 50 ml for 3.8 L, 10 pages); none for tiles that don't count. */
  steps?: number
  /** The day's photo, for the iris. */
  image?: Blob
  onShown?: (level: number) => void
  /** The level the fill has settled at, or null while it moves. */
  onSettledAt: (level: number | null) => void
}

/** A tile's fill: a canvas under the tile's content, drawn by the board's engine. */
export function TileFill({ kind, level, steps, image, onShown, onSettledAt }: TileFillProps) {
  const engine = useBoardFills()
  const reduce = useReducedMotion() ?? false
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<FillHandle | null>(null)
  const levelRef = useRef(level)
  const reported = useRef<{ shown: number | null; settled: number | null | undefined }>({ shown: null, settled: undefined })

  const report = useEffectEvent(() => {
    const handle = handleRef.current
    if (!handle) return
    if (steps && onShown) {
      const shown = Math.round(handle.shown() * steps) / steps
      if (shown !== reported.current.shown) {
        reported.current.shown = shown
        onShown(shown)
      }
    }
    const settled = handle.settledAt()
    if (settled !== reported.current.settled) {
      reported.current.settled = settled
      onSettledAt(settled)
    }
  })

  useLayoutEffect(() => {
    levelRef.current = level
  })

  // Made once per engine and kind, straight at the day's level: only changes animate.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!engine || !canvas) return
    const handle = engine.add(kind, canvas, () => report())
    handleRef.current = handle
    handle.setLevel(levelRef.current, 'instant')
    return () => {
      handle.remove()
      handleRef.current = null
    }
  }, [engine, kind])

  useLayoutEffect(() => {
    handleRef.current?.setLevel(level, reduce ? 'fade' : 'animate')
  }, [level, reduce])

  // The control the fill starts from (the chip, the switches), measured from the tile's right edge.
  useLayoutEffect(() => {
    const handle = handleRef.current
    const tile = canvasRef.current?.parentElement
    const anchor = tile?.querySelector<HTMLElement>('[data-fill-anchor]')
    if (!handle || !tile || !anchor) return
    const t = tile.getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    handle.setAnchor(t.right - (a.left + a.width / 2), a.top + a.height / 2 - t.top)
  })

  useEffect(() => {
    const handle = handleRef.current
    if (!handle || !image) return
    let alive = true
    let bitmap: ImageBitmap | undefined
    createImageBitmap(image, { imageOrientation: 'flipY' })
      .then((b) => {
        if (!alive) return b.close()
        bitmap = b
        handle.setImage(b)
      })
      .catch(() => {})
    return () => {
      alive = false
      handle.setImage(null)
      bitmap?.close()
    }
  }, [image, engine])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}
```

- [ ] **Step 4: Implement `TaskTile.tsx`**

Move the tile out of `TaskBoard.tsx` and give it its fill:

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'
import { countedData, TASK_TITLES, taskFill, taskProgress, taskStatusLine } from '../../content/taskStatus'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { TASK_PAINTER } from './fills/painter'
import { TileFill } from './fills/TileFill'
import { useBoardFills } from './fills/useFillEngine'
import { TASK_ICONS, TASK_TONE } from './taskTones'

/** A one-tap shortcut on a tile, next to opening its sheet ("+250 ml", the camera). */
export interface QuickAction {
  /** Announced to screen readers ("Add 250 ml"). */
  label: string
  icon: IconName
  /** Shown next to the icon; none for an icon-only button. */
  text?: string
  onPress: () => void
}

/** A status line for VoiceOver: "0 of 2 · 45 min each" reads as "0 of 2, 45 min each". */
export function spoken(status: string): string {
  return status.replaceAll(' · ', ', ')
}

/** How finely a tile's status counts up with its fill: water in 50 ml, pages one by one. */
function countSteps(task: TaskId, rules: Ruleset): number | undefined {
  if (task === 'water') return Math.round(rules.waterTargetMl / 50)
  if (task === 'reading') return rules.pagesTarget
  return undefined
}

interface TaskTileProps {
  task: TaskId
  data: DayTaskData
  rules: Ruleset
  complete: boolean
  bookTitle?: string
  /** Late in the evening: 'late' when it no longer fits before midnight (a red edge), 'open' otherwise (a stronger edge). */
  urgency: 'none' | 'open' | 'late'
  quick?: QuickAction
  /** Controls on the tile's right (the diet switches). */
  controls?: ReactNode
  /** The day's photo, for the iris. */
  image?: Blob
  /** Shrinking into its chip: the tile follows its box down to chip size. */
  morphing?: boolean
  onSettledAt: (level: number | null) => void
  onOpen: () => void
}

/** An open task: a tile that fills as the task progresses, opening its sheet on tap. */
export function TaskTile({ task, data, rules, complete, bookTitle, urgency, quick, controls, image, morphing = false, onSettledAt, onOpen }: TaskTileProps) {
  const engine = useBoardFills()
  const kind = TASK_PAINTER[task]
  const hasFill = engine?.supports(kind) ?? false
  const level = taskFill(task, data, rules)
  const [shown, setShown] = useState<number | null>(null)
  const [settledAt, setSettledAt] = useState<number | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])

  // While the fill moves, water and pages count up with it; at rest the line tells the day as it is.
  const counting = hasFill && shown !== null && settledAt === null
  const status = taskStatusLine(task, counting ? countedData(task, data, rules, shown) : data, rules, complete && !counting, bookTitle)
  const progress = taskProgress(task, data, rules)
  // Over a fill the muted grey would drop under 4.5:1: the line takes the ink colour.
  const statusColor = urgency !== 'none' ? 'font-bold text-ink' : hasFill && level > 0 ? 'text-ink' : 'text-ink-muted'
  const edge = urgency === 'late' ? 'ring-2 ring-danger-ink' : urgency === 'open' ? 'ring-2 ring-ink/30' : 'ring-1 ring-ink/10 dark:ring-0'
  const statusClass = `mt-0.5 text-xs font-semibold leading-tight ${statusColor}`

  return (
    <div className={`relative overflow-hidden rounded-card bg-surface ${morphing ? 'h-full' : 'min-h-[7.5rem]'} ${edge}`}>
      {hasFill && (
        <TileFill
          kind={kind}
          level={level}
          steps={countSteps(task, rules)}
          image={image}
          onShown={setShown}
          onSettledAt={(at) => {
            setSettledAt(at)
            onSettledAt(at)
          }}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${TASK_TITLES[task]}, ${spoken(taskStatusLine(task, data, rules, complete, bookTitle))}`}
        className={`relative flex min-h-[7.5rem] w-full flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${hasFill ? '[text-shadow:0_1px_3px_var(--color-canvas)]' : ''}`}
      >
        <span data-fill-icon className={`flex h-9 w-9 items-center justify-center rounded-xl [text-shadow:none] ${TASK_TONE.tint} ${TASK_TONE.ink}`}>
          <Icon name={TASK_ICONS[task]} size={20} />
        </span>
        <span data-fill-title className="mt-auto pt-3 font-rounded font-bold leading-tight text-ink">
          {TASK_TITLES[task]}
        </span>
        {/* A change slides in; a count-up just ticks. */}
        {counting ? (
          <span className={statusClass}>{status}</span>
        ) : (
          <motion.span
            key={status}
            initial={mounted.current ? { opacity: 0.2, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className={statusClass}
          >
            {status}
          </motion.span>
        )}
      </button>
      {controls}
      {/* A full 48 px touch target around a small chip, so the shortcut never outshines the tile's title. A shortcut no longer needed shrinks away. */}
      <AnimatePresence initial={false}>
        {quick && (
          <motion.button
            key="quick"
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            type="button"
            aria-label={quick.label}
            onClick={quick.onPress}
            className="group absolute top-1 right-1 flex min-h-touch min-w-touch touch-manipulation items-center justify-center rounded-full font-rounded text-xs font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span data-fill-anchor className="flex h-8 items-center gap-1 rounded-full border border-ink/15 bg-surface px-2.5 motion-safe:transition-transform motion-safe:group-active:scale-90">
              <Icon name={quick.icon} size={14} />
              {quick.text}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      {!hasFill && progress !== null && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-black/5 dark:bg-white/10">
          <span
            data-testid="progress"
            className={`block h-full ${TASK_TONE.bar} motion-safe:transition-[width]`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </div>
  )
}
```

The quick chip gets `bg-surface` so it stays readable over a fill; nothing else about it changes.

- [ ] **Step 5: Use it in `TaskBoard.tsx`**

Delete the local `QuickAction`, `spoken`, `TaskTileProps` and `TaskTile` (lines 15–23, 48–51 and 125–182 of the current file). Add `import { spoken, TaskTile, type QuickAction } from './TaskTile'` and `export type { QuickAction } from './TaskTile'` (DayBoard imports it from here). Replace the `<TaskTile …/>` element with:

```tsx
<TaskTile
  task={task}
  data={data}
  rules={rules}
  complete={completion[task]}
  bookTitle={bookTitle}
  urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
  quick={quickActions?.[task]}
  controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
  image={task === 'photo' ? photo : undefined}
  onSettledAt={() => {}}
  onOpen={() => onOpen(task)}
/>
```

Remove `taskProgress` from TaskBoard's imports. Wrap the board's `<section>` in `<FillEngineContext.Provider value={useFillEngine()}>`: call `const engine = useFillEngine()` at the top of `TaskBoard` and pass `engine`. Task 8 replaces this file anyway; this step only keeps it working.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run src/screens/Today`
Expected: PASS, the new TaskTile tests and every existing TaskBoard and TodayScreen test (jsdom has no WebGL, so the board still shows thin bars and chips at once).

- [ ] **Step 7: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/TileFill.tsx src/screens/Today/TaskTile.tsx src/screens/Today/TaskBoard.tsx src/screens/Today/__tests__/TaskTile.test.tsx src/screens/Today/__tests__/fakeFillEngine.ts
git commit -m "feat(today): tiles carry their fill, count up with it and keep the text readable"
```

### Task 7: the board's phases

**Files:**
- Create: `src/screens/Today/fills/boardPhases.ts`
- Test: `src/screens/Today/fills/__tests__/boardPhases.test.ts`

**Interfaces:**
- Produces: `Phase`, `Phases`, `Completion`, `PhaseEvent`, `initialPhases(completion)`, `phasesReducer(state, event)`, `landedCount(phases)`, `settling(phases, completion)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { initialPhases, landedCount, phasesReducer, settling, type Completion } from '../boardPhases'

const none: Completion = { workouts: false, diet: false, water: false, reading: false, photo: false }
const waterDone: Completion = { ...none, water: true }

describe('board phases', () => {
  it('opens with done tasks as chips already', () => {
    expect(initialPhases(waterDone).water).toBe('chip')
    expect(initialPhases(waterDone).diet).toBe('tile')
  })

  it('without animation, a task that gets done is a chip at once', () => {
    const state = phasesReducer(initialPhases(none), { type: 'sync', completion: waterDone, animate: false })
    expect(state.water).toBe('chip')
  })

  it('with animation, a done task stays a tile until its fill is full, glows, then shrinks into its chip', () => {
    let state = phasesReducer(initialPhases(none), { type: 'sync', completion: waterDone, animate: true })
    expect(state.water).toBe('tile')
    state = phasesReducer(state, { type: 'full', task: 'water' })
    expect(state.water).toBe('full')
    state = phasesReducer(state, { type: 'morph', task: 'water' })
    expect(state.water).toBe('morphing')
    expect(settling(state, waterDone)).toBe(true)
    expect(landedCount(state)).toBe(0)
    state = phasesReducer(state, { type: 'landed', task: 'water' })
    expect(state.water).toBe('chip')
    expect(settling(state, waterDone)).toBe(false)
    expect(landedCount(state)).toBe(1)
  })

  it('turns any phase back into a tile when the task is undone', () => {
    for (const phase of ['full', 'morphing', 'chip'] as const) {
      const state = phasesReducer({ ...initialPhases(none), water: phase }, { type: 'sync', completion: none, animate: true })
      expect(state.water).toBe('tile')
    }
  })

  it('ignores events out of turn, and keeps the same state when nothing changes', () => {
    const state = initialPhases(none)
    expect(phasesReducer(state, { type: 'morph', task: 'water' })).toBe(state)
    expect(phasesReducer(state, { type: 'landed', task: 'water' })).toBe(state)
    expect(phasesReducer(state, { type: 'sync', completion: none, animate: true })).toBe(state)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/boardPhases.test.ts`
Expected: FAIL, cannot find module `../boardPhases`.

- [ ] **Step 3: Implement**

```ts
import { TASK_IDS } from '../../../logic/dayCompletion'
import type { TaskId } from '../../../logic/types'

/** Where a task is on the board: an open tile, a full tile about to go, shrinking into its chip, or a chip. */
export type Phase = 'tile' | 'full' | 'morphing' | 'chip'
export type Phases = Record<TaskId, Phase>
export type Completion = Record<TaskId, boolean>

export type PhaseEvent =
  /** The day changed. Without animation a done task is a chip at once; with it, it waits for its fill. */
  | { type: 'sync'; completion: Completion; animate: boolean }
  /** A done task's fill has filled its tile. */
  | { type: 'full'; task: TaskId }
  /** The full tile's glow is over: it starts shrinking into its chip. */
  | { type: 'morph'; task: TaskId }
  | { type: 'landed'; task: TaskId }

/** Opening the board: done tasks are chips already, and nothing animates. */
export function initialPhases(completion: Completion): Phases {
  return Object.fromEntries(TASK_IDS.map((task) => [task, completion[task] ? 'chip' : 'tile'])) as Phases
}

export function phasesReducer(state: Phases, event: PhaseEvent): Phases {
  const next = { ...state }
  switch (event.type) {
    case 'sync':
      for (const task of TASK_IDS) {
        if (!event.completion[task]) next[task] = 'tile'
        else if (!event.animate) next[task] = 'chip'
      }
      break
    case 'full':
      if (state[event.task] === 'tile') next[event.task] = 'full'
      break
    case 'morph':
      if (state[event.task] === 'full') next[event.task] = 'morphing'
      break
    case 'landed':
      if (state[event.task] === 'morphing') next[event.task] = 'chip'
      break
  }
  return TASK_IDS.every((task) => next[task] === state[task]) ? state : next
}

/** Chips on the board: what the gauge counts. */
export const landedCount = (phases: Phases) => TASK_IDS.filter((task) => phases[task] === 'chip').length

/** Some done task hasn't reached its chip yet: "Day complete!" waits. */
export const settling = (phases: Phases, completion: Completion) => TASK_IDS.some((task) => completion[task] && phases[task] !== 'chip')
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/boardPhases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/boardPhases.ts src/screens/Today/fills/__tests__/boardPhases.test.ts
git commit -m "feat(today): the board's phases, tile to full to chip"
```

### Task 8: the board's motion (glow, morph, resize) in `TaskBoard`

**Files:**
- Create: `src/screens/Today/fills/boardMotion.ts`
- Modify: `src/screens/Today/TaskBoard.tsx` (rewrite), `src/screens/Today/TodayScreen.tsx` (one `LayoutGroup` around the board and the buttons under it)
- Test: `src/screens/Today/__tests__/TaskBoard.test.tsx` (new cases)

**Interfaces:**
- Consumes: Tasks 2, 5, 6, 7.
- Produces: `HOLD_MS`, `MORPH_MS`, `RESIZE_MS`, `canAnimate()`, `Box`, `boxIn(container, el)`, `glow(tile)`, `MorphParts`, `Morph`, `morphIntoChip(parts, reduce)`, `popTick(chip)`, `animateWidth(tile, from, to)`. Chip markers: `[data-chip-icon]`, `[data-chip-label]`, `[data-chip-tick]`.

- [ ] **Step 1: Write the failing tests**

Add to `src/screens/Today/__tests__/TaskBoard.test.tsx`. At the top, mock the engine loader so it hands out the stand-in from Task 6 (add `act, waitFor` to the Testing Library import, and `afterEach, beforeEach` to the Vitest one):

```tsx
import type { FillEngine } from '../fills/painter'
import { fakeEngine, type FakeHandle } from './fakeFillEngine'

const fills = vi.hoisted(() => ({ engine: null as FillEngine | null }))
vi.mock('../fills/useFillEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fills/useFillEngine')>()
  return { ...actual, useFillEngine: () => fills.engine }
})
```

Then the cases:

```tsx
describe('TaskBoard with fills', () => {
  let handles: FakeHandle[]
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  beforeEach(() => {
    handles = []
    fills.engine = fakeEngine(handles)
  })
  afterEach(() => {
    fills.engine = null
    MotionGlobalConfig.skipAnimations = true
    delete (Element.prototype as Partial<Element>).animate
  })

  it('keeps a done tile until its fill is full, then turns it into its chip', async () => {
    // Real animations, with a Web Animations API that finishes at once.
    MotionGlobalConfig.skipAnimations = false
    Element.prototype.animate = vi.fn(() => ({ finished: Promise.resolve(), cancel() {} }) as unknown as Animation)
    const { rerender } = render(board({ ...empty, water_ml: 3550 }))
    rerender(board({ ...empty, water_ml: 3800 }))

    expect(screen.getByRole('button', { name: 'Water, 3.8 L' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Water, 3.8 L, done' })).not.toBeInTheDocument()

    act(() => handles[0].finish())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByRole('button', { name: 'Water, 3.8 L' })).not.toBeInTheDocument()
  })

  it('makes a chip at once when animations are skipped, fills or not', () => {
    const { rerender } = render(board({ ...empty, water_ml: 3550 }))
    rerender(board({ ...empty, water_ml: 3800 }))
    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument()
  })

  it('turns a chip back into a tile when the task is undone', () => {
    const { rerender } = render(board({ ...empty, water_ml: 3800 }))
    rerender(board({ ...empty, water_ml: 3550 }))
    expect(screen.getByRole('button', { name: 'Water, 3.55 / 3.8 L' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to see the first one fail**

Run: `npx vitest run src/screens/Today/__tests__/TaskBoard.test.tsx`
Expected: FAIL on "keeps a done tile until its fill is full" (today the chip appears at once).

- [ ] **Step 3: Implement `boardMotion.ts`**

```ts
import { MotionGlobalConfig } from 'framer-motion'

/** The glow of a full tile, before it goes. */
export const HOLD_MS = 380
/** A full tile shrinking into its chip. */
export const MORPH_MS = 720
/** A tile widening or narrowing when the odd one out changes. */
export const RESIZE_MS = 460
const EASE_MORPH = 'cubic-bezier(.55,0,.2,1)'
const EASE_SLIDE = 'cubic-bezier(.2,.8,.2,1)'
const EASE_POP = 'cubic-bezier(.34,1.56,.64,1)'

/** Whether the board animates at all: not in tests that skip animations, nor without the Web Animations API. */
export function canAnimate(): boolean {
  return !MotionGlobalConfig.skipAnimations && typeof document !== 'undefined' && typeof document.documentElement.animate === 'function'
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

const relative = (container: Element, r: DOMRect): Box => {
  const c = container.getBoundingClientRect()
  return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height }
}

/** An element's box relative to another (the board). */
export const boxIn = (container: Element, el: Element): Box => relative(container, el.getBoundingClientRect())

/** A text's own box (a title's span has padding above its text). */
function textBox(container: Element, el: Element): Box {
  const range = document.createRange()
  range.selectNodeContents(el)
  return relative(container, typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : el.getBoundingClientRect())
}

/** The moment a fill is complete: a ring in the world's ink, a small swell and a brighter tile. */
export function glow(tile: HTMLElement): void {
  if (!canAnimate()) return
  const ring = (percent: number, scale: number, brightness: number) => ({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '-2px',
    outlineColor: `color-mix(in srgb, var(--color-world-ink) ${percent}%, transparent)`,
    transform: `scale(${scale})`,
    filter: `brightness(${brightness})`,
  })
  tile.animate([ring(0, 1, 1), { ...ring(80, 1.03, 1.18), offset: 0.45 }, ring(0, 1, 1)], { duration: HOLD_MS + 120, easing: 'ease-out' })
}

export interface MorphParts {
  /** The board: positioned, the frame the boxes are measured in. */
  board: HTMLElement
  /** The tile's grid box, already lifted out of the grid (absolute) where it stood. */
  box: HTMLElement
  /** The tile itself, inside the box: rounded, on the surface colour. */
  tile: HTMLElement
  /** The chip in the row above, hidden until the tile lands on it. */
  chip: HTMLElement
}

export interface Morph {
  finished: Promise<void>
  cancel(): void
}

type Flight = Element & ElementCSSInlineStyle

function place(flight: Flight, at: Box, extra: Partial<CSSStyleDeclaration>) {
  Object.assign(flight.style, {
    position: 'absolute',
    left: `${at.left}px`,
    top: `${at.top}px`,
    zIndex: '6',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    margin: '0',
    ...extra,
  })
}

/** The tile's title flies to the chip's label, shrinking to its size and fading to its colour. */
function flyText(board: HTMLElement, from: Element, to: Element, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const a = textBox(board, from)
  const b = textBox(board, to)
  const look = getComputedStyle(from)
  const flight = document.createElement('span')
  flight.textContent = from.textContent
  place(flight, a, { whiteSpace: 'nowrap', fontFamily: look.fontFamily, fontSize: look.fontSize, fontWeight: look.fontWeight, lineHeight: `${a.height}px`, color: look.color })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { transform: 'none', color: look.color },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.height / a.height || 1})`, color: getComputedStyle(to).color },
      ],
      timing,
    ),
  )
  return flight
}

/** The tile's icon flies to the chip's. */
function flyIcon(board: HTMLElement, from: Element, to: Element, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const a = boxIn(board, from)
  const b = boxIn(board, to)
  const color = getComputedStyle(from).color
  const flight = from.cloneNode(true) as Flight
  place(flight, a, { width: `${a.width}px`, height: `${a.height}px`, color })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { transform: 'none', color },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width || 1})`, color: getComputedStyle(to).color },
      ],
      timing,
    ),
  )
  return flight
}

/** The photo gathers in the middle of the tile and shrinks into the chip's thumbnail. */
function flyPhoto(board: HTMLElement, tile: Box, to: HTMLImageElement, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const size = 72
  const start = { left: tile.left + tile.width / 2 - size / 2, top: tile.top + tile.height / 2 - size / 2, width: size, height: size }
  const b = boxIn(board, to)
  const flight = to.cloneNode() as HTMLImageElement
  place(flight, start, { width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', opacity: '0' })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { opacity: 0, transform: 'none' },
        { opacity: 1, offset: 0.3 },
        { opacity: 1, transform: `translate(${b.left - start.left}px, ${b.top - start.top}px) scale(${b.width / size})` },
      ],
      timing,
    ),
  )
  return flight
}

/**
 * Shrinks a full tile into its chip. The tile's box travels to the chip's while its corners round into a pill and
 * its colour passes through the world's colour into the chip's. Its content fades, and its title and icon fly into
 * the chip's (the photo shrinks into the thumbnail). Under reduce motion the tile only fades out where it is.
 */
export function morphIntoChip({ board, box, tile, chip }: MorphParts, reduce: boolean): Morph {
  if (!canAnimate()) return { finished: Promise.resolve(), cancel() {} }
  const animations: Animation[] = []
  const flights: Flight[] = []
  if (reduce) {
    animations.push(box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }))
  } else {
    const a = boxIn(board, box)
    const b = boxIn(board, chip)
    const surface = getComputedStyle(chip).backgroundColor
    const timing: KeyframeAnimationOptions = { duration: MORPH_MS, easing: EASE_MORPH, fill: 'forwards' }
    animations.push(
      box.animate(
        [
          { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` },
          { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` },
        ],
        timing,
      ),
      tile.animate(
        [
          { borderRadius: '20px', backgroundColor: surface },
          { backgroundColor: `color-mix(in srgb, var(--color-world) 55%, ${surface})`, offset: 0.22 },
          { borderRadius: `${b.height / 2}px`, backgroundColor: surface },
        ],
        timing,
      ),
    )
    for (const child of Array.from(tile.children)) {
      animations.push(child.animate([{ opacity: getComputedStyle(child).opacity }, { opacity: 0 }], { duration: MORPH_MS * 0.3, easing: 'ease-out', fill: 'forwards' }))
    }
    const title = tile.querySelector('[data-fill-title]')
    const label = chip.querySelector('[data-chip-label]')
    if (title && label) flights.push(flyText(board, title, label, timing, animations))
    const chipIcon = chip.querySelector('[data-chip-icon]')
    const photo = chipIcon?.querySelector('img')
    const icon = tile.querySelector('[data-fill-icon] svg')
    if (photo) flights.push(flyPhoto(board, a, photo, timing, animations))
    else if (icon && chipIcon) flights.push(flyIcon(board, icon, chipIcon, timing, animations))
  }
  const finished = Promise.allSettled(animations.map((animation) => animation.finished)).then(() => flights.forEach((flight) => flight.remove()))
  return {
    finished,
    cancel() {
      animations.forEach((animation) => animation.cancel())
      flights.forEach((flight) => flight.remove())
    },
  }
}

/** Landing: the chip's tick pops and the chip gives a small bounce. */
export function popTick(chip: HTMLElement): void {
  if (!canAnimate()) return
  chip.querySelector('[data-chip-tick]')?.animate(
    [{ transform: 'scale(0) rotate(-35deg)' }, { transform: 'scale(1.45)', offset: 0.55 }, { transform: 'scale(1)' }],
    { duration: 440, easing: EASE_POP },
  )
  chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' })
}

/** A tile whose width changes widens or narrows; its fill is drawn at each width on the way. */
export function animateWidth(tile: HTMLElement, from: number, to: number): void {
  if (!canAnimate() || from === to) return
  tile.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: RESIZE_MS, easing: EASE_SLIDE })
}
```

- [ ] **Step 4: Rewrite `TaskBoard.tsx`**

```tsx
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { TASK_TITLES, taskStatusLine, type BoardTask } from '../../content/taskStatus'
import type { DayEntry } from '../../db/types'
import { TASK_IDS } from '../../logic/dayCompletion'
import { minutesToFinish } from '../../logic/menace'
import type { Ruleset } from '../../logic/rulesets'
import type { DayTaskData, TaskId } from '../../logic/types'
import { DietSwitches } from './DietSwitches'
import { animateWidth, boxIn, canAnimate, glow, HOLD_MS, morphIntoChip, popTick, type Box, type Morph } from './fills/boardMotion'
import { initialPhases, phasesReducer, type Phase } from './fills/boardPhases'
import { TASK_PAINTER } from './fills/painter'
import { FillEngineContext, useFillEngine } from './fills/useFillEngine'
import { spoken, TaskTile, type QuickAction } from './TaskTile'
import { TASK_ICONS } from './taskTones'

export type { QuickAction } from './TaskTile'

interface TaskBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  /** The book being read, for the done reading chip. */
  bookTitle?: string
  /** The day's photo: the iris opens on it, and it's the done photo chip's thumbnail. */
  photo?: Blob
  /** Shortcuts on the tiles that have one. */
  quickActions?: Partial<Record<BoardTask, QuickAction>>
  /** A declared social occasion today: the diet tile shows a toast instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left (the duck tapping or hunting): the open tiles get an edge. */
  urgent?: boolean
  /** Minutes until midnight, when urgent: a task that no longer fits gets a red edge. */
  minutesLeft?: number
  onOpen: (task: BoardTask) => void
}

/** A day with nothing logged: the tiles sort by what a task takes in full, so they never move as it progresses. */
const FRESH_DAY: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

const inGrid = (phase: Phase) => phase === 'tile' || phase === 'full'

/**
 * The five tasks of a day (mood and notes live outside the board: they're optional and never "done"). The open ones
 * are tiles, the quickest kind first, each filling as its task progresses and opening its sheet on tap; the done ones
 * are chips above them. A tile whose task gets done fills to the top, glows, and shrinks into its chip while the
 * others close up. Late in the evening the tiles get an edge, red on what no longer fits before midnight.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data, completion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, minutesLeft, onOpen } = props
  const reduceMotion = useReducedMotion() ?? false
  const engine = useFillEngine()
  const animate = canAnimate()
  const [phases, dispatch] = useReducer(phasesReducer, completion, initialPhases)
  const [settledAt, setSettledAt] = useState<Partial<Record<TaskId, number | null>>>({})
  const boardRef = useRef<HTMLElement>(null)
  const boxes = useRef<Partial<Record<TaskId, HTMLDivElement | null>>>({})
  const chipEls = useRef<Partial<Record<TaskId, HTMLButtonElement | null>>>({})
  const morphFrom = useRef<Partial<Record<TaskId, Box>>>({})
  const holds = useRef<Partial<Record<TaskId, number>>>({})
  const morphs = useRef<Partial<Record<TaskId, Morph>>>({})
  const widths = useRef<Partial<Record<TaskId, number>>>({})
  const previous = useRef(phases)
  const mounted = useRef(false)

  // The day is the truth; the board follows it.
  useLayoutEffect(() => dispatch({ type: 'sync', completion, animate }), [completion, animate])

  // A done tile is full once its fill has settled at the top (at once if it has no fill yet).
  const hasFill = (task: TaskId) => engine?.supports(TASK_PAINTER[task]) ?? false
  useEffect(() => {
    for (const task of TASK_IDS) {
      if (completion[task] && phases[task] === 'tile' && (!hasFill(task) || settledAt[task] === 1)) dispatch({ type: 'full', task })
    }
  })

  // Full: the tile glows, then sets off for its chip from where it stands.
  useEffect(() => {
    for (const task of TASK_IDS) {
      const holding = holds.current[task] !== undefined
      if (phases[task] === 'full' && !holding) {
        const tile = boxes.current[task]?.firstElementChild
        if (tile instanceof HTMLElement && !reduceMotion) glow(tile)
        holds.current[task] = window.setTimeout(
          () => {
            holds.current[task] = undefined
            const board = boardRef.current
            const box = boxes.current[task]
            if (board && box) morphFrom.current[task] = boxIn(board, box)
            dispatch({ type: 'morph', task })
          },
          reduceMotion ? 0 : HOLD_MS,
        )
      } else if (phases[task] !== 'full' && holding) {
        clearTimeout(holds.current[task])
        holds.current[task] = undefined
      }
    }
  }, [phases, reduceMotion])

  // Morphing: the tile, lifted out of the grid where it stood, shrinks into its chip; landing pops the tick.
  useLayoutEffect(() => {
    for (const task of TASK_IDS) {
      const running = morphs.current[task]
      if (phases[task] === 'morphing' && !running) {
        const board = boardRef.current
        const box = boxes.current[task]
        const chip = chipEls.current[task]
        const tile = box?.firstElementChild
        if (!board || !box || !chip || !(tile instanceof HTMLElement)) {
          dispatch({ type: 'landed', task })
          continue
        }
        const morph = morphIntoChip({ board, box, tile, chip }, reduceMotion)
        morphs.current[task] = morph
        void morph.finished.then(() => {
          if (morphs.current[task] !== morph) return
          morphs.current[task] = undefined
          dispatch({ type: 'landed', task })
        })
      } else if (phases[task] !== 'morphing' && running) {
        running.cancel()
        morphs.current[task] = undefined
      }
      if (previous.current[task] === 'morphing' && phases[task] === 'chip' && !reduceMotion) {
        const chip = chipEls.current[task]
        if (chip) popTick(chip)
      }
    }
    previous.current = phases
  }, [phases, reduceMotion])

  // The odd tile out takes the whole row: a tile whose width changes widens or narrows instead of jumping.
  useLayoutEffect(() => {
    for (const task of TASK_IDS) {
      const box = boxes.current[task]
      if (!box || !inGrid(phases[task])) continue
      const width = box.offsetWidth
      const was = widths.current[task]
      const tile = box.firstElementChild
      if (was !== undefined && was !== width && tile instanceof HTMLElement && !reduceMotion) animateWidth(tile, was, width)
      widths.current[task] = width
    }
  })

  useEffect(() => {
    mounted.current = true
    const pendingHolds = holds.current
    const pendingMorphs = morphs.current
    return () => {
      Object.values(pendingHolds).forEach((id) => clearTimeout(id))
      Object.values(pendingMorphs).forEach((morph) => morph?.cancel())
    }
  }, [])

  const byTime = (a: TaskId, b: TaskId) => minutesToFinish(a, FRESH_DAY, rules) - minutesToFinish(b, FRESH_DAY, rules)
  const open = TASK_IDS.filter((task) => phases[task] !== 'chip').sort(byTime)
  const grid = open.filter((task) => inGrid(phases[task]))
  const chips = TASK_IDS.filter((task) => phases[task] === 'morphing' || phases[task] === 'chip')
  const layout = animate && !reduceMotion ? 'position' : false
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft
  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

  return (
    <FillEngineContext.Provider value={engine}>
      <section ref={boardRef} aria-label="Tasks" className="relative">
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {chips.map((task) => (
                <motion.button
                  key={task}
                  ref={(el: HTMLButtonElement | null) => {
                    chipEls.current[task] = el
                  }}
                  layout={layout}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={() => onOpen(task)}
                  aria-label={`${TASK_TITLES[task]}, ${spoken(statusOf(task))}, done`}
                  // Hidden while its tile flies in: the tile lands exactly on it.
                  style={{ opacity: phases[task] === 'morphing' ? 0 : 1 }}
                  className="flex min-h-touch items-center gap-1.5 rounded-full bg-surface px-3 font-rounded text-sm font-semibold text-ink-muted ring-1 ring-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:ring-0"
                >
                  <span data-chip-icon className="flex">
                    {task === 'photo' && photo ? (
                      <BlobImage blob={photo} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <Icon name={TASK_ICONS[task]} size={16} />
                    )}
                  </span>
                  <span data-chip-label>{TASK_TITLES[task]}</span>
                  <span data-chip-tick aria-hidden="true" className="inline-block text-green-ink">
                    ✓
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
        {open.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {open.map((task) => {
              const morphing = phases[task] === 'morphing'
              const i = grid.indexOf(task)
              // An odd tile out at the end takes the whole row.
              const lastOdd = !morphing && i === grid.length - 1 && grid.length % 2 === 1
              const from = morphFrom.current[task]
              return (
                <motion.div
                  key={task}
                  ref={(el: HTMLDivElement | null) => {
                    boxes.current[task] = el
                  }}
                  layout={morphing ? false : layout}
                  initial={mounted.current && layout ? { opacity: 0, scale: 0.92 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  className={lastOdd ? 'col-span-2' : undefined}
                  // Lifted out of the grid where it stood, above the rest, for its trip into the chip row.
                  style={morphing && from ? { position: 'absolute', zIndex: 5, left: from.left, top: from.top, width: from.width, height: from.height } : undefined}
                >
                  <TaskTile
                    task={task}
                    data={data}
                    rules={rules}
                    complete={completion[task]}
                    bookTitle={bookTitle}
                    urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
                    quick={phases[task] === 'tile' ? quickActions?.[task] : undefined}
                    controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday ?? false} /> : undefined}
                    image={task === 'photo' ? photo : undefined}
                    morphing={morphing}
                    onSettledAt={(at) => setSettledAt((all) => (all[task] === at ? all : { ...all, [task]: at }))}
                    onOpen={() => onOpen(task)}
                  />
                </motion.div>
              )
            })}
          </div>
        )}
      </section>
    </FillEngineContext.Provider>
  )
}
```

The existing tests keep their selectors: a tile's button sits in its tile `div` (with the ring classes), which sits in the grid box (with `col-span-2`).

- [ ] **Step 5: Let the buttons under the board slide with it**

In `src/screens/Today/TodayScreen.tsx`, import `LayoutGroup, motion, useReducedMotion` from `framer-motion`. Wrap the `<DayBoard …/>` and the buttons' `<div className="mt-4 flex flex-wrap gap-2">` in one `<LayoutGroup>`. Make that div a `<motion.div layout={reduceMotion ? false : 'position'} className="mt-4 flex flex-wrap gap-2">`, with `const reduceMotion = useReducedMotion() ?? false` at the top of `TodayTasks` (before the early return, with the other hooks).

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run src/screens/Today`
Expected: PASS, the three new cases and every existing one.

- [ ] **Step 7: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/boardMotion.ts src/screens/Today/TaskBoard.tsx src/screens/Today/TodayScreen.tsx src/screens/Today/__tests__/TaskBoard.test.tsx
git commit -m "feat(today): a full tile glows and shrinks into its chip while the board closes up"
```

### Task 9: hold the board while a sheet covers it

**Files:**
- Create: `src/screens/Today/fills/useFrozenWhile.ts`
- Modify: `src/screens/Today/photoCaptureContext.ts`, `src/screens/Today/PhotoCapture.tsx`, `src/screens/Today/DayBoard.tsx`, `src/screens/Today/TaskBoard.tsx`, `src/screens/Today/TodayScreen.tsx`
- Test: `src/screens/Today/fills/__tests__/useFrozenWhile.test.ts`, `src/screens/Today/__tests__/TaskBoard.test.tsx` (one case)

**Interfaces:**
- Produces: `useFrozenWhile<T>(frozen: boolean, value: T): T`; `PhotoCaptureApi.cameraOpen: boolean`; `TaskBoard` prop `paused?: boolean`; `DayBoard` prop `covered?: boolean`.

- [ ] **Step 1: Write the failing tests**

`src/screens/Today/fills/__tests__/useFrozenWhile.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFrozenWhile } from '../useFrozenWhile'

describe('useFrozenWhile', () => {
  it('keeps the value from before the freeze, and follows again after', () => {
    const { result, rerender } = renderHook(({ frozen, value }) => useFrozenWhile(frozen, value), { initialProps: { frozen: false, value: 1 } })
    expect(result.current).toBe(1)
    rerender({ frozen: true, value: 2 })
    expect(result.current).toBe(1)
    rerender({ frozen: true, value: 3 })
    expect(result.current).toBe(1)
    rerender({ frozen: false, value: 3 })
    expect(result.current).toBe(3)
  })
})
```

In `TaskBoard.test.tsx`, in the first `describe`:

```tsx
it('holds the board while a sheet covers it, and catches up once it closes', () => {
  const { rerender } = render(board({ ...empty, water_ml: 3550 }, { paused: true }))
  rerender(board({ ...empty, water_ml: 3800 }, { paused: true }))
  expect(screen.getByRole('button', { name: 'Water, 3.55 / 3.8 L' })).toBeInTheDocument()
  rerender(board({ ...empty, water_ml: 3800 }, { paused: false }))
  expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/useFrozenWhile.test.ts src/screens/Today/__tests__/TaskBoard.test.tsx`
Expected: FAIL (no module; no `paused` prop).

- [ ] **Step 3: Implement**

`src/screens/Today/fills/useFrozenWhile.ts`:

```ts
import { useState } from 'react'

/** The value as it was when `frozen` turned on, until it turns off. A change made under a sheet then plays once the sheet closes, from where the board was. */
export function useFrozenWhile<T>(frozen: boolean, value: T): T {
  const [kept, setKept] = useState(value)
  // React's "adjust state when a prop changes" pattern: compared during render, no effect needed.
  if (!frozen && kept !== value) setKept(value)
  return frozen ? kept : value
}
```

`photoCaptureContext.ts`: add to `PhotoCaptureApi`:

```ts
  /** The in-app camera sheet is open (it covers the board). */
  cameraOpen: boolean
```

`PhotoCapture.tsx`: add `cameraOpen` to the provider's value: `value={{ photo, busy, error, cameraFailed, cameraOpen, libraryOnly, takePhoto, chooseFromLibrary }}`. Search the tests for objects typed `PhotoCaptureApi` (`grep -rn "PhotoCaptureApi\|PhotoCaptureContext.Provider" src`) and add `cameraOpen: false` to them.

`TaskBoard.tsx`: add the prop and use the held day everywhere below it:

```tsx
  /** A sheet covers the board: it holds still, and plays what changed once the sheet closes. */
  paused?: boolean
```

```tsx
  const { entry, data: liveData, completion: liveCompletion, rules, bookTitle, photo, quickActions, socialToday, urgent = false, minutesLeft, paused = false, onOpen } = props
  const { data, completion } = useFrozenWhile(paused, useMemoDay(liveData, liveCompletion))
```

with, at module level in TaskBoard.tsx:

```tsx
import { useMemo } from 'react'
/** One object per day state, so holding it compares by identity. */
const useMemoDay = (data: DayTaskData, completion: Record<TaskId, boolean>) => useMemo(() => ({ data, completion }), [data, completion])
```

`useReducer(phasesReducer, completion, initialPhases)` now receives the held `completion`, and so do all the effects. Then stop the engine itself while the board is held, so the drift stops under the sheet too:

```tsx
  useEffect(() => {
    engine?.hold(paused)
    return () => engine?.hold(false)
  }, [engine, paused])
```

`DayBoard.tsx`: add `covered?: boolean` to the props ("A sheet is open over the board"), and pass `paused={(props.covered ?? false) || capture.cameraOpen}` to `TaskBoard`.

`TodayScreen.tsx`: pass `covered={openTask !== null || addWorkoutOpen || planOpen || socialOpen}` to `DayBoard`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/screens/Today`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today
git commit -m "feat(today): the board holds still under a sheet and plays the change when it closes"
```

### Task 10: the gauge counts landed chips; "Day complete!" waits

**Files:**
- Create: `src/screens/Today/fills/boardSettle.ts`
- Modify: `src/screens/Today/TaskBoard.tsx`, `src/screens/Today/DayBoard.tsx`, `src/screens/Today/TodayScreen.tsx`, `src/App.tsx`
- Test: `src/screens/Today/fills/__tests__/boardSettle.test.ts`, `src/screens/Today/__tests__/TaskBoard.test.tsx` (one case)

**Interfaces:**
- Consumes: `landedCount`, `settling` (Task 7).
- Produces: `setBoardBusy(busy: boolean)`, `useBoardBusy(): boolean`, `useSettledCelebration<T>(value: T | null, maxWaitMs?: number): T | null`; `TaskBoard`/`DayBoard` prop `onLandedChange?: (count: number) => void`.

- [ ] **Step 1: Write the failing tests**

`src/screens/Today/fills/__tests__/boardSettle.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setBoardBusy, useSettledCelebration } from '../boardSettle'

describe('useSettledCelebration', () => {
  afterEach(() => {
    act(() => setBoardBusy(false))
    vi.useRealTimers()
  })

  it('shows the celebration at once when the board is settled', () => {
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    expect(result.current).toBe('day 30')
  })

  it('waits for the last chip to land', () => {
    act(() => setBoardBusy(true))
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    expect(result.current).toBeNull()
    act(() => setBoardBusy(false))
    expect(result.current).toBe('day 30')
  })

  it('waits 4 s at most', () => {
    vi.useFakeTimers()
    act(() => setBoardBusy(true))
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe('day 30')
  })
})
```

In `TaskBoard.test.tsx`, first `describe`:

```tsx
it('reports how many chips have landed, for the gauge', () => {
  const onLandedChange = vi.fn()
  const { rerender } = render(board(empty, { onLandedChange }))
  expect(onLandedChange).toHaveBeenLastCalledWith(0)
  rerender(board({ ...empty, water_ml: 3800 }, { onLandedChange }))
  expect(onLandedChange).toHaveBeenLastCalledWith(1)
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/boardSettle.test.ts src/screens/Today/__tests__/TaskBoard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Today/fills/boardSettle.ts`:

```ts
import { useEffect, useState, useSyncExternalStore } from 'react'

let busy = false
const listeners = new Set<() => void>()

/** The board still has a done task on its way to its chip (set by TaskBoard). */
export function setBoardBusy(value: boolean): void {
  if (busy === value) return
  busy = value
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBoardBusy(): boolean {
  return useSyncExternalStore(subscribe, () => busy)
}

/** A celebration that waits for the board's last chip to land, `maxWaitMs` at most. */
export function useSettledCelebration<T>(value: T | null, maxWaitMs = 4000): T | null {
  const boardBusy = useBoardBusy()
  const [timedOut, setTimedOut] = useState<T | null>(null)
  useEffect(() => {
    if (value === null || !boardBusy) return
    const timer = setTimeout(() => setTimedOut(value), maxWaitMs)
    return () => clearTimeout(timer)
  }, [value, boardBusy, maxWaitMs])
  return value !== null && (!boardBusy || timedOut === value) ? value : null
}
```

`TaskBoard.tsx`: add the prop and two effects:

```tsx
  /** How many chips have landed: the gauge counts these, not the saved completions. */
  onLandedChange?: (count: number) => void
```

```tsx
import { initialPhases, landedCount, phasesReducer, settling, type Phase } from './fills/boardPhases'
import { setBoardBusy } from './fills/boardSettle'
```

```tsx
  const landed = landedCount(phases)
  useEffect(() => onLandedChange?.(landed), [landed, onLandedChange])
  const busy = settling(phases, completion)
  useEffect(() => setBoardBusy(busy), [busy])
  useEffect(() => () => setBoardBusy(false), [])
```

`DayBoard.tsx`: add `onLandedChange?: (count: number) => void` to the props and pass it on to `TaskBoard`.

`TodayScreen.tsx` (`TodayTasks`): add `const [landed, setLanded] = useState<number | null>(null)` with the other state, pass `onLandedChange={setLanded}` to `DayBoard`, and give the hero `completedCount={landed ?? completedCount}`.

`src/App.tsx`: import `useSettledCelebration` from `./screens/Today/fills/boardSettle`, then after `useDayCompleteCelebration`:

```tsx
  // "Day complete!" waits for the board's last chip to land (4 s at most).
  const shownCelebration = useSettledCelebration(celebration)
```

Use `shownCelebration` for `<DayCompleteCelebration celebration=…>`, for `BadgeUnlockToast`'s `badges={shownCelebration ? [] : toasts}` and for `VictoryScreen`'s `revealed={shownCelebration === null}`. Keep `celebrating={celebration !== null}` on `TodayScreen`: the gauge holds its 5/5 finale from the moment the day is done, and plays it once the overlay closes, as today.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/screens/Today src/hooks src/__tests__/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today src/App.tsx
git commit -m "feat(today): the gauge counts landed chips, and Day complete waits for the last one"
```

### Task 11: check it in the browser, then the PR

- [ ] **Step 1: The four checks**

```bash
npx tsc -b
npm run lint
npm run test
npm run build
```

Expected: all pass.

- [ ] **Step 2: Look at it**

Add a launch config for this worktree (pick a free port, e.g. 5190) and open Today on a scratch database in the forest world, at phone width (390 × 844): `http://localhost:5190/?db=fills&travel=30&now=10:00`. Then check:

1. Tap "+ 250 ml" a few times. The water rises on the tap, the line counts up in 50 ml, the ripple starts under the chip, and there are no console errors.
2. Fill the water to the goal. It glows, then shrinks into its chip while the tiles close up; the tick pops and the gauge counts it.
3. Tick both diet switches (no fill yet in Part 1). It glows and shrinks into its chip at once. Water drops to half width smoothly, with its waves drawn at each width.
4. Open the water sheet, add 500 ml and close it. The rise plays after the sheet has closed.
5. Undo a glass from the toast: the water drains. Undo the last glass of a done water: the chip fades and the tile comes back.
6. Compare the water side by side with `docs/prototypes/water-tile.html` (dark, forest). The colours and motion should match.
7. Switch the theme to light and walk through the worlds with time travel (`travel=5`, `15`, `45`, `60`, `70`). The fill is in each world's colour and the text stays readable.

- [ ] **Step 3: The PR**

```bash
git push -u origin feat/tile-fills-1
gh pr create --base main --title "Tile fills, part 1: engine, board flow and Water" --body-file -
```

The body should say:

- What changed: the shared engine, the board flow (glow, morph, slides, count-up, held under sheets, gauge and "Day complete!" timing) and Water's wave. The other tiles keep the thin bar until parts 2–4.
- Link the spec and this plan.
- "Phone check on the Vercel preview: water from empty to full, a diet tick, light and dark, Reduce Motion on."
- The attribution line.

Then give the owner the Vercel preview link and wait for their phone check.

---

# Part 2 (PR 2): Diet's ink and Workouts' sprint

New worktree and branch from the updated `main` once PR 1 is merged:

```bash
git -C C:/Users/danie/Documents/Coding/Claude/75hard worktree add .claude/worktrees/tile-fills-2 -b feat/tile-fills-2 main
```

### Task 12: Diet's ink

**Files:**
- Create: `src/screens/Today/fills/ink.ts`
- Modify: `src/screens/Today/fills/painters.ts` (add `ink: createInk`), `src/screens/Today/DietSwitches.tsx` (`data-fill-anchor` on its root div)
- Test: `src/screens/Today/fills/__tests__/ink.test.ts`

**Interfaces:**
- Consumes: `Painter`, `FillPalette`, `shaderQuad`, `outQuart`.
- Produces: `createInk(palette): Painter`; `inkRadius(level, width, height, origin, margin): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { createInk, inkRadius } from '../ink'
import { fillPalette } from '../palette'

describe('ink fill', () => {
  it('reaches further for more of the tile, and past its far corner when full', () => {
    const origin: [number, number] = [50, 0]
    const half = inkRadius(0.5, 173, 120, origin, 0)
    expect(inkRadius(0.25, 173, 120, origin, 0)).toBeLessThan(half)
    expect(inkRadius(1, 173, 120, origin, 10)).toBeGreaterThan(Math.hypot(173 / 2 + 50, 60))
    expect(inkRadius(0, 173, 120, origin, 10)).toBeLessThan(0)
  })

  it('spreads in the chosen 1.1 s', () => {
    const ink = createInk(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    ink.setLevel(0.5, false)
    for (let i = 0; i < 66; i++) ink.step(1 / 60, true)
    expect(ink.settled()).toBe(true)
    expect(ink.shown()).toBeCloseTo(0.5)
    ink.dispose()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/ink.test.ts`
Expected: FAIL, no module `../ink`.

- [ ] **Step 3: Implement `ink.ts`**

The shader is `INK_FRAG` from `docs/prototypes/diet-tile.html`, with its two greens taken from the palette (`uTop` for the pale parts, `uDeep` for the veins):

```ts
import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { outQuart } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Diet). */
const P = { spread: 1.1, swirl: 0.81, grain: 150, soft: 20, drift: 0.36 }
const MARGIN = P.swirl * 40 + P.soft + 6

/** The radius from `origin` (px from the tile's centre, y up) that covers `level` of the tile: read off the sorted distances to a grid of points, plus `margin` for the swirl and the soft edge. */
export function inkRadius(level: number, width: number, height: number, origin: readonly [number, number], margin: number): number {
  const distances: number[] = []
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 60; x++) distances.push(Math.hypot(-width / 2 + ((x + 0.5) * width) / 60 - origin[0], -height / 2 + ((y + 0.5) * height) / 30 - origin[1]))
  }
  distances.sort((a, b) => a - b)
  if (level <= 0) return -margin
  if (level >= 1) return distances[distances.length - 1] + margin
  return distances[Math.floor(level * distances.length)]
}

const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform float uTime, uR, uSwirl, uSoft, uScale;
  uniform vec2 uO;
  uniform vec3 uTop, uDeep;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
  void main() {
    vec2 q = vP / uScale;
    vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.08)), fbm(q + vec2(5.2, 1.3) - uTime * 0.06));
    vec2 w2 = vec2(fbm(q + 3.0 * w + vec2(1.7, 9.2) + uTime * 0.05), fbm(q + 3.0 * w + vec2(8.3, 2.8)));
    float e = uR - (length(vP - uO) + (w2.x - 0.5) * uSwirl * 120.0);
    float a = smoothstep(-uSoft, uSoft, e);
    if (a <= 0.0) discard;
    float rim = exp(-pow(e / (uSoft * 3.0 + 4.0), 2.0)), vein = fbm(q * 2.0 + w2 * 2.0);
    vec3 c = mix(uTop, uDeep, clamp(vein * 1.1 + rim * 0.6, 0.0, 1.0));
    gl_FragColor = vec4(c, a * (0.78 + 0.22 * rim));
  }
`

/** Diet: green ink blooming through water from the switches, half the tile per switch; it keeps drifting slowly. */
export function createInk(palette: FillPalette): Painter {
  const u = {
    uTime: { value: Math.random() * 50 },
    uR: { value: -MARGIN },
    uSwirl: { value: P.swirl },
    uSoft: { value: P.soft },
    uScale: { value: P.grain },
    uO: { value: new Vector2() },
    uTop: { value: new Vector3() },
    uDeep: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  let from = 0
  let to = 0
  let p = 1
  let anchorRight = 56
  let anchorTop = 60
  const shown = () => from + (to - from) * outQuart(p)

  const painter: Painter = {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      p = instant ? 1 : 0
    },
    step(dt, drift) {
      p = Math.min(1, p + dt / P.spread)
      if (drift) u.uTime.value += dt * P.drift
      return p < 1
    },
    drifts: () => to > 0,
    shown,
    settled: () => p >= 0.85,
    setAnchor(right, top) {
      anchorRight = right
      anchorTop = top
    },
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const origin: [number, number] = [width / 2 - anchorRight, height / 2 - anchorTop]
      u.uO.value.set(origin[0], origin[1])
      const a = inkRadius(from, width, height, origin, MARGIN)
      const b = inkRadius(to, width, height, origin, MARGIN)
      u.uR.value = a + (b - a) * outQuart(p)
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p2) {
      u.uTop.value.set(...p2.top)
      u.uDeep.value.set(...p2.deep)
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
```

`inkRadius` sorts 1,800 distances on every frame for two levels. That's cheap enough, but cache the sorted list by `width × height × origin` inside `createInk` if a profile on the phone shows it.

`DietSwitches.tsx`: add `data-fill-anchor` to the root `div` (`<div data-fill-anchor className="absolute inset-y-0 right-5 …">`). `painters.ts`: `import { createInk } from './ink'` and add `ink: createInk`.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/ink.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/ink.ts src/screens/Today/fills/painters.ts src/screens/Today/DietSwitches.tsx src/screens/Today/fills/__tests__/ink.test.ts
git commit -m "feat(today): the diet's ink fill"
```

### Task 13: Workouts' sprint

**Files:**
- Create: `src/screens/Today/fills/sprint.ts`
- Modify: `src/screens/Today/fills/painters.ts` (add `sprint: createSprint`)
- Test: `src/screens/Today/fills/__tests__/sprint.test.ts`

**Interfaces:**
- Produces: `createSprint(palette): Painter`; `sprintFront(level, width): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { fillPalette } from '../palette'
import { createSprint, sprintFront } from '../sprint'

describe('sprint fill', () => {
  it('starts off the left edge, crosses in proportion and ends off the right edge', () => {
    expect(sprintFront(0, 173)).toBeLessThan(-16)
    expect(sprintFront(0.5, 173)).toBeCloseTo(173 / 2)
    expect(sprintFront(1, 173)).toBeGreaterThan(173 + 16)
  })

  it('leaves at full speed on the tap and settles in the chosen 0.7 s', () => {
    const sprint = createSprint(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    sprint.setLevel(0.5, false)
    sprint.step(1 / 60, true)
    expect(sprint.shown()).toBeGreaterThan(0.03)
    for (let i = 0; i < 42; i++) sprint.step(1 / 60, true)
    expect(sprint.settled()).toBe(true)
    sprint.dispose()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/sprint.test.ts`
Expected: FAIL, no module `../sprint`.

- [ ] **Step 3: Implement `sprint.ts`**

The shader is `SPRINT_FRAG` from `docs/prototypes/today-preview.html` (the size-aware version), with its greens from the palette:

```ts
import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { clamp01, cubicOut } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Workouts). */
const P = { run: 0.7, lanes: 12, streak: 90, ragged: 16, flow: 0.3 }

/** The fill's front, px from the tile's left edge: off the left when empty, off the right (ragged edge and all) when full. */
export function sprintFront(level: number, width: number): number {
  const edge = P.ragged + 10
  return -edge + level * (width + 2 * edge)
}

const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uFront, uVel, uRows, uLen, uSoft, uTime, uFlow;
  uniform vec3 uMid, uLight;
  float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    float x = vP.x + uSize.x * 0.5, rowH = uSize.y / uRows, row = floor((vP.y + uSize.y * 0.5) / rowH), ry = fract((vP.y + uSize.y * 0.5) / rowH);
    float thick = smoothstep(0.3, 0.08, abs(ry - 0.5)), thin = smoothstep(0.14, 0.03, abs(ry - 0.5)), rs = 0.6 + 0.8 * h1(row), off = h1(row + 7.3);
    float lead = uLen * uVel * (0.25 + 0.95 * h1(row + 3.1)), f = uFront + (h1(row + 1.7) - 0.5) * uSoft;
    float behind = smoothstep(f, f - uSoft, x);
    float streak = lead > 0.5 ? thick * smoothstep(f, f + lead, x) * step(x, f + lead) * step(f - 2.0, x) : 0.0;
    float flow = thin * pow(fract(x / 120.0 - uTime * uFlow * rs + off), 6.0) * 0.6 * behind;
    float fill = behind * 0.62;
    float a = clamp(fill + streak + flow, 0.0, 1.0);
    vec3 c = (uMid * fill + uLight * (streak + flow)) / max(fill + streak + flow, 0.001);
    gl_FragColor = vec4(c, a);
  }
`

/** Workouts: the fill races in from the left with speed lines in lanes, which pull back into it as it stops; thin lines keep flowing through it. */
export function createSprint(palette: FillPalette): Painter {
  const u = {
    uSize: { value: new Vector2() },
    uFront: { value: 0 },
    uVel: { value: 0 },
    uRows: { value: P.lanes },
    uLen: { value: P.streak },
    uSoft: { value: P.ragged },
    uTime: { value: 0 },
    uFlow: { value: P.flow },
    uMid: { value: new Vector3() },
    uLight: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let prev = 0
  let vel = 0
  // Off at full speed on the tap (ease out): the streaks are longest at once and pull in as it stops.
  const shown = () => from + (to - from) * cubicOut(t)

  const painter: Painter = {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) vel = 0
      prev = shown()
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / P.run)
      if (drift) time += dt
      const now = shown()
      // How fast the front moves, against its top speed, sets how far the streaks reach.
      const v = dt > 0 ? Math.abs(now - prev) / dt / (Math.abs(to - from) / P.run * 1.5 + 1e-3) : 0
      prev = now
      vel += (clamp01(v) - vel) * Math.min(1, dt * 12)
      return t < 1 || vel > 0.01
    },
    drifts: () => to > 0,
    shown,
    settled: () => t >= 0.8,
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      u.uSize.value.set(width, height)
      u.uFront.value = sprintFront(shown(), width)
      u.uVel.value = vel
      u.uTime.value = time
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p) {
      u.uMid.value.set(...p.mid)
      u.uLight.value.set(...p.light)
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
```

`painters.ts`: `import { createSprint } from './sprint'` and add `sprint: createSprint`.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/sprint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/sprint.ts src/screens/Today/fills/painters.ts src/screens/Today/fills/__tests__/sprint.test.ts
git commit -m "feat(today): the workouts' sprint fill"
```

### Task 14: check and PR

- [ ] **Step 1:** The four checks pass.
- [ ] **Step 2:** In the browser (as in Task 11), tick the diet switches one by one. The ink blooms from the switches, half then whole, and keeps drifting. Then log a workout through its sheet: the sprint races in after the sheet closes. Compare both with `diet-tile.html` and `workouts-tile.html`, and check a social day (one switch fills the whole tile) and Medium (one workout fills it).
- [ ] **Step 3:** Push, then `gh pr create --base main --title "Tile fills, part 2: Diet's ink and Workouts' sprint"`, with the same body shape as part 1. Give the owner the preview link.

---

# Part 3 (PR 3): Photo's iris

```bash
git -C C:/Users/danie/Documents/Coding/Claude/75hard worktree add .claude/worktrees/tile-fills-3 -b feat/tile-fills-3 main
```

### Task 15: the iris, on the day's photo

**Files:**
- Create: `src/screens/Today/fills/iris.ts`
- Modify: `src/screens/Today/fills/painters.ts` (add `iris: createIris`)
- Test: `src/screens/Today/fills/__tests__/iris.test.ts`

**Interfaces:**
- Produces: `createIris(palette): Painter` with `setImage`; `coverRepeat(imageAspect, tileAspect): [number, number]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { coverRepeat, createIris } from '../iris'
import { fillPalette } from '../palette'

describe('iris fill', () => {
  it('crops the photo to cover the tile', () => {
    expect(coverRepeat(2, 1)).toEqual([0.5, 1])
    expect(coverRepeat(0.75, 1.5)).toEqual([1, 0.5])
  })

  it('shuts, holds shut until the photo is there (1 s at most), then opens and settles', () => {
    const iris = createIris(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    iris.setLevel(1, false)
    for (let i = 0; i < 30; i++) iris.step(1 / 60, true)
    // Shut, no photo yet: still waiting.
    expect(iris.settled()).toBe(false)
    for (let i = 0; i < 60 * 2; i++) iris.step(1 / 60, true)
    expect(iris.settled()).toBe(true)
    expect(iris.shown()).toBe(1)
    iris.dispose()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/iris.test.ts`
Expected: FAIL, no module `../iris`.

- [ ] **Step 3: Implement `iris.ts`**

Ported from `docs/prototypes/photo-tile.html`. three.js 0.186 dropped the legacy light units the r128 prototype used, so the light intensities are multiplied by π to keep its look; set colours with `SRGBColorSpace`.

```ts
import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { clamp01, cubicOut } from './motion'
import { mix, type FillPalette } from './palette'
import type { Painter } from './painter'

/** The chosen settings (docs/prototypes/README.md, Photo). */
const P = { blades: 8, close: 0.11, open: 0.9, twist: 0.55, flash: 0.7, colour: 0.3 }
/** Shut for a moment while the photo is set behind the blades; up to WAIT if the photo isn't loaded yet. */
const HOLD = 0.06
const WAIT = 1
const D = 900

/** The share of the photo's texture to show so it covers the tile, cropped in the middle. */
export function coverRepeat(imageAspect: number, tileAspect: number): [number, number] {
  return imageAspect > tileAspect ? [tileAspect / imageAspect, 1] : [1, imageAspect / tileAspect]
}

const PHOTO_FRAG = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform float uHasPhoto, uColour, uA;
  uniform vec2 uRep;
  uniform vec3 uShadow, uLight, uMid;
  varying vec2 vUv;
  void main() {
    vec3 c = uHasPhoto > 0.5 ? texture2D(uPhoto, (vUv - 0.5) * uRep + 0.5).rgb : uMid;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(mix(mix(uShadow, uLight, l), c, uColour), uA);
  }
`

/** Photo: a camera iris shuts, a flash fires as it closes, and its blades swirl open on the day's photo in the world's colour. */
export function createIris(palette: FillPalette): Painter {
  const scene = new Scene()
  const camera = new PerspectiveCamera(10, 1, 100, 2000)
  camera.position.set(0, 0, D)
  scene.add(new AmbientLight(0xffffff, 0.5 * Math.PI))
  const sun = new DirectionalLight(0xffffff, 0.9 * Math.PI)
  sun.position.copy(new Vector3(-200, 250, 600).normalize().multiplyScalar(1000))
  scene.add(sun)

  const pu = {
    uPhoto: { value: null as Texture | null },
    uHasPhoto: { value: 0 },
    uColour: { value: P.colour },
    uA: { value: 0 },
    uRep: { value: new Vector2(1, 1) },
    uShadow: { value: new Vector3() },
    uLight: { value: new Vector3() },
    uMid: { value: new Vector3() },
  }
  const photoMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: pu,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: PHOTO_FRAG,
  })
  const photo = new Mesh(new PlaneGeometry(1, 1), photoMaterial)
  scene.add(photo)

  // Each blade is a big plate whose inner edge sits at distance r from the centre: together they leave a polygon of inradius r open.
  const bladeGeometry = new PlaneGeometry(800, 500)
  bladeGeometry.translate(0, 250, 0)
  const edgeGeometry = new PlaneGeometry(800, 1.6)
  edgeGeometry.translate(0, 0.8, 0)
  const bladeMaterial = new MeshStandardMaterial({ metalness: 0.35, roughness: 0.38, side: DoubleSide })
  const edgeMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.55 })
  const iris = new Group()
  scene.add(iris)
  const blades = Array.from({ length: P.blades }, (_, i) => {
    const blade = new Mesh(bladeGeometry, bladeMaterial)
    blade.add(new Mesh(edgeGeometry, edgeMaterial))
    blade.position.z = 2 + i * 0.6
    blade.rotation.x = 0.04
    iris.add(blade)
    return blade
  })
  const flashMaterial = new MeshBasicMaterial({ color: 0xf6fff4, transparent: true, opacity: 0, depthTest: false })
  const flash = new Mesh(new PlaneGeometry(1, 1), flashMaterial)
  flash.position.z = 40
  flash.renderOrder = 9
  scene.add(flash)

  let on = false
  let t = -1
  let waited = 0
  let openFrom = 0
  let image: ImageBitmap | null = null
  let texture: Texture | null = null
  let width = 173
  let height = 120
  const rmax = () => Math.hypot(width / 2, height / 2) + 12

  function place(r: number) {
    const open = clamp01(r / rmax())
    blades.forEach((blade, i) => {
      const phi = (i / blades.length) * Math.PI * 2 + P.twist * 1.4 * (1 - open)
      blade.position.x = Math.cos(phi) * r
      blade.position.y = Math.sin(phi) * r
      blade.rotation.z = phi - Math.PI / 2
      blade.visible = r < rmax()
    })
  }

  const painter: Painter = {
    setLevel(level, instant) {
      const want = level >= 1
      if (want === on) return
      on = want
      if (!on) {
        t = -1
        pu.uA.value = 0
        flashMaterial.opacity = 0
        return
      }
      if (instant) {
        t = -1
        pu.uA.value = 1
      } else {
        t = 0
        waited = 0
      }
    },
    // The tap snaps the iris shut (ease in), a flash fires as it closes, the photo is set behind it, then it swirls open (ease out).
    step(dt) {
      if (t < 0) return false
      t += dt
      if (t >= P.close + HOLD && openFrom === 0 && (image || waited >= WAIT)) openFrom = t
      if (t >= P.close + HOLD && openFrom === 0) waited += dt
      if (t >= P.close) pu.uA.value = 1
      flashMaterial.opacity = t < P.close ? 0 : P.flash * Math.exp(-(t - P.close) / 0.12)
      if (openFrom > 0 && t > openFrom + P.open + 0.3) {
        t = -1
        openFrom = 0
        flashMaterial.opacity = 0
        return false
      }
      return true
    },
    drifts: () => false,
    shown: () => (on && (t < 0 || t >= P.close) ? 1 : 0),
    settled: () => !on || t < 0 || (openFrom > 0 && t >= openFrom + P.open * 0.85),
    setImage(next) {
      image = next
      texture?.dispose()
      texture = next ? new Texture(next) : null
      if (texture) texture.needsUpdate = true
      pu.uPhoto.value = texture
      pu.uHasPhoto.value = texture ? 1 : 0
    },
    render(renderer: WebGLRenderer, w, h) {
      width = w
      height = h
      camera.fov = (2 * Math.atan(h / 2 / D) * 180) / Math.PI
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      photo.scale.set(w, h, 1)
      flash.scale.set(w, h, 1)
      if (image) pu.uRep.value.set(...coverRepeat(image.width / image.height, w / h))
      let r = rmax()
      if (t >= 0) {
        if (t < P.close) r = rmax() - (rmax() + 6) * (t / P.close) ** 2
        else if (openFrom === 0) r = -6
        else r = -6 + (rmax() + 6) * cubicOut((t - openFrom) / P.open)
      }
      place(r)
      renderer.render(scene, camera)
    },
    setPalette(p) {
      const shadow = mix(p.deep, [0, 0, 0], 0.6)
      pu.uShadow.value.set(...shadow)
      pu.uLight.value.set(...p.light)
      pu.uMid.value.set(...p.mid)
      const blade = mix(p.deep, [0, 0, 0], 0.25)
      bladeMaterial.color.setRGB(blade[0], blade[1], blade[2], SRGBColorSpace)
      edgeMaterial.color.setRGB(p.ink[0], p.ink[1], p.ink[2], SRGBColorSpace)
    },
    dispose() {
      texture?.dispose()
      photo.geometry.dispose()
      photoMaterial.dispose()
      bladeGeometry.dispose()
      edgeGeometry.dispose()
      bladeMaterial.dispose()
      edgeMaterial.dispose()
      flash.geometry.dispose()
      flashMaterial.dispose()
    },
  }
  painter.setPalette(palette)
  return painter
}
```

`painters.ts`: `import { createIris } from './iris'` and add `iris: createIris`. TaskBoard already passes `image={photo}` to the photo tile (Task 8), and `TileFill` turns it into an `ImageBitmap` (Task 6).

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/iris.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/iris.ts src/screens/Today/fills/painters.ts src/screens/Today/fills/__tests__/iris.test.ts
git commit -m "feat(today): the photo's iris fill, on the day's photo"
```

### Task 16: check and PR

- [ ] **Step 1:** The four checks pass.
- [ ] **Step 2:** Take a photo with Snap (the dev camera works over `npm run dev:phone`, or pick from the library). The camera sheet closes, the iris shuts, flashes and opens on the real photo in the world's colour, then the photo shrinks into the chip's thumbnail. Compare the blades' lighting with `photo-tile.html`; if they look darker or lighter, adjust the two light intensities (the ×π factor) to match.
- [ ] **Step 3:** Push, then `gh pr create --base main --title "Tile fills, part 3: Photo's iris"`. Give the owner the preview link: the camera only works on the phone.

---

# Part 4 (PR 4): Reading's book

```bash
git -C C:/Users/danie/Documents/Coding/Claude/75hard worktree add .claude/worktrees/tile-fills-4 -b feat/tile-fills-4 main
```

### Task 17: the book

**Files:**
- Create: `src/screens/Today/fills/book.ts`
- Modify: `src/screens/Today/fills/painters.ts` (add `book: createBook`)
- Test: `src/screens/Today/fills/__tests__/book.test.ts`

**Interfaces:**
- Produces: `createBook(palette): Painter`; `riffleGap(pagesToGo: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { createBook, riffleGap } from '../book'
import { fillPalette } from '../palette'

describe('book fill', () => {
  it('turns one page at the calm pace, and riffles several within about 2.5 s', () => {
    expect(riffleGap(1)).toBeCloseTo(0.99)
    expect(riffleGap(10)).toBeCloseTo(0.24)
  })

  it('turns the ten pages of "10 left", counting up as each passes the spine', () => {
    const book = createBook(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    book.setLevel(1, false)
    for (let i = 0; i < 60; i++) book.step(1 / 60, true)
    expect(book.shown()).toBeGreaterThan(0)
    expect(book.shown()).toBeLessThan(1)
    for (let i = 0; i < 60 * 5; i++) book.step(1 / 60, true)
    expect(book.shown()).toBe(1)
    expect(book.settled()).toBe(true)
    book.dispose()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/screens/Today/fills/__tests__/book.test.ts`
Expected: FAIL, no module `../book`.

- [ ] **Step 3: Implement `book.ts`**

Ported from `docs/prototypes/today-preview.html`'s `makeReading` (with the flow's changes: the page lifts at once, the riffle). The flat fill is drawn in the scene (it was a CSS div in the prototype). Page geometry is built at a unit size and reshaped every frame at the tile's size, so a resize needs nothing.

```ts
import {
  DoubleSide,
  LessEqualDepth,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { clamp01, inOut, smooth } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { QUAD_VERT } from './quad'

/** Every ruleset reads 10 pages a day (rulesets.ts). */
const PAGES = 10
/** The chosen book (docs/prototypes/README.md, Reading), lifting at once: 2.1 s of page motion. */
const TURN = 2.2
const FADE = 0.7
const BETA = 0.6
const BASE = 0.6
const BLEND = 0.8
const REACH = 0.4
const FEATHER = 18
const FILL_FROM = 0.12
const FILL_TO = 0.9
const START = 0.04
const GUTTER = 0.32
const NX = 60
const NY = 16
const D = 900
const LIGHT = new Vector3(-200, 250, 600).normalize()

/** The gap before the next page: the calm pace for one page; several at once riffle through, all landing within about 2.5 s. */
export function riffleGap(pagesToGo: number): number {
  return Math.min(TURN * 0.45, 2.4 / Math.max(1, pagesToGo))
}

const restAngle = (u: number) => BETA * (1 - smooth(clamp01(u / GUTTER)))
const GUTTER_GLSL = /* glsl */ `
  float gutterShade(float u, float depth) { float g = 1.0 - smoothstep(0.0, 0.34, u); return (g * g * 0.42 + smoothstep(0.03, 0.0, u) * 0.25) * depth; }
  float gutterLight(float u, float depth) { return smoothstep(0.1, 0.22, u) * (1.0 - smoothstep(0.22, 0.42, u)) * 0.07 * depth; }
`

const FILL_FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uFill, uFeather, uAlpha;
  uniform vec3 uMid;
  void main() {
    float x = vP.x + uSize.x * 0.5;
    float a = uFill <= 0.0 ? 0.0 : 1.0 - clamp((x - uFill) / uFeather, 0.0, 1.0);
    gl_FragColor = vec4(uMid, a * uAlpha);
  }
`

interface Page {
  geometry: PlaneGeometry
  material: ShaderMaterial
  depth: Mesh
  color: Mesh
  start: number
  t: number
}

/** Reading: an open book whose pages lift from the right, curl over the spine and fade; the tile fills a tenth per page. */
export function createBook(palette: FillPalette): Painter {
  const scene = new Scene()
  const camera = new PerspectiveCamera(10, 1, 100, 2000)
  camera.position.set(0, 0, D)
  let width = 173
  let height = 120

  const fillUniforms = { uSize: { value: new Vector2() }, uFill: { value: 0 }, uFeather: { value: FEATHER }, uAlpha: { value: 0.3 }, uMid: { value: new Vector3() } }
  const fill = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexShader: QUAD_VERT, fragmentShader: FILL_FRAG, uniforms: fillUniforms }),
  )
  fill.renderOrder = -1
  scene.add(fill)

  // The open book at rest: two halves curving down into a shaded gutter.
  const halves = [0, 1].map((flip) => {
    const geometry = new PlaneGeometry(1, 1, NX, 1)
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: { flip: { value: flip }, depth: { value: BETA / 0.6 } },
      vertexShader: 'varying float vU; uniform float flip; void main() { vU = flip > 0.5 ? 1.0 - uv.x : uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying float vU; uniform float depth; ${GUTTER_GLSL} void main() { float s = gutterShade(vU, depth), h = gutterLight(vU, depth), a = s + h; gl_FragColor = vec4(vec3(h / max(a, 0.0001)), a); }`,
    })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)
    return { geometry, material, flip }
  })
  let shapedFor = ''
  function shapeHalves() {
    const key = `${width}x${height}`
    if (key === shapedFor) return
    shapedFor = key
    const pw = width / 2
    for (const half of halves) {
      const pos = half.geometry.attributes.position
      for (let iy = 0; iy <= 1; iy++) {
        let x = 0
        let z = 0
        const y = iy === 0 ? height / 2 : -height / 2
        for (let ix = 0; ix <= NX; ix++) {
          const a = restAngle(ix / NX)
          pos.setXYZ(iy * (NX + 1) + (half.flip ? NX - ix : ix), half.flip ? -x : x, y, z)
          x += (pw / NX) * Math.cos(a)
          z += (pw / NX) * Math.sin(a)
        }
      }
      pos.needsUpdate = true
    }
  }

  // Each page draws its depth first, pushed back a hair, so a curl never blends over itself.
  const depthOnly = new MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: true, depthTest: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 })
  const front = new Vector3()
  const back = new Vector3()
  const pageMaterial = () =>
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      depthFunc: LessEqualDepth,
      side: DoubleSide,
      uniforms: {
        cFront: { value: front },
        cBack: { value: back },
        opacity: { value: 0 },
        base: { value: BASE },
        reach: { value: REACH },
        depth: { value: BETA / 0.6 },
        fillX: { value: 0 },
        feather: { value: FEATHER },
        overFill: { value: BLEND },
        L: { value: LIGHT },
      },
      vertexShader: 'varying vec3 vN; varying float vU; varying float vX; void main() { vN = normalMatrix * normal; vU = uv.x; vX = (modelMatrix * vec4(position, 1.0)).x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vN; varying float vU; varying float vX; uniform vec3 cFront, cBack, L; uniform float opacity, base, reach, depth, fillX, feather, overFill; ${GUTTER_GLSL}
        void main() {
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float d = max(dot(n, L), 0.0);
          vec3 c = (gl_FrontFacing ? cFront : cBack) * (0.62 + 0.5 * d);
          c = c * (1.0 - gutterShade(vU, depth)) + vec3(gutterLight(vU, depth));
          float b = 1.0 - base * (1.0 - smoothstep(0.0, reach, vU));
          float over = mix(1.0 - overFill, 1.0, smoothstep(fillX - feather, fillX + feather, vX));
          gl_FragColor = vec4(c, opacity * b * over);
        }`,
    })

  const active: Page[] = []
  let shown = 0
  let target = 0
  let time = 0
  let nextAt = 0
  let gap = TURN * 0.45
  let serial = 0

  const share = (page: Page) => smooth((page.t - FILL_FROM) / (FILL_TO - FILL_FROM))
  const turned = () => shown + active.reduce((sum, page) => sum + share(page), 0)

  function addPage(): Page {
    const geometry = new PlaneGeometry(1, 1, NX, NY)
    const material = pageMaterial()
    const k = ++serial
    const depth = new Mesh(geometry, depthOnly)
    depth.renderOrder = 2 * k
    depth.frustumCulled = false
    const color = new Mesh(geometry, material)
    color.renderOrder = 2 * k + 1
    color.frustumCulled = false
    scene.add(depth, color)
    return { geometry, material, depth, color, start: time, t: 0 }
  }
  function dropPage(page: Page) {
    scene.remove(page.depth, page.color)
    page.geometry.dispose()
    page.material.dispose()
  }

  // The page turns around the spine; its bottom-right corner leads and the part by the spine lags, so it curls.
  function bend(page: Page, fillX: number) {
    const pos = page.geometry.attributes.position
    const pw = width / 2
    for (let iy = 0; iy <= NY; iy++) {
      const v = 1 - iy / NY
      let x = 0
      let z = 0
      for (let ix = 0; ix <= NX; ix++) {
        const u = ix / NX
        const lead = 0.3 * u * (1 - v) + 0.12 * u
        const lag = 0.16 * (1 - smooth(clamp01(u / 0.3)))
        const e = inOut((page.t - START - lag + lead) / (1 - START - lag))
        const r = restAngle(u)
        const a = r + (Math.PI - 2 * r) * e
        pos.setXYZ(iy * (NX + 1) + ix, x, v * height - height / 2, z + 0.5)
        x += (pw / NX) * Math.cos(a)
        z += (pw / NX) * Math.sin(a)
      }
    }
    pos.needsUpdate = true
    page.geometry.computeVertexNormals()
    const u = page.material.uniforms
    u.opacity.value = 0.55 * Math.min(clamp01(page.t / 0.06), 1 - smooth((page.t - FADE) / (1 - FADE)))
    u.fillX.value = fillX
  }

  const painter: Painter = {
    setLevel(level, instant) {
      const pages = Math.round(level * PAGES)
      target = pages
      if (instant || pages < shown + active.length) {
        active.forEach(dropPage)
        active.length = 0
        shown = pages
        return
      }
      gap = riffleGap(pages - shown - active.length)
    },
    step(dt) {
      time += dt
      if (shown + active.length < target && time >= nextAt) {
        active.push(addPage())
        nextAt = time + gap
      }
      for (let k = active.length - 1; k >= 0; k--) {
        const page = active[k]
        page.t = clamp01((time - page.start) / TURN)
        if (page.t >= 1) {
          shown = Math.min(PAGES, shown + 1)
          dropPage(page)
          active.splice(k, 1)
        }
      }
      return active.length > 0 || shown < target
    },
    drifts: () => false,
    shown: () => turned() / PAGES,
    settled: () => turned() >= target - 0.02,
    render(renderer: WebGLRenderer, w, h) {
      width = w
      height = h
      camera.fov = (2 * Math.atan(h / 2 / D) * 180) / Math.PI
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      shapeHalves()
      fill.scale.set(w, h, 1)
      fill.position.z = -1
      const fillPx = (Math.min(PAGES, turned()) / PAGES) * w
      fillUniforms.uSize.value.set(w, h)
      fillUniforms.uFill.value = fillPx >= w ? w + FEATHER : fillPx
      for (const page of active) bend(page, fillPx - w / 2)
      renderer.render(scene, camera)
    },
    setPalette(p) {
      fillUniforms.uMid.value.set(...p.mid)
      front.set(...p.mid)
      back.set(...p.edge)
    },
    dispose() {
      active.forEach(dropPage)
      fill.geometry.dispose()
      ;(fill.material as ShaderMaterial).dispose()
      halves.forEach((half) => {
        half.geometry.dispose()
        half.material.dispose()
      })
      depthOnly.dispose()
    },
  }
  painter.setPalette(palette)
  return painter
}
```

In the test, `step` needs to run frames for pages to turn: `step` adds pages and advances them without `render`. That's enough, because `shown`/`settled` don't depend on geometry.

`painters.ts`: `import { createBook } from './book'` and add `book: createBook`. Every kind now has a painter.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/screens/Today/fills/__tests__/book.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (after the four checks)

```bash
git add src/screens/Today/fills/book.ts src/screens/Today/fills/painters.ts src/screens/Today/fills/__tests__/book.test.ts
git commit -m "feat(today): the reading's book fill"
```

### Task 18: check, docs and the last PR

- [ ] **Step 1:** The four checks pass.
- [ ] **Step 2:** In the browser:
  - Log a page from the reading sheet: one page turns at the calm pace after the sheet closes.
  - Tap "10 left": ten pages riffle through in about 2.5 s while the line counts 1 to 10, then the tile becomes its chip.
  - Play a whole day by hand and compare with `today-preview.html`. Check five fills at once for smoothness, and the drop to four and three tiles (widths change smoothly).
- [ ] **Step 3:** Docs:
  - In the spec, set the status to "built, PRs #… merged on …".
  - In the README's features, add a line for the tile fills.
  - In `docs/prototypes/README.md`, point "Next" to the merged PRs.
- [ ] **Step 4:** Push, then `gh pr create --base main --title "Tile fills, part 4: Reading's book"`. Give the owner the preview link and ask for the full phone check: all five fills, Reduce Motion on and off, light and dark, a late day.
