# v4 Part 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Expo app in `mobile/` that opens on the owner's iPhone in the Ember look, reads a challenge from SQLite through the shared rules, and proves that a keychain value syncs between two Apple devices.

**Architecture:** The web app's rules (`src/logic/`) become self-contained on `main`, and `mobile/` imports them through two aliases, with no copy. Data lives in SQLite behind repositories that keep the web repositories' names. A small Swift module stores values in the iCloud-synced keychain.

**Tech Stack:** Expo (current stable SDK, 56 when written), Expo Router, TypeScript, expo-sqlite (plain SQL), Jest with `jest-expo` and React Native Testing Library, oxlint, EAS Build, Swift (Expo Modules API).

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md`

## The eleven plans

The design's build order has eleven steps. Each gets its own plan, written when the one before is done, so it can name real interfaces. This is plan 1.

1. **Foundation (this plan)** · 2. Import a web backup · 3. Today · 4. Onboarding, failure, Victory · 5. Journey · 6. Gallery · 7. Stats · 8. Settings, badges, app lock · 9. Cloud backup · 10. Share card · 11. App Store

## Global Constraints

- Task 1 lands on `main` through its own branch and PR, with the four web checks (`npx tsc -b`, `npm run lint`, `npm run test`, `npm run build`). It changes no behaviour.
- Tasks 2 to 8 happen on the long-lived `v4` branch, in a git worktree at `../75hard-v4`. Never switch branches in the main checkout: other sessions share it.
- PRs into `v4` or `main` merge with `gh pr merge <n> --merge`, only when the owner asks.
- `mobile/` imports web code only through `@logic/*` (`src/logic/`) and `@schema` (`src/db/types.ts`). No other path into `../src`.
- Install Expo packages with `npx expo install <name>`, so versions match the SDK. Don't pin versions by hand.
- Before every commit in `mobile/`: `npm run check` (typecheck, lint, tests, iOS bundle) must pass.
- UI copy is English. "75 Hard" appears nowhere in the app's name, slug or bundle ID.
- iPhone only, portrait. Honour "reduce motion". Text meets 4.5:1 contrast in every world, light and dark.
- No network calls in this plan. The app works offline.
- No deadline: don't cut a check to save time.

## Needed from the owner (Task 8 only)

- An individual Apple Developer account, and an Expo account for EAS.
- A yes on the bundle ID. Proposed: `com.danielfarkas.companion`. It can never change.
- Two Apple devices on the same Apple ID, with iCloud Keychain on.

Tasks 1 to 7 need nothing from the owner.

## Review Focus

1. A row saved without its optional fields (an old-style challenge with no `variant`) reads back with the field absent (`undefined`), never `null`. The rules treat a missing `variant` as 75 Hard. → test in Task 4.
2. Opening the database a second time, or after an app update, doesn't rerun or fail a migration. → test in Task 4.
3. The database can't be opened: the app shows an error screen with the message, not a blank screen. → test in Task 7.
4. The fonts fail to load: the app still renders, in the system font. → test in Task 6.
5. The keychain holds no value (iCloud Keychain off, or a first launch): `getItem` resolves `null` and doesn't throw. → device check in Task 8.

---

### Task 1: Make the shared rules self-contained (on `main`)

Branch `refactor/shared-rules` from `main`, in its own worktree. Pure moves with re-exports, so no importer changes.

**Files:**
- Move: `src/lib/dates.ts` → `src/logic/dates.ts`; `src/lib/dates.ts` becomes `export * from '../logic/dates'`
- Move: `src/lib/worldColors.ts` → `src/logic/worldColors.ts`; the old path re-exports
- Create: `src/logic/worlds.ts`, `src/logic/theme.ts`, `src/logic/settingKeys.ts`
- Modify: `src/screens/Journey/worlds.ts`, `src/lib/worldTheme.ts`, `src/lib/theme.ts`, `src/db/repositories/settingsRepo.ts`, `src/logic/climb.ts`, and the four logic files that import `../lib/dates` (`attempts.ts`, `measurements.ts`, `restoredDays.ts`, `startDate.ts`)
- Test: `src/logic/__tests__/boundary.test.ts`

**Interfaces:**
- Produces, all importable from `src/logic/`:
  - `dates.ts`: unchanged exports (`todayISO`, `dayNumberForDate`, `addDaysISO`, …)
  - `worlds.ts`: `type WorldId`, `interface WorldSpan { id; name; firstDay; lastDay; stone }`, `WORLD_SPANS: readonly WorldSpan[]`, `worldForProgress(todayDayNumber: number | null, completed: boolean): WorldId` (moved from `src/lib/worldTheme.ts`)
  - `worldColors.ts`: unchanged exports (`WORLD_COLORS`, `SURFACE`, `contrastRatio`, `isWorldId`, `WorldPalette`)
  - `theme.ts`: `ThemePreference`, `THEME_PREFERENCES`, `isThemePreference`, `resolveTheme` (moved from `src/lib/theme.ts`)
  - `settingKeys.ts`: `SETTING_KEYS`, `DEVICE_SETTING_KEYS` (moved from `settingsRepo.ts`)
- Every old path keeps exporting the same names.

- [ ] **Step 1: Write the failing test**

```ts
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1])

describe('the shared rules stand alone', () => {
  const dir = resolve(process.cwd(), 'src/logic')
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.ts'))) {
    it(`${name} imports only its neighbours and date-fns`, () => {
      for (const path of importsOf(resolve(dir, name))) {
        expect(path === 'date-fns' || /^\.\/[A-Za-z]+$/.test(path), path).toBe(true)
      }
    })
  }

  it('the data types import only the rules', () => {
    for (const path of importsOf(resolve(process.cwd(), 'src/db/types.ts'))) {
      expect(path.startsWith('../logic/'), path).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it** — `npx vitest run src/logic/__tests__/boundary.test.ts`. Expected: FAIL on `climb.ts` (`../screens/Journey/worlds`) and the four `../lib/dates` importers.
- [ ] **Step 3: Move the files with `git mv`** and leave the one-line re-exports. `src/screens/Journey/worlds.ts` keeps `World` (a `WorldSpan` plus `cover`), builds `WORLDS` from `WORLD_SPANS` and its own cover table (heaven's file is `heaven-gates.webp`), and re-exports `WorldId`.
- [ ] **Step 4: Run the four web checks.** Expected: all pass, with the same 1148 tests plus the new file.
- [ ] **Step 5: Commit, push, open a PR into `main`.** Message: `refactor: rules stand alone, for the native app`. Ask the owner to merge.

---

### Task 2: The `v4` branch and the Expo project

**Files:**
- Create: `mobile/` (from `npx create-expo-app@latest mobile --template default`), `mobile/app.config.ts` (replaces `app.json`), `mobile/.oxlintrc.json`, `mobile/jest.config.js`, `mobile/app/__tests__/smoke.test.tsx`
- Modify: `vite.config.ts` (test `exclude` gains `'mobile/**'`), `.oxlintrc.json` (`"ignorePatterns": ["mobile"]`), `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces: `npm run check` in `mobile/`, made of `typecheck` (`tsc --noEmit`), `lint` (`oxlint`), `test` (`jest`), `bundle` (`expo export --platform ios --output-dir dist-check`, git-ignored).
- `app.config.ts`: `name: 'Companion'` (placeholder until the owner picks the name), `slug: 'companion'`, `scheme: 'companion'`, `orientation: 'portrait'`, `userInterfaceStyle: 'automatic'`, `ios: { supportsTablet: false, bundleIdentifier: 'com.danielfarkas.companion' }`.

- [ ] **Step 1: Create the branch and worktree** (after Task 1 is merged): `git worktree add ../75hard-v4 -b v4 main`, then `git push -u origin v4`.
- [ ] **Step 2: Scaffold `mobile/`**, delete the template's example screens and assets, and add `jest-expo`, `@testing-library/react-native` and `oxlint` as dev dependencies.
- [ ] **Step 3: Write the smoke test**

```tsx
import { render, screen } from '@testing-library/react-native'
import Index from '../index'

it('opens', () => {
  render(<Index />)
  expect(screen.getByText('Companion')).toBeOnTheScreen()
})
```

- [ ] **Step 4: Make `app/index.tsx` show the text "Companion"**, run `npm run check` in `mobile/`. Expected: four green steps.
- [ ] **Step 5: Run the four web checks at the repo root.** Expected: unchanged, and no file under `mobile/` is linted or tested by them.
- [ ] **Step 6: Document.** `CLAUDE.md` gains a "v4 (`mobile/`)" section: the branch, the worktree path, `npm run check`, `npx expo start` with Expo Go, and the two-alias import rule. `README.md` gains one paragraph pointing to the design.
- [ ] **Step 7: Commit** — `feat(mobile): Expo project on the v4 branch`.

---

### Task 3: The shared rules inside the app

**Files:**
- Create: `mobile/metro.config.js`
- Modify: `mobile/tsconfig.json` (`paths`), `mobile/jest.config.js` (`moduleNameMapper`, `modulePaths`), `mobile/package.json` (`date-fns`, same major as the root)
- Test: `mobile/src/__tests__/sharedRules.test.ts`, `mobile/src/__tests__/importBoundary.test.ts`

**Interfaces:**
- Produces: `@logic/<file>` → `../src/logic/<file>`, and `@schema` → `../src/db/types.ts` (types only), in TypeScript, Metro and Jest.
- Metro: `watchFolders` includes `../src`; `resolver.nodeModulesPaths` is `[mobile/node_modules]`, so `date-fns` resolves for files outside `mobile/` (on EAS only `mobile/` is installed).

- [ ] **Step 1: Write the failing tests**

```ts
import { CHALLENGE_LENGTH } from '@logic/constants'
import { dayNumberForDate } from '@logic/dates'
import { WORLD_COLORS } from '@logic/worldColors'
import type { Challenge } from '@schema'

it('runs the web app’s rules', () => {
  const challenge: Omit<Challenge, 'id'> = { startDate: '2026-01-01', attemptNumber: 1, status: 'active' }
  expect(CHALLENGE_LENGTH).toBe(75)
  expect(dayNumberForDate(challenge.startDate, '2026-01-10')).toBe(10)
  expect(WORLD_COLORS.hell.dark.canvas).toBe('#16110e')
})
```

`importBoundary.test.ts` walks `mobile/app` and `mobile/src` and fails on any import whose path contains `../src/` or starts with `@web`.

- [ ] **Step 2: Run** `npx jest src/__tests__`. Expected: FAIL, "Cannot find module '@logic/constants'".
- [ ] **Step 3: Add the aliases** in the three configs and `date-fns` to `mobile/package.json`.
- [ ] **Step 4: Show `CHALLENGE_LENGTH` on the index screen** ("75 days"), so the bundle step proves Metro resolves it. Run `npm run check`. Expected: PASS, and the bundle contains `src/logic/constants`.
- [ ] **Step 5: Commit** — `feat(mobile): import the shared rules`.

---

### Task 4: SQLite schema and migrations

**Files:**
- Create: `mobile/src/db/driver.ts`, `mobile/src/db/schema.ts`, `mobile/src/db/open.ts`, `mobile/src/db/types.ts`, `mobile/src/db/rows.ts`
- Test: `mobile/src/db/__tests__/testDb.ts`, `mobile/src/db/__tests__/fixtures.ts`, `mobile/src/db/__tests__/schema.test.ts`, `mobile/src/db/__tests__/rows.test.ts`

**Interfaces:**
- `driver.ts`: `interface Db { execAsync(sql: string): Promise<void>; runAsync(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>; getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>; getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>; withTransactionAsync(task: () => Promise<void>): Promise<void> }`. expo-sqlite's `SQLiteDatabase` already has this shape.
- `schema.ts`: `MIGRATIONS: readonly string[]`, `migrate(db: Db): Promise<void>`. It reads `PRAGMA user_version`, runs each later migration in a transaction, then sets the version.
- `open.ts`: `openAppDatabase(name?: string): Promise<Db>` (opens with `enableChangeListener: true`, then migrates), `getDb(): Db`, `setDbForTests(db: Db): void`, `subscribeToChanges(listener: () => void): () => void`.
- `types.ts`: re-exports `@schema`, except `Photo = { id: number; date: string; file: string; mimeType: string }` and `Book` with `coverFile?: string` in place of `cover?: Blob`. Photos and covers are files in the documents folder.
- `rows.ts`: `challengeFromRow(row): Challenge`, `challengeToParams(challenge: Omit<Challenge, 'id'>): unknown[]`, and helpers `optional<T>(value: T | null): T | undefined`, `fromJson<T>(text: string | null): T | undefined`, `toJson(value: unknown): string | null`.
- `testDb.ts`: `freshDb(): Promise<Db>`, an in-memory database over Node's `node:sqlite` (`DatabaseSync(':memory:')`), migrated. If Jest can't resolve `node:sqlite`, use `better-sqlite3` as a dev dependency instead. DB tests run under `/** @jest-environment node */`.
- `fixtures.ts`: `freshDatabase(): Promise<void>` (calls `setDbForTests(await freshDb())`) and `addChallenge(challenge: Omit<Challenge, 'id'>): Promise<number>`, the same names as the web fixtures.

Migration 1 (column names equal the field names, so mappers stay trivial; booleans are 0/1; objects and arrays are JSON text):

```sql
CREATE TABLE challenges (id INTEGER PRIMARY KEY AUTOINCREMENT, startDate TEXT NOT NULL, attemptNumber INTEGER NOT NULL, status TEXT NOT NULL, variant TEXT, socialDays TEXT, jokersAcknowledged INTEGER, abandonedOn TEXT, restoredDays TEXT);
CREATE TABLE dayEntries (id INTEGER PRIMARY KEY AUTOINCREMENT, challengeId INTEGER NOT NULL, date TEXT NOT NULL, dayNumber INTEGER NOT NULL, water_ml INTEGER NOT NULL, pages_read INTEGER NOT NULL, dietFollowed INTEGER NOT NULL, noAlcohol INTEGER NOT NULL, photoId INTEGER, notes TEXT, mood, plans TEXT, planEstimates TEXT, restDay INTEGER, bookId INTEGER, completed INTEGER NOT NULL, UNIQUE (challengeId, dayNumber));
CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, dayEntryId INTEGER NOT NULL, type TEXT NOT NULL, durationMin INTEGER NOT NULL, isOutdoor INTEGER NOT NULL, feel);
CREATE TABLE books (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, totalPages INTEGER NOT NULL, currentPage INTEGER NOT NULL, finished INTEGER NOT NULL, finishedAt TEXT, coverFile TEXT);
CREATE TABLE measurements (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, weight_kg REAL, bodyMeasurements_cm TEXT);
CREATE TABLE photos (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, file TEXT NOT NULL, mimeType TEXT NOT NULL);
CREATE TABLE badges (id INTEGER PRIMARY KEY AUTOINCREMENT, badgeId TEXT NOT NULL, challengeId INTEGER NOT NULL, unlockedAt TEXT NOT NULL, UNIQUE (challengeId, badgeId));
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX dayEntries_date ON dayEntries (date);
CREATE INDEX workouts_dayEntryId ON workouts (dayEntryId);
CREATE INDEX photos_date ON photos (date);
CREATE INDEX measurements_date ON measurements (date);
```

- [ ] **Step 1: Write the failing tests**

```ts
/** @jest-environment node */
import { migrate, MIGRATIONS } from '../schema'
import { challengeFromRow, challengeToParams } from '../rows'
import { freshDb } from './testDb'

