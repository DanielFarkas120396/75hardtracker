# 75 Hard Companion

A mobile-first, installable, local-first PWA for tracking the 75 Hard challenge — workouts, diet, water, reading and progress photos — with a Duolingo-style Journey map, XP, streaks and badges.

No backend: all data (including photos) lives in the browser via IndexedDB (Dexie), and can be exported/imported as a single JSON file.

## Features

- **Today** — the five daily tasks: two workouts of 45+ minutes (one outdoors), diet and no alcohol, 3.8 L of water, 10 pages of reading, and a progress photo. Each card celebrates when it's done, and the mascot counts the day down. Mood and notes are optional and don't affect completion.
- **Strict rules** — a day only completes with all five tasks. A missed day ends the attempt: the app shows what was missed and restarts from Day 1 once you confirm. The start date can be today or later, and it's locked from Day 2.
- **Journey** — all 75 days on a winding path; future days are locked.
- **XP, streaks and badges** — 10 XP per task, +25 for a perfect day, +100 at streaks of 7, 14, 21, 30, 50 and 75. A full-screen celebration for each completed day, and a victory screen after Day 75.
- **Stats** — totals for the attempt, plus weight and body measurements with a weight chart.
- **Gallery** — every progress photo across all attempts.
- **Settings** — start date, books, badges, attempt history (days and photos of every past attempt), sound and haptics, light/dark/system theme, installing the app, and backup & storage.
- **Installable and offline** — a PWA with a precached service worker; after the first visit it loads without a network.
- **Accessible** — text and state colours meet WCAG contrast (4.5:1 for text) in both themes, and the app honours the "reduce motion" setting.

## Scripts

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check, then build to dist/
npm run preview    # serve dist/ (the production build, with the service worker)
npm run test       # all unit and database tests once
npm run test:watch
npm run lint       # oxlint
```

`npm run generate-pwa-assets` regenerates the icons in `public/` (favicon, PWA, maskable and Apple touch icons) from `public/mascot.svg`, using `pwa-assets.config.ts`. Run it after changing the mascot, and commit the results.

## Dev scenarios

In development, `?db=<name>` opens a separate scratch database, so experiments never touch your real data (production builds ignore it). `src/dev/scenarios.ts` seeds a scratch database from the browser console:

```js
// at http://localhost:5173/?db=day75
const s = await import('/src/dev/scenarios.ts')
await s.seedDay75Pending()
```

| Scenario | What you get |
| --- | --- |
| `seedDay75Pending()` | Days 1–74 complete; Day 75 (today) only needs its last 500 ml of water. |
| `seedMissedDay()` | Started yesterday with Day 1 incomplete, so the app opens on the restart flow. |
| `seedNewMorning()` | Days 1–3 complete and nothing logged on Day 4 yet: the streak should show 3. |
| `seedPreStart(daysAhead)` | An attempt that starts in a few days ("Starts in N days"). |
| `seedDayOneWithLogs()` | Day 1 with some progress logged, for trying start-date changes. |

Every scenario refuses to run against the default database.

## Backing up your data

Everything is stored only on the device, in this browser. Nothing is sent anywhere, so nothing can restore it for you:

- **Export regularly** from Settings → Backup & storage. The file is one JSON with every attempt, log and photo inside, and the section shows how long ago your last backup was. Import restores it, replacing what's on the device.
- **Install the app** to your home screen and allow persistent storage (the same section can ask for it). Browsers are then much less likely to clear its data when space runs low or after a long time without visits.
- **Export before** clearing browser data, resetting the phone or switching phones.

## Project structure

- `src/logic/` — pure challenge-rules module (day completion, streak, XP, badges, restart, attempts, stats, validation). No UI or persistence dependencies; fully unit tested.
- `src/db/` — Dexie schema, types, repositories (the only place persistence lives), migrations and export/import.
- `src/hooks/` — bridges Dexie live queries and the logic module into React.
- `src/content/` — user-facing copy: task names and rules, cheers and the mascot's lines.
- `src/lib/` — dates, theme, sound, confetti, storage and install helpers.
- `src/screens/`, `src/components/` — UI.
- `src/dev/` — dev-only seeded scenarios (never imported by the app).
