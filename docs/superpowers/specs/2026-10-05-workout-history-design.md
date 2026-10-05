# Workout history — design

Date: 2026-10-05 · Status: **built** (PR into `main`).

## Why

The owner wants to follow the sport sessions done during the challenge, with a logo for each activity the app lists. They shared a screenshot they like: a stack of rounded cards in shades of one colour, one per category, each with a big line drawing, a big number and a chevron; the open card turns a contrasting colour, with its drawing big and faint behind the details. They also want to note how each session felt, when logging it.

## Decisions

| Topic | Decision |
|---|---|
| Where | Stats: the "Training" tile opens a **Workouts** page, with a back button to Stats. No new tab. |
| Which sessions | The running attempt's, from Day 1 (late-logged days included). Past attempts are out of scope. |
| Grouping | One card per activity practised, most sessions first; ties keep the app's list order. Activities never practised sit under the stack as small chips, "Not tried yet". |
| Look | The screenshot's stack: rounded cards overlapping like folders, in shades of the workouts orange from the strongest (top) to the softest. The open card turns sky blue, its logo big and faint behind it. One card open at a time; the top one is open when the page opens, and tapping the open one closes it. |
| Open card | The feels (emoji and count, only those used, best first); the sessions (big number), the time and how many were outdoors; then every session, newest first: "Day 6 · Mon 5 Oct", "45 min · Outdoor", the feel's emoji. |
| Summary | Three tiles above the stack: sessions, time of training, outdoors. |
| Logos | Seven new icons in the app's set (24 px grid, 2 px round strokes, soft fills): `running` (a runner), `walking` (footprints), `weights` (a kettlebell), `yoga` (a lotus), `cycling` (a bike), `swimming` (a swimmer over waves), `stopwatch` (for Other). |
| Today | A workout's activity is picked from a row of the seven logos instead of the drop-down; the chosen activity's name heads the workout. |
| Feel | "How did it feel?" under each workout: the five moods of "How was today?" (😫 Rough, 😕 Meh, 😐 Okay, 🙂 Good, 😄 Great). Optional; tapping the chosen one clears it. It never affects completion. |
| Data | `Workout.feel?: 1 \| 2 \| 3 \| 4 \| 5`, optional and unindexed: no Dexie version bump, and older workouts simply have no feel. Backups carry it; import checks it's 1–5, and that a workout's activity is one of the seven (they've never changed). |
| Empty | No session yet: "No workouts yet", "Log your first one from Today.", and the seven logos under "Not tried yet". |

## The Workouts page

`src/screens/Stats/WorkoutsPage.tsx`, opened from `StatsScreen` (page state, like Settings' pages: it scrolls to the top on open). Its parts, top to bottom:

1. **Header**: a back button ("Stats", chevron, `world-ink`) and the title "Workouts" in Lilita One with the workout icon.
2. **Summary**: three tiles like the Stats tiles (surface, hairline ring): "11 sessions", "8h 55m of training", "7 outdoors". The time uses the Stats format ("8h 55m", "45 min"), now one shared helper.
3. **The stack**: one `<section>` per activity, each overlapping the one above (`-mt-8`, the next card drawn over the previous one's bottom). A card's header is a `<button aria-expanded>` whose name reads "Weights, 3 sessions".
   - **Closed**: the logo (56 px, 1.5 px strokes) on the left; the name, the big number (Lilita One) and "sessions · 2h 25m" ("session · 45 min" for one); a chevron pointing down in the corner. Background: shade *i* of *n*, mixed from `stack-from` (top) to `stack-to` (bottom); text and logo in `on-stack`.
   - **Open**: `open-card` background, `on-open-card` text. The name and an up chevron; the feel chips (a translucent pill each: emoji and count); the big session count with "sessions", the time ("in total") and the outdoors; then the sessions on a translucent panel, one row each: "Day 6" over "Mon 5 Oct", "45 min · Outdoor" (or "Indoor"), and the feel's emoji when there is one. The logo, 220 px with 1 px strokes, sits faint (15 %) in the top-right corner, hidden from screen readers.
   - Opening or closing only swaps colours and shows or hides the details; the colour change is a short transition, none under reduce motion.
4. **Not tried yet**: a label and a chip per untried activity (logo and name, muted).

### Colours

New tokens in `index.css`, light and dark, used only by this page:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-stack-from` | `#ff8a3d` | `#a9461a` | top card of the stack |
| `--color-stack-to` | `#ffcfb0` | `#4f2819` | bottom card |
| `--color-on-stack` | `#3d1a05` | `#fff1e6` | text and logos on the stack |
| `--color-open-card` | `#38b6ff` | `#0b5d91` | the open card |
| `--color-on-open-card` | `#08324f` | `#e8f6ff` | text on it |

A card's shade is `color-mix(in srgb, stack-from, stack-to p%)`, with *p* spread evenly over the cards. Every channel moves the same way between the two ends, so the contrast with `on-stack` is lowest at one end: testing both ends covers every shade. The open card's panel and chips are white at 55 % (light) or black at 25 % (dark) over it, which only raises the contrast with `on-open-card`. The contrast test checks `on-stack` on both ends and `on-open-card` on `open-card`, in both themes, at 4.5:1.

## Today: the workout's activity and feel

`WorkoutTask`'s row changes, top to bottom:

- the activity's name (Nunito extrabold) and the remove button, as now;
- **the logo row**: seven 44 px buttons in a group named "Activity", each named after its activity (`aria-pressed`); the chosen one is filled orange with an `orange-ink` ring;
- the minutes stepper and the outdoor toggle, unchanged;
- **"How did it feel?"** and the five moods. The mood buttons of `DayNotesTask` move to a shared `MoodPicker` (group label, value, `onPick`, selected style), used by both: yellow for the day's mood as now, orange for a workout.

Late days use the same sheet, so they get both.

## Data and logic

- `src/logic/types.ts` gets `WorkoutType` (moved from `db/types.ts`, which re-exports it), and `src/logic/constants.ts` gets `WORKOUT_TYPES`, the list in the app's order (moved from `WorkoutTask`).
- `Workout.feel?: 1 | 2 | 3 | 4 | 5` in `db/types.ts`. `exportImport`'s workout checks gain `feel` (optional, 1–5) and check `type` against `WORKOUT_TYPES`. Export version unchanged.
- `src/logic/workoutHistory.ts`, pure: from the attempt's sessions (`id`, `dayNumber`, `date`, `type`, `durationMin`, `isOutdoor`, `feel?`) it returns the totals (sessions, minutes, outdoors), the activities practised (sorted as above, each with its sessions newest first — by day, then by id —, minutes, outdoors and feel counts), and the untried activities in list order.
- `src/hooks/useWorkoutHistory.ts`: a live query over the attempt's day entries and their workouts (the two repository calls `loadChallengeDays` already uses), mapped to sessions and passed to `workoutHistory`. `undefined` while loading.
- `src/content/activities.ts`: each activity's icon, and `formatMinutes` (shared with the Stats tile).
- `src/components/icons/Icon.tsx` takes an optional `strokeWidth` (default 2), for the big logos.

## Dev

`perfectDay` in `src/dev/scenarios.ts` varies its two workouts by day (an outdoor run, walk or ride; weights, yoga or a swim indoors; 45 to 60 minutes; a feel), so time travel shows a lively history.

## Files

- New: `src/logic/workoutHistory.ts`, `src/hooks/useWorkoutHistory.ts`, `src/content/activities.ts`, `src/components/MoodPicker.tsx`, `src/screens/Stats/WorkoutsPage.tsx`.
- Changed: `src/components/icons/icons.tsx` (seven icons), `Icon.tsx` (`strokeWidth`), `src/db/types.ts`, `src/db/exportImport.ts`, `src/logic/types.ts`, `src/logic/constants.ts`, `src/screens/Today/WorkoutTask.tsx`, `src/screens/Today/DayNotesTask.tsx`, `src/screens/Stats/StatsScreen.tsx` and `StatTiles.tsx` (the Training tile as a button), `src/styles/index.css` (tokens), `src/dev/scenarios.ts`, README features.

## Testing

- `workoutHistory.test.ts`: grouping, the order (sessions, then list order), newest first within an activity (day, then id), totals, outdoors, feel counts (only those used, Great first), untried activities, no sessions.
- `WorkoutsPage.test.tsx`: from a seeded database, the summary, the first card open with its sessions, opening another closes the first (`aria-expanded`), tapping the open one closes it, the untried chips, the empty state, the back button.
- `StatsScreen`: the Training tile opens the page, and back returns.
- `WorkoutTask.test.tsx`: picking a logo stores the type; picking a feel stores it, tapping it again clears it.
- `exportImport.test.ts`: a workout's feel survives a backup round trip; an unknown activity or a feel of 9 is refused.
- Contrast: the new tokens (above). Icons: the seven new ones through the existing `Icon` test.
- On the phone: the page in light and dark, with the stack and the open card; the Today sheet's logos and feel; reduce motion.

## Out of scope

- Past attempts' sessions, a by-day view, distances, charts per activity.
- Editing a session from the history (Today and the late day stay where sessions are edited).
