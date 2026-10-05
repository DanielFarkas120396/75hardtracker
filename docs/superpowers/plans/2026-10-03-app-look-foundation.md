# App look, part 1 (foundation): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Journey world you're in (hell → heaven) colours the whole app. This part adds the world tokens, the display font, the icon set, the floating nav bar, and restyles the shared UI.

**Architecture:**
- A `data-world` attribute on `<html>` picks one of six CSS token blocks. Each has a light version and a `.dark` version, so screens only use token names (`bg-world`, `text-world-ink`, …).
- The colour values live once, in TypeScript (`WORLD_COLORS`). Tests check them for contrast, and check that `index.css` and the no-flash script in `index.html` match them.
- A `useWorldTheme` hook in `MainApp` sets the attribute from the challenge gate.

**Tech stack:** React 19, Vite 8, Tailwind v4 (`@theme`), vitest + jsdom + Testing Library, oxlint, `@fontsource/lilita-one` 5.3.0.

**Spec:** `docs/superpowers/specs/2026-10-03-app-look-design.md` (Part 1).

## Global constraints

- **Branches:** the work goes on `design/app-look`, as a PR into `v2` (`--base v2`), never into `main`.
- **Contrast:** every world, in light and dark:
  - `world-ink` ≥ 4.5:1 on surface (`#ffffff` light, `#1f2426` dark), on `canvas` and on `world-soft`
  - `on-world` ≥ 4.5:1 on `world`
- **Colour values:** exactly the spec's table (copied into Task 1).
- **Brand colours keep their meaning:** water blue, streak orange, XP yellow, danger red. Journey's own colours don't change.
- **Lilita One:** only for screen titles and big numbers, at weight 400 (no faux bold).
- **iPhone PWA:** touch only, so no hover-only states; respect safe areas.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Files

| File | Role |
|---|---|
| `src/lib/worldColors.ts` (new) | `WORLD_COLORS`, `SURFACE`, `isWorldId`, `contrastRatio` |
| `src/lib/worldTheme.ts` (new) | `WORLD_STORAGE_KEY`, `worldForProgress`, `applyWorld` |
| `src/hooks/useWorldTheme.ts` (new) | applies the world from `MainApp` |
| `src/lib/theme.ts` | the theme-color meta follows the world's canvas (`syncThemeColor`) |
| `index.html` | the no-flash script also sets `data-world` and the world canvas |
| `src/styles/index.css` | world tokens, `--font-display`, Lilita import |
| `src/components/icons/Icon.tsx` (new) | the icon set |
| `src/components/ui/BottomNav.tsx` | floating bar |
| `Button.tsx`, `Card.tsx`, `ProgressRing.tsx`, `Toggle.tsx`, `Stepper.tsx` | world colours |
| screen `<h1>`s, `pb-24` paddings | display font, room for the floating bar |
| `vite.config.ts` | precache the Lilita woff2 |
| Tests (new) | `src/lib/__tests__/worldColors.test.ts`, `worldTheme.test.ts`; `src/components/__tests__/Icon.test.tsx`, `BottomNav.test.tsx` |

---

### Task 1: World colour data and the contrast test

**Files:** create `src/lib/worldColors.ts` and `src/lib/__tests__/worldColors.test.ts`.

**Produces:**
- `WorldPalette = { world, edge, ink, soft, canvas, onWorld }` (hex strings)
- `WORLD_COLORS: Record<WorldId, { light: WorldPalette; dark: WorldPalette }>`
- `SURFACE = { light: '#ffffff', dark: '#1f2426' }`
- `isWorldId(v): v is WorldId`
- `contrastRatio(a: string, b: string): number`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { WORLDS } from '../../screens/Journey/worlds'
import { contrastRatio, isWorldId, SURFACE, WORLD_COLORS } from '../worldColors'

describe('contrastRatio', () => {
  it('matches the WCAG formula at its ends', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1)
  })
})

