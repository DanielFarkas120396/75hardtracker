# 75 Hard Companion

A mobile-first, installable, local-first PWA for tracking the 75 Hard challenge — workouts, diet, water, reading and progress photos — with a Duolingo-style Journey map, XP, streaks and badges.

No backend: all data (including photos) lives in the browser via IndexedDB (Dexie), and can be exported/imported as a single JSON file.

## Features

- **Today** — the five daily tasks, worded for whichever challenge you're doing: workouts, diet and alcohol, water, reading, and a progress photo. Each card celebrates when it's done, and the mascot counts the day down. Mood and notes are optional and don't affect completion.
- **Four challenges** — pick yours when you start, or until the end of Day 1 (Settings → Challenge):

  | | 75 Hard | 75 Strong | 75 Medium | 75 Soft |
  |---|---|---|---|---|
  | Workouts | 2 × 45 min, one outdoors | as Hard | 1 × 45 min | 1 × 45 min + a recovery day a week |
  | Diet | strict, no alcohol | strict; a drink on a social occasion declared the day before (one a week) | eat healthy; same social rule | as Medium |
  | Water | 3.8 L | 3.8 L | 3 L | 3 L |
  | Reading | 10 pages, non-fiction | as Hard | 10 pages, any book | as Medium |
  | Photo | daily | daily | daily | daily |
  | Missed day | back to Day 1 | back to Day 1 | 1 joker | 3 jokers |
- **The duck** — your companion is a knife-holding duck, drawn in code and animated: he breathes, blinks, watches what you touch and answers pokes. He only gets menacing when what's left no longer fits before your bedtime (Settings → Companion), and backs off once you tell him your plan ("I've got a plan" on Today). With "reduce motion" on, he holds still.
- **Strict rules** — a day only completes with all five tasks. On 75 Hard and 75 Strong, a missed day ends the attempt: the app shows what was missed and restarts from Day 1 once you confirm. 75 Medium forgives one missed day and 75 Soft forgives three, each with a joker, before ending the attempt the same way. The start date can be today or later, and it's locked from Day 2.
- **Journey** — all 75 days on a winding path; future days are locked, and 🃏 marks a day a joker forgave.
- **XP, streaks and badges** — 10 XP per task, +25 for a perfect day, +100 at streaks of 7, 14, 21, 30, 50 and 75. A full-screen celebration for each completed day, and a victory screen after Day 75.
- **Stats** — totals for the attempt, plus weight and body measurements with a weight chart.
- **Gallery** — every progress photo across all attempts.
- **Settings** — Challenge (the challenge and its start date), books, badges, attempt history (days and photos of every past attempt), sound and haptics, light/dark/system theme, installing the app, and backup & storage.
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
| `seedMenaceDay()` | Day 3 with water at 2.1 L and the reading, photo and diet to do: try `?now=10:00`, `20:00` and `22:45`. |
| `seedPlannedReading()` | Only the reading left, planned for 22:30: try `?now=19:00`, `22:35` and `23:10`. |
| `seedStrongSocial()` | 75 Strong on Day 3, declared as this week's social occasion: diet is complete, the rest isn't logged. |
| `seedMediumJoker()` | 75 Medium on Day 5 with Day 3 missed: opens on the joker screen. |
| `seedSoftRestDay()` | 75 Soft on Day 2, taking its recovery day: diet, water and reading done, only the photo left. |
| `seedDay77Complete()` | A Hard attempt with all 75 days perfect, opened on Day 77: opens on Victory. |

`?now=HH:mm` freezes the duck's clock in development (production ignores it), so each menace level can be checked, e.g. `?db=duck&now=22:45`.

Every scenario refuses to run against the default database.

## Backing up your data

Everything is stored only on the device, in this browser. Nothing is sent anywhere, so nothing can restore it for you:

- **Export regularly** from Settings → Backup & storage. The file is one JSON with every attempt, log and photo inside, and the section shows how long ago your last backup was. Import restores it, replacing what's on the device.
- **Install the app** to your home screen and allow persistent storage (the same section can ask for it). Browsers are then much less likely to clear its data when space runs low or after a long time without visits.
- **Export before** clearing browser data, resetting the phone or switching phones.

## Project structure

- `src/logic/` — pure challenge-rules module (the rulesets for each challenge in `rulesets.ts`, day completion, streak, XP, badges, restart, attempts, stats, validation). No UI or persistence dependencies; fully unit tested.
- `src/db/` — Dexie schema, types, repositories (the only place persistence lives), migrations and export/import.
- `src/hooks/` — bridges Dexie live queries and the logic module into React.
- `src/content/` — user-facing copy: task names and rules, cheers and the mascot's lines.
- `src/lib/` — dates, theme, sound, confetti, storage and install helpers.
- `src/screens/`, `src/components/` — UI.
- `src/components/mascot/` — the duck: the traced SVG art, the pure motion rig (`rig.ts`) and the `Mascot` component. The design is in `docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md`.
- `src/dev/` — dev-only seeded scenarios (never imported by the app).
- `src/assets/animations/` — Lottie animations, loaded on demand with `lottie-web` (light SVG build).

## Credits

- The streak flame is the animated 🔥 from Google's [Noto Emoji](https://github.com/googlefonts/noto-emoji) animations, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
