# 75 Hard Companion

A PWA for the 75 Hard challenge. It tracks workouts, diet, water, reading and progress photos, and shows your days on a Duolingo-style Journey map with streaks and badges. It's built for phones, installs to the Home Screen and works offline.

There's no backend. All data, photos included, lives in the browser's IndexedDB (through Dexie), and you can export or import it as a single JSON file.

## Features

- **Welcome.** On first launch, the app asks one question per screen: your name, your challenge, why you're doing it, and when you start. No challenge is preselected, and each card shows the same three facts (workouts, weekly allowance, jokers). The last screen is the deal: the rules, what a missed day costs, Day 1 → Day 75 and your reason. You sign it by drawing a checkmark with your finger on a pad, then tap "I commit". A stroke that isn't a checkmark stays on the pad with "Not quite a checkmark. Try again.", and Enter or Space draws it for a keyboard or VoiceOver. The duck then says "I'm watching, {name}." Next, one optional screen offers to lock the app with a PIN, and Face ID where the phone has it. After 18:00 the start defaults to tomorrow, and picking today shows a warning. A start can be up to 60 days ahead. If iOS closes the app mid-way, it reopens on the same step, or on the first step whose answer no longer holds (such as a start date now in the past). Afterwards the duck greets you by name on Today, keeps your reason in view, and quotes it back when it gets hard (a missed day, a joker, giving up). Settings → Profile edits the name and the reason.
- **Today.**
  - The hero card has "Day 3" and the attempt at the top, a gauge of tasks done in the middle, the duck on its left, and the streak and jokers on its right. The gauge is an arch of bars in the world's colours with a crown in its gap. Each task done sends one wave through the bars (it ripples on into the grey ones and fades), ticks the number, fills the label and the crown a little more, and sweeps a white glow through the label. Undoing a task runs it back, softer. Only 5/5 fills the crown, which pops and sparkles once you close the "Day complete!" screen. With "reduce motion" on, the gauge shows the end state at once. Under the gauge sits the next plan ("Reading at 21:00").
  - Below the hero, a board shows the open tasks, one tile each, quickest first: diet and the photo, then reading, workouts and water, in that order all day. Each tile shows where you are ("0.75 / 3.8 L", "1 of 2 logged", "2 to tick") and opens a sheet with the task's controls. A done task folds into a chip above the board (the photo chip shows the photo), so what's left stands out.
  - Some tiles have a one-tap shortcut: a workout, a glass of water, the pages still to read, and "Snap" for the camera. The workout shortcut opens a small sheet that asks for the activity by its logo, the length, and how it felt. The workouts sheet adds sessions through the same form. After a glass or the pages, the tile shows "Logged 250 ml · Undo" for 4 seconds. The diet tile has its two switches (a plate, a crossed-out glass) on the board itself.
  - Under the board are "Plan my evening", "🥂 Social night" (Strong, Medium and Soft) and "📝 Notes". At 5/5 the hero says "Day N won" and asks "How did it go?", which opens your mood and notes.
  - The duck speaks in a bubble that pops up for a few seconds, then fades. VoiceOver reads it. He greets you, notices once you've started, reacts to ticks and pokes, reminds you of an unfinished yesterday, and now and then drops one of his catchphrases.
  - Late in the evening with tasks left, the hero shows the time left to midnight and the tiles get an edge, red only on the tasks that no longer fit. Once the duck is hunting, "Plan my evening" goes away.
  - Badges unlocked by the day's last task wait until you dismiss its celebration. You can undo removing a workout. In the workouts sheet, a row of logos picks each session's activity, and "How did it feel?" rates the session on the five moods. Mood, notes and feel don't affect completion.
  - Before Day 1, Today shows the same hero card with the gauge at 0, counts down, and lets you pick your book.
- **Four challenges.** Pick yours when you start, or change it until the end of Day 1 (Settings → Challenge).

  | | 75 Hard | 75 Strong | 75 Medium | 75 Soft |
  |---|---|---|---|---|
  | Workouts | 2 × 45 min, one outdoors | as Hard | 1 × 45 min | 1 × 45 min + a recovery day a week |
  | Diet | strict, no alcohol | strict; a drink on a social occasion declared the day before (one a week) | eat healthy; same social rule | as Medium |
  | Water | 3.8 L | 3.8 L | 3 L | 3 L |
  | Reading | 10 pages, non-fiction | as Hard | 10 pages, any book | as Medium |
  | Photo | daily | daily | daily | daily |
  | Missed day | back to Day 1 | back to Day 1 | 1 joker | 3 jokers |
