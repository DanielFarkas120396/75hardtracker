# v4 Part 4a: Today, a whole day can be logged Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone, Today opens on the current day with the hero, the duck and the five task tiles, and every task can be logged with real data until the day reads "Day N won": workouts, diet, water, reading with the current book, the progress photo through the in-app camera, plus mood and notes and the weigh-in.

**Architecture:** The rules and the copy are the web's own, imported from `src/logic/` (PR 108). The data layer mirrors the web's repositories on SQLite, with the completion flag re-synced in the same transaction as each change. The screen follows `src/screens/Today/` component for component (`TodayScreen`, `TodayHero`, `DayBoard`, `TaskBoard`, `TaskTile`, `TaskSheet` and the task bodies, `PhotoCapture`, `CameraSheet`, `PreStartView`), drawn with React Native views and react-native-svg.

**Tech Stack:** as parts 1 to 3, plus `expo-camera`, `expo-image-picker` and `expo-image-manipulator` (all three are in Expo Go for SDK 58; install with `npx expo install`).

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 4). The web designs that constrain this part: `2026-10-06-task-board-design.md` and its rounds, `2026-10-07-gauge-ring-design.md`, `2026-10-02-inline-camera-design.md`, `2026-10-15-daily-weigh-in-design.md`, `2026-10-11-today-guidance-design.md`. The porting brief (every string, every state): `today-porting-brief.md` in the sessions' notes folder.

## Today is built in three parts

| Part | Ends with |
|---|---|
| **4a (this plan)** | A whole day logged on the phone, tiles with a thin progress bar. |
| 4b | The evening and yesterday: "Plan my evening", the menace's atmosphere, the duck's bubble, chatter and pokes, social nights, the late-day card, sounds. |
| 4c | The show: the five fills in Skia, the tile shrinking into its chip, the gauge's wave, crown and sparkles, the day-complete peak, the weigh-in's fold, the flame. |