it('creates the eight tables and records the version', async () => {
  const db = await freshDb()
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  expect(tables.map((table) => table.name)).toEqual(
    ['badges', 'books', 'challenges', 'dayEntries', 'measurements', 'photos', 'settings', 'workouts'],
  )
  expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length })
})

it('migrating twice changes nothing', async () => {
  const db = await freshDb()
  await expect(migrate(db)).resolves.toBeUndefined()
})

it('refuses a second entry for the same challenge day', async () => {
  const db = await freshDb()
  const insert = `INSERT INTO dayEntries (challengeId, date, dayNumber, water_ml, pages_read, dietFollowed, noAlcohol, completed) VALUES (1, '2026-01-01', 1, 0, 0, 0, 0, 0)`
  await db.runAsync(insert)
  await expect(db.runAsync(insert)).rejects.toThrow(/UNIQUE/)
})

it('an old-style challenge reads back without its optional fields', async () => {
  const db = await freshDb()
  const INSERT = 'INSERT INTO challenges (startDate, attemptNumber, status, variant, socialDays, jokersAcknowledged, abandonedOn, restoredDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  await db.runAsync(INSERT, challengeToParams({ startDate: '2026-01-01', attemptNumber: 1, status: 'active' }))
  const challenge = challengeFromRow(await db.getFirstAsync('SELECT * FROM challenges'))
  expect(challenge).toEqual({ id: 1, startDate: '2026-01-01', attemptNumber: 1, status: 'active' })
  expect('variant' in challenge).toBe(false)
})

