# v4 Part 5: Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Journey tab on the phone is the web's logbook: the attempt's days, newest first, in chapters by world (each under its cover picture, in its own colours), the next world waiting locked on top, the climb card above them, the climb as a rail down the left edge that follows the scroll and jumps to a world, and a card for any day (its photo, its notes, its workouts).

**Architecture:** The logbook's rule (`journeyLog`: which chapters, which days, which status, the counts) moves under `src/logic/` and both apps use it; the phone draws it. One gate for the whole app (a provider in the tabs' layout) replaces a gate per tab. A chapter wears its world's colours through a small theme scope. The page is one scroll view; the rail reads the scroll position on the UI thread (Reanimated) and each row's measured place. The day card is the web's centred card, growing from the row tapped.

**Tech Stack:** as part 4d (Expo SDK 58, Reanimated 4, react-native-svg, expo-sqlite). No new package expected; `react-native-gesture-handler` (installed) for the card's drag.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 5). Web designs: `2026-11-17-journey-logbook-design.md`, `2026-10-07-journey-day-cards-design.md`. Web code: `src/screens/Journey/` (`JourneyScreen`, `chapters`, `worlds`, `WorldCover`, `DayRow`, `DayCard`, `AltitudeRail`), `src/screens/Stats/ClimbCard.tsx`, `src/logic/climb.ts`, `src/logic/worlds.ts`, `src/components/ui/Modal.tsx` (the card that grows from a point).

## What differs from the web, on purpose (said plainly to the owner)

- **The rail's fill is worked out from each row's measured place**, not from the page's elements; same reading line (45% down the screen), same rule (a day counts in full once the line reaches the top of its row). Whether the web's little ease (a fifth of the way each frame) is still needed on a native scroll is for the phone to settle.
- **A chapter's colours come from a theme scope** around it (the web switches CSS variables with `data-world`). Same colours, from `@logic/worldColors`.
- **The covers are the web's six pictures**, copied into the app (`mobile/assets/images/journey/`, WebP). If a phone can't show WebP there, they are converted to JPEG once: say so.
- **The day card is drawn above the tab bar by a `Modal`**, as the sheets are. Nothing else on Journey opens a `Modal`, so the one-at-a-time rule holds by construction.
- **The developer seeds gain notes, a few different workouts and real pictures** (three small bundled ones, cycled): a logbook of identical empty rows would show nothing. The seeds stay developer-only.

## Global Constraints

- Parts 1 to 4d's constraints hold (the `v4` worktree, `npm run check` before every commit chained with `&&`, `@logic/*` and `@schema` only, `transaction()` for every write, no clock or ref read while rendering, tests outside `app/`, one `Modal` at a time, 48-point targets, reduce motion, English copy).
- Same wording as the web; a string that lives in a web component is typed again exactly ("Today · Day 12", "In progress", "Not finished", "Not in your backup", "Day 9 · forgiven with a joker", "Cleared", "Days 11–22 · 3 to go", "Nothing was logged this day.", "No photo this day", "No notes").
- Journey only reads: it writes nothing to the database.
- The page must stay smooth with 75 rows: one read for the attempt's workouts and one for its photos, not one per row; the rail never re-renders React while scrolling.
- A change to `src/logic/` goes on `refactor/shared-rules` (PR 108) as a pure move, with the four web checks, then `git merge --no-ff refactor/shared-rules` into `v4`.

## Review Focus