describe('WORLD_COLORS', () => {
  it('has a palette for every Journey world', () => {
    expect(Object.keys(WORLD_COLORS).sort()).toEqual(WORLDS.map((w) => w.id).sort())
    expect(isWorldId('heaven')).toBe(true)
    expect(isWorldId('mars')).toBe(false)
  })

  for (const mode of ['light', 'dark'] as const) {
    it.each(WORLDS.map((w) => w.id))(`keeps text readable in %s (${mode})`, (id) => {
      const p = WORLD_COLORS[id][mode]
      for (const bg of [SURFACE[mode], p.canvas, p.soft]) expect(contrastRatio(p.ink, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.onWorld, p.world)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/worldColors.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implementation**

```ts
import type { WorldId } from '../screens/Journey/worlds'

/** One world's colours in one theme. Mirrored as CSS tokens in src/styles/index.css. */
export interface WorldPalette {
  world: string
  edge: string
  ink: string
  soft: string
  canvas: string
  onWorld: string
}

export const SURFACE = { light: '#ffffff', dark: '#1f2426' } as const

const p = (world: string, edge: string, ink: string, soft: string, canvas: string, onWorld: string): WorldPalette => ({
  world, edge, ink, soft, canvas, onWorld,
})

export const WORLD_COLORS: Record<WorldId, { light: WorldPalette; dark: WorldPalette }> = {
  hell: { light: p('#cb4a1b', '#9e3915', '#b33a12', '#fde6dc', '#fdf6f3', '#ffffff'), dark: p('#ff6a2a', '#c65220', '#ff8a5a', '#3a1812', '#1a1211', '#1f2426') },
  wasteland: { light: p('#807266', '#63584f', '#6b5d52', '#efe9e3', '#f8f6f3', '#ffffff'), dark: p('#b3a598', '#8b8076', '#cbbfb3', '#2e2824', '#171513', '#1f2426') },
  forest: { light: p('#2f7d4f', '#24613d', '#22643c', '#dcefe2', '#f4f9f5', '#ffffff'), dark: p('#4fae74', '#3d875a', '#6fd093', '#16301f', '#111815', '#1f2426') },
  meadow: { light: p('#368532', '#2a6727', '#2f7a2b', '#e1f2d6', '#f6fbf1', '#ffffff'), dark: p('#6cc35e', '#549849', '#8fdc80', '#1e3418', '#121811', '#1f2426') },
  mountains: { light: p('#3279ae', '#275e87', '#1f6aa3', '#dfeefa', '#f4f8fc', '#ffffff'), dark: p('#7cc0f0', '#6095bb', '#9fd2f7', '#1c2a38', '#10161c', '#1f2426') },
  heaven: { light: p('#d9a521', '#a98019', '#8a6100', '#fbf0cf', '#fdfaf0', '#1f2426'), dark: p('#f3c23a', '#bd972d', '#ffd76a', '#3a3017', '#17150e', '#1f2426') },
}

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && Object.hasOwn(WORLD_COLORS, value)
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
```

- [ ] **Step 4:** run the test again → PASS.
- [ ] **Step 5:** commit `feat(v2): world colour palettes, contrast-checked`.

### Task 2: CSS world tokens

**Files:** modify `src/styles/index.css`, and add to `src/lib/__tests__/worldColors.test.ts`.

**Consumes:** `WORLD_COLORS`.

**Produces:** Tailwind utilities `bg-world`, `border-world-edge`, `text-world-ink`, `bg-world-soft`, `text-on-world`, plus the per-world `canvas`.

- [ ] **Step 1: Failing test.** Add to the test file:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TOKENS = { world: 'world', edge: 'world-edge', ink: 'world-ink', soft: 'world-soft', onWorld: 'on-world', canvas: 'canvas' } as const

describe('index.css', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    expect(start, selector).toBeGreaterThanOrEqual(0)
    return css.slice(start, css.indexOf('}', start))
  }

  it.each(WORLDS.map((w) => w.id))('defines the %s tokens in both themes, matching WORLD_COLORS', (id) => {
    for (const mode of ['light', 'dark'] as const) {
      const body = block(`${mode === 'dark' ? '.dark' : ''}[data-world='${id}']`)
      for (const [key, token] of Object.entries(TOKENS)) {
        expect(body).toContain(`--color-${token}: ${WORLD_COLORS[id][mode][key as keyof typeof TOKENS]};`)
      }
    }
  })
})
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implementation.**
  - In `@theme`, add hell-light defaults: `--color-world: #cb4a1b; --color-world-edge: #9e3915; --color-world-ink: #b33a12; --color-world-soft: #fde6dc; --color-on-world: #ffffff;`, and set `--color-canvas: #fdf6f3`.
  - In `.dark`, add the hell-dark values, with `--color-canvas: #1a1211`.
  - After `.dark`, add one `[data-world='<id>'] { … }` block and one `.dark[data-world='<id>'] { … }` block for each of the six worlds. Each block holds all six tokens, in the form `--color-<token>: <value>;`. The `.dark[...]` blocks (specificity 0,2,0) win over the light ones.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat(v2): world colour tokens in CSS`.

### Task 3: Applying the world

**Files:**
- create `src/lib/worldTheme.ts`, `src/hooks/useWorldTheme.ts`, `src/lib/__tests__/worldTheme.test.ts`
- modify `src/lib/theme.ts`, `index.html`, `src/App.tsx`, `src/lib/__tests__/theme.test.ts`

**Produces:**
- `WORLD_STORAGE_KEY = '75hard-world'`
- `worldForProgress(todayDayNumber: number | null, completed: boolean): WorldId`
- `applyWorld(world: WorldId): void`
- `syncThemeColor(): void`
- `useWorldTheme(world: WorldId | undefined): void`

- [ ] **Step 1: Failing tests** in `worldTheme.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorldTheme } from '../../hooks/useWorldTheme'
import { applyTheme } from '../theme'
import { WORLD_COLORS } from '../worldColors'
import { applyWorld, WORLD_STORAGE_KEY, worldForProgress } from '../worldTheme'

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="" media="(prefers-color-scheme: dark)">`
  document.documentElement.removeAttribute('data-world')
  localStorage.clear()
})

const metaColors = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'))

describe('worldForProgress', () => {
  it('follows the Journey worlds day by day', () => {
    expect(worldForProgress(1, false)).toBe('hell')
    expect(worldForProgress(11, false)).toBe('wasteland')
    expect(worldForProgress(23, false)).toBe('forest')
    expect(worldForProgress(65, false)).toBe('heaven')
  })
  it('stays in hell before the start, with no attempt, or with a broken date; victory is heaven', () => {
    expect(worldForProgress(-3, false)).toBe('hell')
    expect(worldForProgress(null, false)).toBe('hell')
    expect(worldForProgress(Number.NaN, false)).toBe('hell')
    expect(worldForProgress(75, true)).toBe('heaven')
  })
})

describe('applyWorld', () => {
  it('sets data-world, remembers it, and paints the browser chrome with the world canvas', () => {
    applyTheme('light')
    applyWorld('forest')
    expect(document.documentElement.dataset.world).toBe('forest')
    expect(localStorage.getItem(WORLD_STORAGE_KEY)).toBe('forest')
    expect(metaColors()).toEqual([WORLD_COLORS.forest.light.canvas, WORLD_COLORS.forest.light.canvas])
  })
})

describe('useWorldTheme', () => {
  it('updates when the day moves into a new world, and waits while the world is unknown', () => {
    const { rerender } = renderHook(({ world }) => useWorldTheme(world), { initialProps: { world: undefined as 'hell' | 'wasteland' | undefined } })
    expect(document.documentElement.dataset.world).toBeUndefined()
    rerender({ world: 'hell' })
    expect(document.documentElement.dataset.world).toBe('hell')
    rerender({ world: 'wasteland' })
    expect(document.documentElement.dataset.world).toBe('wasteland')
  })
})

describe('index.html no-flash script', () => {
  it('knows every world canvas, in light and dark', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    for (const [id, { light, dark }] of Object.entries(WORLD_COLORS)) {
      expect(html).toContain(`${id}: ['${light.canvas}', '${dark.canvas}']`)
    }
    expect(html).toContain(`'${WORLD_STORAGE_KEY}'`)
  })
})
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implementation.**

`src/lib/worldTheme.ts`:

```ts
import { worldForDay, type WorldId } from '../screens/Journey/worlds'
import { syncThemeColor } from './theme'

/** localStorage mirror of the current world, read by the no-flash script in index.html. */
export const WORLD_STORAGE_KEY = '75hard-world'

/**
 * The world whose colours the app wears: the current attempt's day. Before
 * the start, with no attempt or a broken date, that's hell; after victory, heaven.
 */
export function worldForProgress(todayDayNumber: number | null, completed: boolean): WorldId {
  if (completed) return 'heaven'
  if (todayDayNumber === null || !Number.isFinite(todayDayNumber) || todayDayNumber < 1) return 'hell'
  return worldForDay(todayDayNumber).id
}

/** Sets the world on <html> (its CSS tokens follow), remembers it, and syncs the browser chrome. */
export function applyWorld(world: WorldId): void {
  document.documentElement.dataset.world = world
  try {
    localStorage.setItem(WORLD_STORAGE_KEY, world)
  } catch {
    // Storage can be unavailable; the world still applies this session.
  }
  syncThemeColor()
}
```

`src/hooks/useWorldTheme.ts`:

```ts
import { useEffect } from 'react'
import type { WorldId } from '../screens/Journey/worlds'
import { applyWorld } from '../lib/worldTheme'

/** Keeps <html data-world> on the given world. While it's unknown (loading), the no-flash script's choice stays. */
export function useWorldTheme(world: WorldId | undefined): void {
  useEffect(() => {
    if (world) applyWorld(world)
  }, [world])
}
```

In `src/lib/theme.ts`:
- Delete `THEME_COLORS`.
- `applyTheme` stores `root.dataset.themePreference = preference` and calls `syncThemeColor()` instead of its own meta loop.
- Add:

```ts
/** Paints the theme-color metas with the current world's canvas: per meta media query under "system", else the forced theme. */
export function syncThemeColor(): void {
  const root = document.documentElement
  const preference = isThemePreference(root.dataset.themePreference) ? root.dataset.themePreference : 'system'
  const colors = WORLD_COLORS[isWorldId(root.dataset.world) ? root.dataset.world : 'hell']
  const theme = resolveTheme(preference, systemPrefersDark())
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const ownScheme = (meta.getAttribute('media') ?? '').includes('dark') ? 'dark' : 'light'
    meta.content = colors[preference === 'system' ? ownScheme : theme].canvas
  }
}
```

- `theme.test.ts`: the expected meta colours become hell's canvases (`#fdf6f3` / `#1a1211`), and `beforeEach` also removes `data-world`.
- `index.html`:
  - set the static metas to `#fdf6f3` and `#1a1211`
  - the script reads `localStorage.getItem('75hard-world')` and falls back to `hell` when the value isn't in its canvas map. The map is written in the form `hell: ['#fdf6f3', '#1a1211'],` for each world.
  - it sets `data-world`, and sets each meta to the world canvas: its own scheme under `system`, else the forced one.
- `src/App.tsx` (`MainApp`): before `if (!gate) return`, add `useWorldTheme(gate ? worldForProgress(gate.todayDayNumber, gate.kind === 'completed') : undefined)`.
- [ ] **Step 4:** `npx vitest run src/lib` → PASS.
- [ ] **Step 5:** commit `feat(v2): the app wears the current Journey world`.

### Task 4: Display font

**Files:** `package.json`, `src/styles/index.css`, `vite.config.ts`, and the screen `<h1>`s:
- `TodayScreen:89`, `PreStartView:36,43`, `StatsScreen:29`, `GalleryScreen:13`, `SettingsScreen:44`, `JourneyScreen:57`, `VictoryScreen:62`, `DayCompleteCelebration:45`, `GateHeading:16`

- [ ] `npm install @fontsource/lilita-one@^5.3.0`
- [ ] In `index.css`:
  - add `@import "@fontsource/lilita-one/400.css";`
  - in `@theme`, add `--font-display: "Lilita One", "Nunito", ui-rounded, system-ui, -apple-system, sans-serif;`
- [ ] In `vite.config.ts`, add `'**/lilita-one-latin-*.woff2'` to `globPatterns`.
- [ ] In each h1 listed, replace `font-rounded … font-extrabold` with `font-display font-normal tracking-wide`, keeping the size and colour.
- [ ] `npm run build`, then check that `dist/sw.js` lists a `lilita-one-latin` woff2.
- [ ] Commit `feat(v2): Lilita One for screen titles`.

### Task 5: Icon set

**Files:** create `src/components/icons/Icon.tsx` and `src/components/__tests__/Icon.test.tsx`.

**Produces:**
- `IconName` = `'workout' | 'diet' | 'water' | 'reading' | 'photo' | 'streak' | 'xp' | 'journey' | 'today' | 'stats' | 'gallery' | 'settings' | 'lock' | 'plus' | 'minus' | 'close' | 'chevron' | 'joker'`
- `ICON_NAMES: readonly IconName[]`
- `Icon({ name, size = 24, label?, className? })`

- [ ] **Failing test:**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, ICON_NAMES } from '../icons/Icon'

describe('Icon', () => {
  it.each(ICON_NAMES)('draws %s in the current colour, hidden from screen readers', (name) => {
    const { container } = render(<Icon name={name} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg.childElementCount).toBeGreaterThan(0)
  })

  it('is announced when given a label', () => {
    render(<Icon name="water" label="Water" />)
    expect(screen.getByRole('img', { name: 'Water' })).toBeInTheDocument()
  })
})
```

- [ ] **Implementation:**
  - The SVG uses `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, round caps and joins.
  - Its parts come from a `Record<IconName, ReactNode>`. Soft fills use `fill="currentColor" fillOpacity={0.18}`.
  - With a label: `role="img"` and `aria-label`. Without one: `aria-hidden="true"`.
  - Use the shapes drafted for this plan: dumbbell, leaf, drop, book, camera, flame, star, flag, check-circle, bar chart, stacked photos, gear, padlock, plus, minus, cross, chevron-right, card with a star.
- [ ] Run → PASS. Commit `feat(v2): custom icon set`.

### Task 6: Floating nav bar

**Files:** modify `src/components/ui/BottomNav.tsx`, `TodayScreen:80`, `StatsScreen:25`, `GalleryScreen:11`, `SettingsScreen:42`, `PreStartView:27` and `JourneyScreen:53`; create `src/components/__tests__/BottomNav.test.tsx`.

- [ ] **Failing test:**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from '../ui/BottomNav'

describe('BottomNav', () => {
  it('marks the active tab and switches on tap', () => {
    const onChange = vi.fn()
    render(<BottomNav active="stats" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Stats' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current')
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }))
    expect(onChange).toHaveBeenCalledWith('gallery')
  })
})
```

- [ ] **Implementation:**
  - `TABS` gets `icon: IconName`: `today`, `journey`, `stats`, `gallery`, `settings`.
  - The nav:
    - `fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[26rem] gap-1 rounded-[1.75rem] bg-surface p-1.5`
    - a soft shadow, plus `ring-1 ring-ink/5` (`dark:ring-white/5`)
    - `aria-label="Main"`
  - Each tab: `rounded-[1.25rem]`; active gets `bg-world-soft text-world-ink`, the others `text-ink-muted`; the icon at 22px.
- [ ] **Paddings:**
  - `pb-24` → `pb-28` on the five screens
  - Journey: `pb-[calc(5.25rem+env(safe-area-inset-bottom))]`
- [ ] Run → PASS. Commit `feat(v2): floating nav bar with world pill`.

### Task 7: Shared UI in the world colour

**Files:** `Button.tsx`, `Card.tsx`, `ProgressRing.tsx`, `Toggle.tsx`, `Stepper.tsx`, `WorkoutCard.tsx:135`.

- [ ] **Button** `primary`: `bg-world border-world-edge text-on-world`.
- [ ] **Card:**
  - the not-done state gets `border-transparent ring-1 ring-ink/10 dark:ring-0` (a hairline in light only)
  - done: `border-world`
  - the check badge and the cheer: `bg-world text-on-world`
  - the burst's first colour: `var(--color-world)`
- [ ] **ProgressRing:** defaults `color = 'var(--color-world)'`, `trackColor = 'var(--color-world-soft)'`, `strokeWidth = 10`.
- [ ] **Toggle:** `activeColor?: 'world' | 'blue'`, defaulting to `'world'` → `bg-world-ink` (≥ 3:1 for UI; blue stays for water/outdoor).
- [ ] **Stepper:** the + button → `border-world-edge bg-world text-on-world`.
- [ ] `npm test` → all pass. Commit `feat(v2): buttons, cards, rings, toggles and steppers wear the world`.

### Task 8: Wrap-up

- [ ] `npm test`, `npm run lint` and `npm run build` are all green.
- [ ] Browser check through `preview_start dev`: Today, Stats, Gallery and Settings, in hell and heaven, light and dark.
  - Set the world with `applyWorld` from the console, or with seeded data via `?db=` and `src/dev/scenarios.ts`.
- [ ] `git push -u origin design/app-look`, then `gh pr create --base v2`.
- [ ] Start `dev-lan`, find the Wi-Fi IP, and send a QR code of `http://<ip>:5173`.