it('keeps a challenge’s lists', async () => {
  const full = { startDate: '2026-01-01', attemptNumber: 2, status: 'active', variant: 'soft', socialDays: [3, 9], jokersAcknowledged: 1, restoredDays: [4] } as const
  // insert with challengeToParams, read with challengeFromRow
  // expect: { id: 1, ...full }
})
```

- [ ] **Step 2: Run** `npx jest src/db`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the five files and `testDb.ts`.** Install expo-sqlite with `npx expo install expo-sqlite`. `challengeFromRow` leaves out every field whose column is `NULL`.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(mobile): SQLite schema and migrations`.

---

### Task 5: The first repositories and live queries

**Files:**
- Create: `mobile/src/db/repositories/settingsRepo.ts`, `mobile/src/db/repositories/challengeRepo.ts`, `mobile/src/db/useLiveQuery.ts`
- Test: `mobile/src/db/repositories/__tests__/settingsRepo.test.ts`, `…/challengeRepo.test.ts`, `mobile/src/db/__tests__/useLiveQuery.test.tsx`

**Interfaces:**
- Consumes: `getDb`, `subscribeToChanges` (Task 4); `SETTING_KEYS` from `@logic/settingKeys` (Task 1).
- `settingsRepo`: `get<T>(key: string, defaultValue: T): Promise<T>`, `set(key: string, value: unknown): Promise<void>`. Values are stored as JSON.
- `challengeRepo`: `getActiveChallenge()`, `getCurrent()`, `getById(id)`, `getAll()`, `bootstrapIfEmpty(startDate)`, `startNew(startDate, variant)`, with the signatures and behaviour of `src/db/repositories/challengeRepo.ts`. The other seven methods arrive with the screens that need them (plans 3 and 4).
- `useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined`. `undefined` while the first read runs; it reruns when the database changes or `deps` change. Same name as `dexie-react-hooks`, so the web hooks port line by line.