Failure, restart, give up and Victory keep their own part after these (the design's 4b becomes 4d).

## What 4a shows in place of what comes later (said plainly to the owner)

- **Tiles: the thin bar, not the fills.** A 4-point bar at the bottom of the workouts, water and reading tiles. It is the web app's own look when a phone can't draw the fills (`TaskTile.tsx`), not a new stand-in. A done task becomes its chip at once (the web's path without animation).
- **Gauge: its settled state.** Bars, label, number and crown as they stand once a change has played (the web's reduce-motion look). No wave, no sparkles yet.
- **No "Day complete!" overlay.** At 5/5 the hero says "Day N won" with "How did it go?". The peak arrives whole in 4c; a plain overlay in between would be a rough stand-in.
- **The duck** has his moods and his line under the gauge. No bubble, chatter, pokes or eyes following a touch yet.
- **The flame** is the emoji with the count (the web's look until its player has loaded).
- **Not active** (a missed day beyond the jokers, a joker to announce, a given-up or finished attempt): one plain screen saying which, so Today is never blank. The real screens are part 4d.

## Global Constraints

- Parts 1 to 3's constraints hold: the `v4` worktree, `npm run check` before every commit and the commit only if it passes, `@logic/*` and `@schema` only, `transaction()` for every write and never a write inside a task, no clock and no ref read while rendering (`useToday()`, `useNowMinutes()`), English copy, tests outside `mobile/src/app/`.
- Same order, same wording, same numbers as the web. Copy comes from `@logic/taskStatus`, `@logic/microcopy`, `@logic/variantsCopy`, `@logic/moods`; a string that lives in a web component is typed again exactly, with the component named beside it.
- Touch targets at least 48 points. Text fields at least 16 points. "Reduce motion" removes movement and keeps fades.
- The camera is a panel over the bottom 65% of the screen, never full-screen; the page behind stays visible and scrollable; the tab bar hides while it is open.
- A photo is a file (`pictures/photos/<id>.jpg`, 1280 points on its long edge, JPEG 0.8) and a row; a failed save leaves the previous photo in place.
- VoiceOver: the iPhone has no live regions. Lines that change are said with `useAnnounceChanges`.
- A light haptic when a task becomes done.

## Review Focus

1. Quick taps: four "+ 250 ml" in a row all count, and Undo takes back exactly one pour.
2. The fifth task is completed inside its sheet: the day's `completed` flag flips in the same write, the sheet closes after its cheer, the hero says "Day N won".
3. Midnight passes with Today open: the screen moves to the new day, one entry is created for it, and nothing of yesterday's sheets stays open.
4. A photo that can't be saved: the review stays open with the web's line, the day keeps its previous photo, no row is left without a file.
5. The camera is refused: no crash, the photo sheet says so, the library still works.
6. Before Day 1: the countdown, and no day entry is created.
7. An attempt that is not active: the plain screen, never a blank Today.

---

### Task 1: Share Today's copy and the gate's rules (web side, PR 108)

Pure moves with re-exports, four web checks, merged into `v4`: `src/content/taskStatus.ts`, `moods.ts`, `microcopy.ts` → `src/logic/`; `formatMinutes` → `src/logic/duration.ts`; `resolveGate`, `canGiveUp` and the gate's types from `src/hooks/useChallengeGate.ts` → `src/logic/challengeGate.ts`.

### Task 2: The day's repositories

`mobile/src/db/`: `table.ts` (`getRow`, `allRows`, `insertRow`, `updateRow` over the row codecs, which learn a partial update), `completion.ts` (`syncDayCompletion(db, entryId)`), `repositories/dayEntryRepo.ts`, `workoutRepo.ts`, `bookRepo.ts`, `photoRepo.ts` (`replaceForEntry(entryId, { uri, mimeType }, store)`), `measurementRepo.ts`. `FileStore` gets `copyIn` and `deleteFile`.

Tests: the web's cases from `src/db/__tests__/repositories.test.ts` for these repositories, same names, plus the photo file's life (copied in, replaced, kept when the copy fails).

### Task 3: The gate and the day's hooks

- `mobile/src/hooks/useChallengeGate.ts`: one live query (the current challenge and its entries), resolved with `resolveGate(challenge, entries, today, nowMin)` from `@logic/challengeGate`. Returns `undefined` while loading and `null` with no challenge.
- `mobile/src/today/hooks.ts`: `useTodayEntry` (creates the day's entry once, only on Day 1 to 75), `useWorkoutsForEntry`, `dayCompletion(entry, workouts, rules, socialDays)` (a plain function: the compiler memoises), `useBedtime`, `useCurrentBook`, `useEntryPhoto`, `useProfile`.

Tests: the entry is created once and only inside the challenge; the gate's `todayDayNumber`, `streak` and `jokersLeft` on a seeded attempt; the current book that no longer exists reads as none.

### Task 4: The pieces

- `mobile/src/components/icons/`: the web's icons converted to react-native-svg (`icons.tsx`, `Icon.tsx`), with a test that every web drawing is there, path for path.
- `mobile/src/components/ui/`: `Sheet` (bottom sheet: dimmed backdrop that closes it, panel sliding up, 85% of the height at most, the keyboard pushing it up), `Stepper`, `Toggle`, `DoneBadge`; `mobile/src/components/MoodPicker.tsx`, `GaugeRing.tsx` (the 41 bars, "today's tasks", the count, the crown, in their settled state), `FlameStreak.tsx`.

Tests: the stepper's bounds and signed steps; the toggle's state and label; the mood picker's five moods and the pick; the gauge's label ("3 of 5 tasks done") and its lit bars for 0, 3 and 5; the sheet closes on the backdrop and on Close.

### Task 5: The board

`mobile/src/today/`: `TaskTile` (icon, title, status line from `taskStatusLine`, the thin bar from `taskProgress`, the quick chips, the urgency edge), `DietSwitches`, `TaskBoard` (done tasks as chips in task order, open ones as tiles sorted by `minutesToFinish` on a fresh day, the odd one out full width, "{Title} done." said aloud, a haptic), `DayBoard` (the shortcuts: "+ Workout", "+ 250 ml", "+1 page" and "+10 pages", "Snap" or "Pick"; "Logged … · Undo" for 4 s).

Tests, from `TaskBoard.test.tsx`, `TaskTile.test.tsx` and `DayBoard.test.tsx` where they don't concern the fills or the morph: the order of the tiles; a done task is a chip with its spoken label; the status lines; the diet switches write; each shortcut writes and its Undo takes it back; the reading shortcuts leave once the pages are read; the workout shortcut leaves at two workouts.

### Task 6: The sheets

`TaskSheet` (header in the world's tint with the icon, the title, the rule line, the done badge and Close; the cheer for 1.5 s and the sheet closing itself, except for workouts), `taskSheets.tsx` (`describeTask`), and the bodies: `WorkoutTask` with `ActivityPicker` and `AddWorkoutSheet`, `DietTask`, `WaterTask`, `ReadingTask` with `BookPicker` and its add-book form, `DayNotesTask`, `PhotoTask`.

Tests, from the web's task tests: each body's writes; a workout under the minimum says it doesn't count yet; Outdoor follows the activity while the day needs it; a removed workout comes back with Undo; the recovery day on Soft and its refusals; "Other amount"; "+ N pages" logs the rest and moves the bookmark; a book is added and becomes the current one, with its validation lines; notes are saved when typing pauses, on blur and when the sheet closes; a task done inside the sheet shows its cheer and closes it; a save that completes nothing leaves it open.

### Task 7: The photo

- `mobile/src/today/photo.ts`: `coverCrop` (the web's), `prepareShot(uri, size, viewfinder)` (crop to the viewfinder's shape, 1280 on the long edge, JPEG 0.8, with expo-image-manipulator).
- `PhotoCapture` (owns the camera, the library pick and the saving; `usePhotoCapture`), `CameraSheet` (the panel at 65%, the duck on its top edge with a mood per phase, the timer 0 / 3 / 10 s, the ghost of the last photo at 30%, Close, the shutter, Switch camera, then Retake / Use photo → Saving… → Saved!, 1.2 s, and it slides away), the facing remembered on this phone, the tab bar hidden while it is open (`NativeTabs hidden`).
- `app.config.ts`: the `expo-camera` and `expo-image-picker` plugins with their permission lines.

Tests, from `CameraSheet.test.tsx` and `PhotoCapture.test.tsx` with the camera view and the picker mocked: the phases and their labels; the timer counts down and can be cancelled; the ghost shows only when an earlier photo exists and hides in review; Use photo saves and closes; a failed save keeps the review with the web's line; a refused permission reports "unavailable" and the photo sheet explains; the library pick saves; a retake replaces the photo.

### Task 8: The screen

- `TodayHero` ("Day N", "75 Hard #1", the duck at 64 with his mood from the menace, the gauge, the streak and the jokers, the reason quoted), with what matters under the gauge, first case first: "Day N won" and "How did it go?" (then the mood or "Notes saved"); late in the evening the time left and the tasks left; the next plan; else the duck's line.
- `WeighInCard` ("Weigh in", "Your starting weight." on Day 1, the field, Save, "{x} kg logged." for a moment, then it leaves).
- `TodayScreen` (keyed by day; "Loading…" until the day is read), `PreStartView` (greeting, the card with the duck and the gauge at 0, "Day 1 starts tomorrow", the book picker), the plain screen for an attempt that is not active, and `mobile/src/app/(tabs)/index.tsx` on top of the gate.
- The developer seed gains a profile, so a seeded attempt opens on Today.

Tests, from `TodayScreen.test.tsx` and `PreStartView.test.tsx` where they don't concern later parts: a full day logged through the screen ends on "Day N won" with `completed` saved; the lines under the gauge; the weigh-in card's six cases; the pre-start texts for tomorrow and for several days; the seven Review Focus cases.

### Task 9: On the phone, then the review

- [ ] The owner logs Day 1 in Expo Go: every tile, the camera sheet, the weigh-in, light and dark.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first, list the Minor ones in the ledger.

## Done when

- A day can be logged from start to "Day N won" on the phone, and reopening the app shows it as it was left.
- `npm run check` passes in `mobile/`, and PR 108's four checks pass.