- **The duck.** Your companion is a knife-holding duck, drawn in code and animated. He breathes, blinks, watches what you touch and answers pokes. He only turns menacing when the tasks left no longer fit before your bedtime (Settings → Companion), and he backs off once you tell him your plan ("I've got a plan" on Today). With "reduce motion" on, he holds still.
- **Strict rules.** A day only completes with all five tasks. If you forgot to log, yesterday stays open until noon. Today shows "Day N isn't finished" and opens that day's tasks (the photo comes from the library), so a logging slip doesn't cost the attempt. On 75 Hard and 75 Strong, a missed day ends the attempt. The app shows what you missed and restarts from Day 1 once you confirm. 75 Medium forgives one missed day and 75 Soft forgives three, each with a joker, before ending the attempt the same way. The start date can be today or later, and it locks on Day 2.
- **Giving up.** Settings → Danger zone → Give up this challenge ends the running attempt for good (from Day 1). It takes four confirmations: what it means, what you built, a five-second last warning, and typing GIVE UP. The attempt stays in the history as Abandoned, and you pick your next challenge and when it starts.
- **Journey.** All 75 days sit on a winding path. Future days are locked, and 🃏 marks a day a joker forgave. Tapping a past day (or today) grows a small card out of its stone, centred on the screen, with the day's photo, its notes, and its workouts by logo. Tapping outside, tapping ×, or swiping down shrinks it back.
- **Streaks and badges.** A flame shows the streak. Badges come at 7, 14, 21, 30, 50 and 75 days in a row, and for firsts. Each completed day gets a full-screen celebration, and a victory screen follows Day 75.
- **Stats.** From the top: the climb, totals for the attempt (water, pages), the weight, and Workouts. The weight stays folded until you tap it, and holds body measurements and a weight chart. Workouts shows every session of the attempt as a stack of cards, one per activity with its logo. The cards stay closed until you tap one, which opens it on its sessions (day, minutes, outdoors, how it felt).
- **Gallery.** Every progress photo across all attempts.
- **Books.** The reading sheet shows the current book's cover. Tap it to pick a cover from the photo library. Each day remembers which book its pages went to.
- **Settings.** Profile (your name and your reason), Challenge (the challenge and its start date), books, badges, attempt history (days and photos of every past attempt), sound, light/dark/system theme, installing the app, backup & storage, and the danger zone (giving up the attempt, or erasing everything).
- **App lock.** Settings → Privacy & data → App lock sets a 6-digit PIN, with Face ID as the shortcut, like a banking app. It asks when the app opens and after more than a minute away, and covers the app in the app switcher. Each wrong PIN makes the next wait longer. "Forgot PIN?" resets the PIN after Face ID, and "Can't unlock?" turns the lock off and leaves a notice. The app stores the PIN only as a salted PBKDF2 fingerprint and never puts it in backups. Face ID needs the app on its real web address, not a local test link. The PIN works anywhere.
- **Install first.** Opened in a phone browser, the app first asks to be added to the Home Screen (3 steps on iPhone, one button on Android). On iPhone, a Home Screen app keeps its own data apart from Safari's. "Continue in Safari" is still there, and "I've added it" tells you to open the app from the Home Screen. The welcome screen can also restore a backup, for a new phone or after installing.
- **Backups.** Settings → Backup & storage, or the Sunday reminder, saves one file with everything, photos included, through the share sheet (save it to iCloud Drive). An optional password encrypts it (AES-256-GCM, key from PBKDF2), and restoring a protected file asks for it.
- **Installable and offline.** A precached service worker lets the app load without a network after the first visit.
- **The look.** The app is dark first: cream text on a warm near-black canvas, DM Sans for text and Barlow Condensed for titles and numbers, flat pill buttons, and cards without shadows. The world you are in, from Hell to Heaven, sets a muted accent and a sunrise glow behind the Today hero and the welcome duck. Light mode is a warm cream version of the same.
- **Accessible.** Text and state colours meet WCAG contrast (4.5:1 for text) in both themes, and the app honours the "reduce motion" setting.

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

`npm run dev:phone` serves the app at `https://<the computer's Wi-Fi IP>:5174` with a self-signed certificate. The phone warns once, then it works. The in-app camera needs HTTPS. Face ID can't be tried this way, because it needs a real domain, never an IP address. The PIN can.

`npm run generate-pwa-assets` regenerates the icons in `public/` (favicon, PWA, maskable and Apple touch icons) from `public/mascot.svg`, using `pwa-assets.config.ts`. Run it after changing the mascot, and commit the results.

## Dev scenarios

In development, `?db=<name>` opens a separate scratch database, so experiments never touch your real data. Production builds ignore it. `src/dev/scenarios.ts` seeds a scratch database from the browser console:

```js
// at http://localhost:5173/?db=day75
const s = await import('/src/dev/scenarios.ts')
await s.seedDay75Pending()
```