- [ ] **Step 1: Port the tests.** Copy the cases for these six methods from `src/db/repositories/__tests__/challengeRepo.test.ts` and the settings cases, switching `vitest` to Jest globals and the fixtures to `mobile/src/db/__tests__/fixtures.ts`. Add:

```ts
it('a setting keeps its type', async () => {
  await settingsRepo.set(SETTING_KEYS.bedtime, '22:30')
  await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
  expect(await settingsRepo.get(SETTING_KEYS.bedtime, '23:00')).toBe('22:30')
  expect(await settingsRepo.get(SETTING_KEYS.soundEnabled, true)).toBe(false)
  expect(await settingsRepo.get('missing', 7)).toBe(7)
})

it('rereads when the database changes', async () => {
  // mock ../open so subscribeToChanges captures the listener
  // render a component showing useLiveQuery(() => challengeRepo.getAll(), []).length
  // expect "0", then startNew(...) and call the captured listener, expect "1"
})
```

- [ ] **Step 2: Run** `npx jest src/db`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the three files.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(mobile): settings and challenge repositories, live queries`.

---

### Task 6: The Ember theme and fonts

**Files:**
- Create: `mobile/src/theme/tokens.ts`, `mobile/src/theme/ThemeProvider.tsx`, `mobile/src/theme/fonts.ts`
- Test: `mobile/src/theme/__tests__/tokens.test.ts`, `…/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: `WORLD_COLORS`, `SURFACE`, `contrastRatio` (`@logic/worldColors`), `resolveTheme`, `ThemePreference` (`@logic/theme`), `worldForProgress`, `WorldId` (`@logic/worlds`), `settingsRepo`, `challengeRepo`.
- `tokens.ts`: `BASE_COLORS: { light: Record<BaseColor, string>; dark: Record<BaseColor, string> }` holds every `--color-*` of the `@theme` and `.dark` blocks of `src/styles/index.css` that isn't a world colour, with camelCase names (`inkMuted`, `greenDark`). `colorsFor(world: WorldId, mode: 'light' | 'dark')` returns `BASE_COLORS[mode]` plus `world`, `worldEdge`, `worldInk`, `worldSoft`, `canvas`, `onWorld` from `WORLD_COLORS`.
- `fonts.ts`: `FONTS = { rounded, display, quote }` as font family names, and `useAppFonts(): 'loading' | 'ready' | 'failed'`. The families and weights are the ones `--font-rounded`, `--font-display` and `--font-quote` use on the web (DM Sans, Barlow Condensed, Fraunces), from the `@expo-google-fonts/*` packages.
- `ThemeProvider.tsx`: `<ThemeProvider>` and `useTheme(): { mode: 'light' | 'dark'; world: WorldId; colors: ReturnType<typeof colorsFor>; fonts: typeof FONTS }`. The mode comes from the `theme` setting and the phone's appearance; the world from the current challenge's day. When fonts failed, `fonts` holds `undefined` families, which React Native renders in the system font.

