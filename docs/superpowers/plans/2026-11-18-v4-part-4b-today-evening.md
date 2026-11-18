# v4 Part 4b: Today, the evening and yesterday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Today has its evening and its morning after: the player tells the duck their plan and he holds them to it, the screen darkens as time runs out, the duck talks, answers a poke and lunges, a social night can be declared on the challenges that allow one, and an unfinished yesterday can still be finished until noon.

**Architecture:** The rules are already shared (`@logic/menace`, `@logic/microcopy`, `@logic/duckRig`, `@logic/lateDay`, `@logic/challengeGate`). This part adds the web's screens on top of part 4a's: `PlanSheet`, `SocialOccasionSheet`, `MenaceAtmosphere`, `DuckHeader` (`useDuck`), `LateDay`, and `challengeRepo.setSocialDay`. The plan and the social night open in the day's one sheet (part 4a's rule: never a second sheet while one is leaving).

**Tech Stack:** as part 4a, plus `expo-audio` (in Expo Go for SDK 58) for the knife's sound, rendered once to a file by a script from the web's own synthesis.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 4b). Web designs: `2026-09-25-knife-duck-companion-design.md`, `2026-10-11-evening-one-clock-design.md`, `2026-10-11-today-guidance-design.md`, `2026-10-05-late-logging-design.md`, the challenge-variants designs for social nights. Every string and state: `today-porting-brief.md` sections 1.2, 1.5, 6.2, 6.4, 6.6.

## What differs from the web, on purpose (said plainly to the owner)

- **The plan and the social night are bottom sheets**, like the task sheets, not centred dialogs: one kind of sheet on the phone, in thumb reach.
- **A time or a day starts empty behind a button** ("Set a time", "Pick a day"): the phone's own pickers always show a value, and "no plan" must stay possible.
- **The knife's sound is a file**, rendered by `mobile/scripts/render-sounds.mjs` from the same recipe as the web's synthesis (the phone has no WebAudio). Nobody has heard it yet: the owner's ear decides.
- Still for part 4c: the fills, the tile shrinking into its chip, the gauge's wave, the day-complete peak and its chime, the weigh-in's fold, the animated flame.

## Global Constraints

- Parts 1 to 4a's constraints hold (worktree, `npm run check` before every commit, `@logic/*` only, `transaction()`, no clock or ref read while rendering, tests outside `app/`, 48-point targets, 16-point fields, reduce motion, lines said aloud with `useAnnounceChanges`).
- One sheet at a time: the plan, the social night and "Add workout" swap into the open `Sheet`.
- The duck's chatter and his answers to a poke are not said aloud by VoiceOver; his day line, a glare and an announcement are (as on the web).
- The atmosphere sits behind the content and never under text; its red pulse is slow (2.8 s); reduce motion stops the pulse and the flash.
- Sounds follow the sound setting (`SETTING_KEYS.soundEnabled`, on unless turned off) and mix with the player's own music.

## Review Focus

1. A plan whose time has passed never blocks saving the others, and an unchanged row keeps the estimate frozen when it was saved.
2. Past the plan plus its estimate plus 15 minutes, the duck says "You said HH:mm." and the plan button still offers to edit; while he hunts it reads "Too late to plan" and does nothing.
3. Three pokes within 1.8 s make one lunge and one flash; the fourth starts again. Nothing flashes under reduce motion.
4. A social night: tomorrow at the earliest, one per challenge week, never on Hard; cancelling today's asks first and un-completes a day that leaned on it.
5. Before noon with yesterday unfinished: the card shows, yesterday's board logs onto yesterday's entry (photo from the library only), and finishing it removes the card. At noon it is gone and the day is missed.
6. The morning after Day 75 unfinished: yesterday's view directly, with no way "back to today".
7. Midnight with the plan sheet open: the sheet goes with the day.

---

### Task 1: Social days in the repository

`challengeRepo.setSocialDay(id, dayNumber, on, today): Promise<SocialDayResult>` as on the web (declared the day before at the latest, one per challenge week, only where the rules allow, a past one can't be cancelled, cancelling today's re-syncs today), in one transaction.

Tests: the web's ten "social occasions" cases, same names.

### Task 2: The duck speaks

- `mobile/src/hooks/useSound.ts` (`useKnifeSound`), `mobile/assets/sounds/knife-shing.wav`, `mobile/scripts/render-sounds.mjs`.
- `mobile/src/components/mascot/Mascot.tsx`: his eyes follow a finger (`rig.touch` in the art's units, from a small `gaze` store the screen feeds) and glance down when the page scrolls.
- `mobile/src/today/DuckHeader.tsx`: `useDuck` as on the web: the bubble above him, his line a beat after Today opens and when it changes (unless it is under the gauge), a catchphrase every 40 to 75 s, a glare with "I saw that." when a task is unticked, a nod when one is ticked, an announcement pushed by the screen, the pokes and the lunge.

Tests, from `DuckHeader.test.tsx`: the first line after the delay; a changed line; nothing repeated in the bubble while the line is under the gauge; the glare line; the poke lines cycling and the lunge on the third quick poke; an announcement with its reaction; chatter never repeating the last line; the sound only when the setting allows.

### Task 3: The evening

- `mobile/src/today/MenaceAtmosphere.tsx`: the dark vignette while he taps, the red glow pulsing while he hunts, one red flash per lunge, the top of the screen kept clear.
- `mobile/src/today/PlanSheet.tsx` (`PlanForm`): "Tell the duck your plan", a row per missing task, the two errors for rows changed since it opened, "Save plan", the frozen estimates, `onSaved(earliest)`.
- `TodayScreen`: the row under the board ("Plan my evening" / "Edit my plan" / "Too late to plan", "Social night", "Notes"), the duck's answer to a saved plan, the atmosphere behind the page.

Tests, from `PlanSheet.test.tsx` and `TodayScreen.test.tsx`: the nine plan cases; the three labels of the plan button; the atmosphere's level and its flash; Review Focus 1, 2, 3 and 7.

### Task 4: Social nights

`mobile/src/today/SocialOccasionSheet.tsx` (`SocialForm`): "Plan a social night", the day, "Declare", the four refusals, the "Declared" list with Cancel and today's confirmation. Reached from the row under the board, from the diet sheet and from the countdown before Day 1; the duck answers "{Weekday}. One drink. I'm counting.".

Tests, from `SocialOccasionSheet.test.tsx`: its nine cases; the diet tile's glass on a declared day; Review Focus 4.

### Task 5: Yesterday

`mobile/src/today/LateDay.tsx`: `LateDayCard` ("Day N isn't finished", "Forgot to log it? You have until 12:00.", "Finish it") and `LateDayView` ("Today", "Yesterday", "Finish Day N", the same board with the photo from the library only, "Notes"). `TodayScreen` shows the card under the hero, the view when it is opened, and the view directly the morning after Day 75. The duck's calm line becomes "Yesterday's still open. Noon.".

Tests, from `LateDay.test.tsx` and `TodayScreen.test.tsx`: the card only before noon and only while yesterday is unfinished; logging onto yesterday's entry; the library-only photo; back to today; Review Focus 5 and 6.

### Task 6: On the phone, then the review

- [ ] The owner tries an evening (the developer seed and the phone's clock help), a poke, a lunge, the sound, a social night on Strong, and a late day.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first, list the Minor ones in the ledger.

## Done when

- `npm run check` passes in `mobile/`.
- The seven Review Focus cases hold in tests.