| Scenario | What you get |
| --- | --- |
| `seedDay75Pending()` | Days 1 to 74 complete. Day 75 (today) only needs its last 500 ml of water. |
| `seedMissedDay()` | Started yesterday with Day 1 incomplete, so the app opens on the restart flow. |
| `seedNewMorning()` | Days 1 to 3 complete and nothing logged on Day 4 yet, so the streak should show 3. |
| `seedPreStart(daysAhead)` | An attempt that starts in a few days ("Starts in N days"). |
| `seedDayOneWithLogs()` | Day 1 with some progress logged, for trying start-date changes. |
| `seedMenaceDay()` | Day 3 with water at 2.1 L and the reading, photo and diet to do. Try `?now=10:00`, `20:00` and `22:45`. |
| `seedPlannedReading()` | Only the reading left, planned for 22:30. Try `?now=19:00`, `22:35` and `23:10`. |
| `seedStrongSocial()` | 75 Strong on Day 3, declared as this week's social occasion, so diet is complete. The rest isn't logged. |
| `seedMediumJoker()` | 75 Medium on Day 5 with Day 3 missed. Opens on the joker screen. |
| `seedSoftRestDay()` | 75 Soft on Day 2, taking its recovery day. Diet, water and reading are done, only the photo is left. |
| `seedDay77Complete()` | A Hard attempt with all 75 days perfect, opened on Day 77. Opens on Victory. |
| `seedGaveUp()` | A 75 Hard attempt given up today on Day 12, after 11 perfect days. Opens on the "You gave up" screen. |
| `seedFreshInstall()` | An empty database with no profile. Opens on the welcome flow for a new player. |
| `seedReturningWithoutProfile()` | 75 Hard on Day 4 (Days 1 to 3 done) with no profile yet. Opens on the returning welcome flow (name and reason only). |

Apart from the last two, every scenario also writes a default profile (Sam), so it opens straight on the app. Every scenario refuses to run against the default database.

**Time travel.** In the dev server, Settings → Developer → Time travel opens the app on the first day of any world, the last day, the victory, or a morning with yesterday unfinished (late logging). It uses its own scratch database: `/?db=time-travel&travel=<day>`, where 76 is the victory. Add `&late=1&now=09:00` for the unfinished yesterday.

`?now=HH:mm` freezes the duck's clock in development, so you can check each menace level, for example `?db=duck&now=22:45`. Production ignores it.

## Backing up your data

Everything stays on the device, in this browser. The app sends nothing anywhere, so no server can restore your data for you. To keep it safe:

- **Save a backup regularly** from Settings → Backup & storage (the Sunday reminder opens the same sheet). The file is one JSON with every attempt, log and photo inside. Save it to iCloud Drive so it survives losing the phone. The section shows how long ago your last backup was.
- **Protect it with a password** if you like. The app then encrypts the file (AES-256-GCM), and nobody can open it without the password. A forgotten password can't be recovered.
- **Restore a backup** from the same section, or from the welcome screen on a new phone. It replaces what's on the device. The app lock's PIN and Face ID are never in a backup.
- **Install the app** to your Home Screen before setting it up. On iPhone, the installed app keeps its own data, apart from Safari's. Allow persistent storage too (the same section can ask for it), so the browser is much less likely to clear the data.
- **Save a backup before** clearing browser data, resetting the phone or switching phones.

## Project structure

- `src/logic/` holds the pure challenge rules: the rulesets for each challenge (`rulesets.ts`), day completion, streak, badges, restart, attempts, stats and validation. It doesn't depend on the UI or on persistence, and unit tests cover all of it.
- `src/db/` holds the Dexie schema, types, repositories (the only place persistence lives), migrations and export/import.
- `src/hooks/` connects Dexie live queries and the logic module to React.
- `src/content/` holds the user-facing copy: task names and rules, cheers and the mascot's lines.
- `src/lib/` holds helpers for dates, theme, sound, confetti, storage and installing.
- `src/screens/` and `src/components/` hold the UI.
- `src/components/mascot/` is the duck: the traced SVG art, the pure motion rig (`rig.ts`) and the `Mascot` component. The design is in `docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md`.
- `src/screens/Journey/` is the climb from hell to heaven: the worlds (`worlds.ts`), the map, and the three.js particle effects (`effects/`).
- `src/dev/` holds the dev-only seeded scenarios (the app never imports them) and time travel (shown only in the dev server).
- `src/assets/animations/` holds the Lottie animations, which `lottie-web` (light SVG build) loads on demand.

## Credits

- The streak flame is the animated 🔥 from Google's [Noto Emoji](https://github.com/googlefonts/noto-emoji) animations, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