- [ ] **Step 1: Write the failing tests**

```ts
// tokens.test.ts — reads ../src/styles/index.css with fs, as src/lib/__tests__/brandColors.test.ts does
it.each(['light', 'dark'] as const)('%s base colours equal the web tokens', (mode) => {
  // for every `--color-<name>: #rrggbb;` in the block ('@theme' for light, '.dark' for dark)
  // that BASE_COLORS has: expect(BASE_COLORS[mode][camel(name)]).toBe(hex)
  // and expect at least 20 tokens were compared
})

it.each(WORLD_SPANS.flatMap((span) => [[span.id, 'light'], [span.id, 'dark']] as const))(
  '%s %s text meets 4.5:1',
  (world, mode) => {
    const colors = colorsFor(world, mode)
    for (const background of [colors.surface, colors.canvas, colors.worldSoft]) {
      expect(contrastRatio(colors.worldInk, background)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio(colors.onWorld, colors.world)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.ink, colors.canvas)).toBeGreaterThanOrEqual(4.5)
  },
)
```

```tsx
// ThemeProvider.test.tsx
it('follows the saved theme over the phone’s', async () => {
  // phone appearance mocked to 'light', settingsRepo theme = 'dark', no challenge
  // expect useTheme() → mode 'dark', world 'hell', colors.canvas '#16110e'
})