1. The log: newest day first, chapters by world, the next world locked on top ("Tomorrow" / "In N days"), only Hell waiting before Day 1, every world "Cleared" after Day 75 with nothing ahead.
2. A chapter's cover: its score while in it ("7/10", "Days 1–10 · 3 to go", today counted as to go until done), "Cleared" with the count, the jokers and the date once behind.
3. A day's row: today ("Today · Day N", the date and "Done" / "In progress"), a done day (its date, the first line of its notes, its workouts with their logos and durations, its photo), a day not finished, a day kept from a backup, a joker's dashed row.
4. The card: opens from the row tapped, shows the live entry (a note written meanwhile shows), "Nothing was logged this day." on an empty day, "Not in your backup" on a restored one, closes from Close, a tap beside it and a drag down; never two cards.
5. The rail: six sections sized by their days, Hell at the bottom; full to today at the top of the page, emptying as the page scrolls back; a tap jumps to that world's cover (to the top for a world ahead); reduce motion jumps without animation; VoiceOver reads "Go to Hell" and so on.
6. The gate, shared: Today, Settings' give-up row and Journey read one gate; a blocking screen still brings Today forward; an attempt finished or given up shows the right Journey (finished: all cleared; given up: Today is in front).
7. Light and dark, each world: text on a cover and on a tinted row meets 4.5:1 (extend the contrast test to the cover's scrim).

---

### Task 1: The logbook's rule, shared

On `refactor/shared-rules`: `src/screens/Journey/chapters.ts`'s `journeyLog` and its types move to `src/logic/journeyLog.ts` on `WorldSpan` (no cover picture); the web's `chapters.ts` keeps `coverId` and re-exports the rest with its `World` type; `chapters.test.ts` moves to `src/logic/__tests__/journeyLog.test.ts` (same cases). Also `ACTIVITY_ICONS` is already typed again on the phone (`today/WorkoutTask.tsx`): export it from there, no move.

- [ ] Move, keep `src/logic/__tests__/boundary.test.ts` green, four web checks, push, merge into `v4`.

### Task 2: One gate for the app

`mobile/src/hooks/useChallengeGate.ts` gains `GateProvider` and `useGate()`; the tabs' layout provides it; `Today`, `GiveUpSetting` and Journey read it. Tests that render `Today` wrap it (the `Providers` of `today/__tests__/support.tsx`).

- [ ] Failing test: two readers under one provider make one "mark completed" call and see the same gate object.
- [ ] Provider, callers moved, `npm run check`, commit.

### Task 3: The page

`mobile/src/journey/`: `JourneyScreen` (header: "Attempt #N", "Journey", the flame; the climb card; the locked next world; the chapters), `WorldCover`, `DayRow`, `ClimbCard` (in `components/`, Stats will use it), `WorldScope` (the theme scope), `worlds.ts` (the six covers). One live read for the attempt's workouts (`workoutRepo.getForDayEntries`) and one for its photos.

Tests, from `JourneyScreen.test.tsx` and the row's part of the web's tests: Review Focus 1, 2, 3 and 7; `climbSegments` on the card ("47% of the climb from Hell to Heaven", "Not started yet").

### Task 4: The day card

`journey/DayCard.tsx`: a centred card in a `Modal` that grows from the row (scale and position from the tap point, the web's spring), its top a handle to drag down, Close, a tap beside it; reduce motion: a fade. It keeps its day while it closes.

Tests, from `DayCard.test.tsx`: Review Focus 4.

### Task 5: The rail

`journey/AltitudeRail.tsx` and `journey/railMaths.ts` (`dayInView(rows, line, dayReached)`, pure, as a worklet): the rows report their place on layout; the scroll position is a shared value; six sections fill from it; each is a button to its chapter.

Tests: `dayInView` against the web's cases (above the first row, inside a row, between two rows over a cover, past the last row); the sections' sizes and labels; a tap scrolls to the cover's place less 24 points, to 0 for a world ahead. Review Focus 5.

### Task 6: Seeds, then the phone, then the review

- [ ] Seeds write notes, varied workouts and bundled pictures; "Seed Day 30" for a logbook three worlds deep.
- [ ] The owner scrolls the logbook on the iPhone: the rail, a jump, a card, light and dark.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first, list the Minor ones in the ledger.

## Done when

- `npm run check` passes in `mobile/`, and the four web checks on `refactor/shared-rules`.
- The seven Review Focus cases hold in tests.
- The spec's build-order line for part 5, the memory file and a hand-over note say where things stand.
