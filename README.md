# 75 Hard Companion

A mobile-first, installable, local-first PWA for tracking the 75 Hard challenge — workouts, diet, water, reading and progress photos — with a Duolingo-style Journey map, streaks and badges.

No backend: all data (including photos) lives in the browser via IndexedDB (Dexie), and can be exported/imported as a single JSON file.

## Features

- **Welcome** — on first launch, one question per screen: your name, your challenge, why you're doing it, and when you start. The duck then greets you by name on Today, keeps your reason in view, and quotes it back when it gets hard (a missed day, a joker, giving up). Settings → Profile edits both.
- **Today** — a board of six tiles: workouts, diet and alcohol, water, reading, a progress photo, and your mood and notes. Each tile shows where you are ("1.3 / 3.8 L", "1 of 2 logged") in its own colour, and opens a sheet with the task's controls; when a task completes there, the sheet cheers and closes itself, and the tile turns to the world's colour with a tick (the photo tile shows the photo). The mascot counts the day down. Mood and notes don't affect completion.
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
- **Strict rules** — a day only completes with all five tasks. Forgot to log? Yesterday stays open until noon: Today shows "Day N isn't finished" and opens that day's tasks (the photo from the library), so a logging slip doesn't cost the attempt. On 75 Hard and 75 Strong, a missed day ends the attempt: the app shows what was missed and restarts from Day 1 once you confirm. 75 Medium forgives one missed day and 75 Soft forgives three, each with a joker, before ending the attempt the same way. The start date can be today or later, and it's locked from Day 2.
- **Giving up** — Settings → Danger zone → Give up this challenge ends the running attempt for good (from Day 1), after four confirmations: what it means, what you built, a five-second last warning, and typing GIVE UP. The attempt stays in the history as Abandoned, and you pick your next challenge and when it starts.
- **Journey** — all 75 days on a winding path; future days are locked, and 🃏 marks a day a joker forgave.
- **Streaks and badges** — a flame for the streak, badges at 7, 14, 21, 30, 50 and 75 days in a row and for firsts. A full-screen celebration for each completed day, and a victory screen after Day 75.
- **Stats** — totals for the attempt, plus weight and body measurements with a weight chart.
- **Gallery** — every progress photo across all attempts.
- **Settings** — Profile (your name and your reason), Challenge (the challenge and its start date), books, badges, attempt history (days and photos of every past attempt), sound and haptics, light/dark/system theme, installing the app, backup & storage, and the danger zone (giving up the attempt, or erasing everything).
- **App lock** — Settings → Privacy & data → App lock: a 6-digit PIN with Face ID as the shortcut, like a banking app. It asks when the app opens and after more than a minute away, and keeps the app covered in the app switcher. Wrong PINs cost growing waits; "Forgot PIN?" resets it after Face ID; "Can't unlock?" turns the lock off and leaves a notice. The PIN is stored only as a salted PBKDF2 fingerprint, never in backups. Face ID needs the app on its real web address, not a local test link (the PIN works anywhere).
- **Install first** — opened in a phone browser, the app first asks to be added to the Home Screen (the 3 steps on iPhone, one button on Android), since on iPhone a Home Screen app keeps its own data apart from Safari's. "Continue in the browser anyway" stays possible. The welcome screen can also restore a backup (a new phone, or after installing).
- **Backups** — Settings → Backup & storage, or the Sunday reminder: one file with everything, photos included, through the share sheet (save it to iCloud Drive). An optional password encrypts it (AES-256-GCM, key from PBKDF2); restoring a protected file asks for it.
- **Installable and offline** — a PWA with a precached service worker; after the first visit it loads without a network.
- **Accessible** — text and state colours meet WCAG contrast (4.5:1 for text) in both themes, and the app honours the "reduce motion" setting.

## Scripts

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run dev:phone  # HTTPS dev server on the Wi-Fi network, port 5174, for trying it on a phone
npm run build      # type-check, then build to dist/
npm run preview    # serve dist/ (the production build, with the service worker)
npm run test       # all unit and database tests once
npm run test:watch
npm run lint       # oxlint
```

`npm run dev:phone` serves the app at `https://<the computer's Wi-Fi IP>:5174` with a self-signed certificate: the phone warns once, then it works. HTTPS is needed for the in-app camera. Face ID can't be tried this way (it needs a real domain, never an IP address); the PIN can.

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
| `seedGaveUp()` | A 75 Hard attempt given up today on Day 12, after 11 perfect days: opens on the "You gave up" screen. |
| `seedFreshInstall()` | An empty database with no profile: opens on the welcome flow for a new player. |
| `seedReturningWithoutProfile()` | 75 Hard on Day 4 (Days 1–3 done) with no profile yet: opens on the returning welcome flow (name and reason only). |

**Time travel:** in the dev server, Settings → Developer → Time travel opens the app on the first day of any world, the last day, the victory, or a morning with yesterday unfinished (late logging). It uses its own scratch database (`/?db=time-travel&travel=<day>`, 76 = victory; add `&late=1&now=09:00` for the unfinished yesterday).

`?now=HH:mm` freezes the duck's clock in development (production ignores it), so each menace level can be checked, e.g. `?db=duck&now=22:45`.

Every other scenario also writes a default profile (Sam), so it opens straight on the app.

Every scenario refuses to run against the default database.

## Backing up your data

Everything is stored only on the device, in this browser. Nothing is sent anywhere, so nothing can restore it for you:

- **Save a backup regularly** from Settings → Backup & storage (the Sunday reminder opens the same sheet). The file is one JSON with every attempt, log and photo inside; save it to iCloud Drive so it survives losing the phone. The section shows how long ago your last backup was.
- **Protect it with a password** if you like: the file is then encrypted (AES-256-GCM) and useless without it. A forgotten password can't be recovered.
- **Restore a backup** from the same section, or from the welcome screen on a new phone. It replaces what's on the device. The app lock's PIN and Face ID are never in a backup.
- **Install the app** to your Home Screen before setting it up: on iPhone, the installed app keeps its own data, apart from Safari's. Allow persistent storage too (the same section can ask for it), so the browser is much less likely to clear the data.
- **Save a backup before** clearing browser data, resetting the phone or switching phones.

## Project structure

- `src/logic/` — pure challenge-rules module (the rulesets for each challenge in `rulesets.ts`, day completion, streak, badges, restart, attempts, stats, validation). No UI or persistence dependencies; fully unit tested.
- `src/db/` — Dexie schema, types, repositories (the only place persistence lives), migrations and export/import.
- `src/hooks/` — bridges Dexie live queries and the logic module into React.
- `src/content/` — user-facing copy: task names and rules, cheers and the mascot's lines.
- `src/lib/` — dates, theme, sound, confetti, storage and install helpers.
- `src/screens/`, `src/components/` — UI.
- `src/components/mascot/` — the duck: the traced SVG art, the pure motion rig (`rig.ts`) and the `Mascot` component. The design is in `docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md`.
- `src/screens/Journey/` — the climb from hell to heaven: the worlds (`worlds.ts`), the map, and the three.js particle effects (`effects/`).
- `src/dev/` — dev-only seeded scenarios (never imported by the app) and time travel (shown only in the dev server).
- `src/assets/animations/` — Lottie animations, loaded on demand with `lottie-web` (light SVG build).

## Credits

- The streak flame is the animated 🔥 from Google's [Noto Emoji](https://github.com/googlefonts/noto-emoji) animations, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