it('still renders when the fonts fail', async () => {
  // useAppFonts mocked to 'failed'
  // expect the child text to be on the screen
})
```

- [ ] **Step 2: Run** `npx jest src/theme`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the three files.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(mobile): Ember theme and fonts`.

---

### Task 7: The app shell

**Files:**
- Create: `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx` (Today), `journey.tsx`, `gallery.tsx`, `stats.tsx`, `settings.tsx`, `mobile/src/components/DatabaseError.tsx`, `mobile/src/dev/seed.ts`
- Delete: the Task 2 placeholder index and its smoke test
- Test: `mobile/app/__tests__/shell.test.tsx`

**Interfaces:**
- Consumes: `openAppDatabase`, `useLiveQuery`, `challengeRepo`, `ThemeProvider`, `useTheme`, `useAppFonts`, `dayNumberForDate`, `todayISO`, `addDaysISO`, `CHALLENGE_LENGTH`.
- `_layout.tsx`: opens the database, then renders the tabs inside `ThemeProvider`. While opening or loading fonts the splash screen stays. If opening throws, it renders `<DatabaseError message>`: "Your data couldn't be opened." and the error's message.
- Tabs: the same five, in the same order and with the same labels and icons as `src/components/ui/BottomNav.tsx`. Each screen is a placeholder: its title in the display font, on the world's canvas, inside the safe area.
- Today placeholder: "Day 12 of 75" for the current challenge, or "No challenge yet".
- `seed.ts`: `seedDay(day: number): Promise<void>` clears the tables and starts a 75 Hard attempt whose Day `day` is today. The Settings placeholder shows a "Seed Day 12" button when `__DEV__` is true.

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows the day of the current challenge', async () => {
  await freshDatabase()
  await seedDay(12)
  render(<TodayScreen />, { wrapper: Providers })
  expect(await screen.findByText('Day 12 of 75')).toBeOnTheScreen()
})

it('says so when there is no challenge', async () => {
  await freshDatabase()
  render(<TodayScreen />, { wrapper: Providers })
  expect(await screen.findByText('No challenge yet')).toBeOnTheScreen()
})

it('shows an error screen when the database can’t open', async () => {
  // openAppDatabase mocked to reject with new Error('disk full')
  render(<RootLayout />)
  expect(await screen.findByText("Your data couldn't be opened.")).toBeOnTheScreen()
  expect(screen.getByText('disk full')).toBeOnTheScreen()
})
```

- [ ] **Step 2: Run** `npx jest app`. Expected: FAIL.
- [ ] **Step 3: Implement the shell.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Try it on the phone.** `npx expo start`, and give the owner the QR code for Expo Go. Expected on the iPhone: five tabs in the Ember look, "No challenge yet", then "Day 12 of 75" after "Seed Day 12", still there after closing and reopening the app. Check dark and light.
- [ ] **Step 6: Commit** — `feat(mobile): app shell with five tabs`.

---

### Task 8: The synced keychain, on two devices

Blocked until the owner has the Apple Developer account, the Expo account, and has agreed to the bundle ID.

**Files:**
- Create: `mobile/modules/synced-keychain/` (from `npx create-expo-module@latest --local synced-keychain`), keeping `ios/SyncedKeychainModule.swift`, `index.ts`, `expo-module.config.json`; `mobile/eas.json`; `mobile/app/dev/keychain.tsx`; `mobile/jest.setup.ts` (mocks the module with an in-memory map)
- Test: `mobile/modules/synced-keychain/__tests__/api.test.ts`

**Interfaces:**
- Produces, from `mobile/modules/synced-keychain`: `setItem(key: string, value: string): Promise<void>`, `getItem(key: string): Promise<string | null>`, `removeItem(key: string): Promise<void>`. iOS only.
- `eas.json` profiles: `development` (`developmentClient: true`, `distribution: 'internal'`), `preview` (`distribution: 'internal'`), `production`.

The Swift can't be compiled on the owner's Windows PC, so it's given in full:

```swift
import ExpoModulesCore
import Security

public class SyncedKeychainModule: Module {
  private let service = (Bundle.main.bundleIdentifier ?? "app") + ".synced"

  private func query(_ key: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
      kSecAttrSynchronizable as String: true,
    ]
  }

  public func definition() -> ModuleDefinition {
    Name("SyncedKeychain")

    AsyncFunction("setItem") { (key: String, value: String) in
      SecItemDelete(self.query(key) as CFDictionary)
      var item = self.query(key)
      item[kSecValueData as String] = Data(value.utf8)
      item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      let status = SecItemAdd(item as CFDictionary, nil)
      guard status == errSecSuccess else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain write failed (\(status))")
      }
    }

    AsyncFunction("getItem") { (key: String) -> String? in
      var item = self.query(key)
      item[kSecReturnData as String] = true
      item[kSecMatchLimit as String] = kSecMatchLimitOne
      var result: AnyObject?
      let status = SecItemCopyMatching(item as CFDictionary, &result)
      if status == errSecItemNotFound { return nil }
      guard status == errSecSuccess, let data = result as? Data else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain read failed (\(status))")
      }
      return String(data: data, encoding: .utf8)
    }

    AsyncFunction("removeItem") { (key: String) in
      let status = SecItemDelete(self.query(key) as CFDictionary)
      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain delete failed (\(status))")
      }
    }
  }
}
```

- [ ] **Step 1: Write the test** against the Jest mock, so later plans can rely on the contract:

```ts
it('gives null for a key that was never set', async () => {
  expect(await getItem('missing')).toBeNull()
})

it('reads back what was written, and forgets what was removed', async () => {
  await setItem('k', 'v1')
  await setItem('k', 'v2')
  expect(await getItem('k')).toBe('v2')
  await removeItem('k')
  expect(await getItem('k')).toBeNull()
})
```

- [ ] **Step 2: Create the module, the mock and the dev screen.** `app/dev/keychain.tsx` (reachable from the Settings placeholder when `__DEV__`) shows the stored value on opening, and has "Write the time", "Read" and "Remove" buttons. A thrown error shows as text on the screen.
- [ ] **Step 3: Run** `npm run check`. Expected: PASS.
- [ ] **Step 4: Build for the phone.** With the owner: `eas login`, `eas init`, `eas device:create` for both devices, then `eas build --profile development --platform ios`. Expected: a build that installs on both.
- [ ] **Step 5: The two-device check.** Record each result in the spec's status line.
  1. Device A, first launch: the screen shows "No value". No error.
  2. Device A: "Write the time". Device B, a few minutes later: "Read" shows the same time.
  3. Device A: delete the app, reinstall, open: the value is still there.
  4. Device B with iCloud Keychain switched off, after "Remove" on A: "Read" shows "No value". No error.
- [ ] **Step 6: Commit** — `feat(mobile): iCloud-synced keychain module and EAS builds`. Push `v4` (it's the working branch, so no PR). Then write plan 2.

---

## Done when

- `main` has the self-contained rules, and its four checks pass.
- On `v4`, `npm run check` passes in `mobile/`.
- The owner has seen the shell on their iPhone in Expo Go.
- The two-device keychain check passed, or its failure is written down with what was seen.
