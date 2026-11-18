# v4 Part 4d: how an attempt ends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every way an attempt can turn has its screen on the phone, as on the web: a missed day beyond the jokers ("Day N wasn't completed", restart from Day 1), a joker spent ("Joker used. N left.", "Keep going"), giving up from Settings (four confirmations, then "You gave up on Day N"), and all 75 days done (Victory, with its numbers), each leading to the next attempt.

**Architecture:** The gate already says which it is (`@logic/challengeGate`: `needsRestart`, `jokerUsed`, `abandoned`, `completed`); `Today` shows the matching screen in place of its plain "not running" one. The repository gains the web's `restart`, `markCompleted`, `giveUp` and `acknowledgeJokers`, each one transaction. The three blocking screens hide the tab bar (the web replaces the whole app with them); Victory stays inside the Today tab. "Start a new challenge" and the give-up flow are bottom sheets built from part 3's `VariantPicker` and `StartDateChoice`.

**Tech Stack:** as part 4c.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 4d). Web designs: `2026-09-27-give-up-challenge-design.md`, `2026-09-26-challenge-variants-design.md` (jokers), `2026-10-30-restored-backup-design.md` (a gap is not a failure). Web code: `src/screens/RestartFlow/`, `src/screens/Victory/`, `src/screens/Settings/GiveUpFlow.tsx`, `src/App.tsx`.

## What differs from the web, on purpose (said plainly to the owner)

- **"Give up this challenge" sits on the Settings tab as it is today** (a placeholder with developer buttons): the real Settings screen is part 8, and the row moves into its "Danger zone" then.
- **"Start a new challenge" and the give-up steps are bottom sheets**, like every sheet on the phone (the web centres them).
- **Victory's confetti**: the web fires a library's burst (140 pieces in the world's colours). The phone gets the same burst drawn by hand (same count, spread, speed and colours, falling under gravity); none under reduce motion.
- The blocking screens (missed day, joker, gave up) hide the tab bar instead of replacing the app.

## Global Constraints

- Parts 1 to 4c's constraints hold (the `v4` worktree, `npm run check` before every commit, `@logic/*` only, `transaction()` for every write, no clock or ref read while rendering, tests outside `app/`, one sheet at a time, 48-point targets, 16-point fields, reduce motion).
- Same wording as the web, from `@logic/variantsCopy`, `@logic/microcopy`, `@logic/attempts`; a string that lives in a web component is typed again exactly.
- An attempt is never lost by a double tap: restarting twice makes one new attempt; a second "Keep going" changes nothing; giving up only from Day 1 to Day 75 of an active attempt.
- A screen that replaces Today takes VoiceOver's focus on its title.
- No "Badge unlocked" or day-complete peak over bad news; Victory's confetti waits until the Day 75 peak has been dismissed.

## Review Focus

1. A missed day with no joker left: the screen lists what that day lacked, "Restart from Day 1" archives the attempt as failed and starts the next one today, with the same challenge; a double tap makes one attempt.
2. A missed day with a joker: the joker screen, once; "Keep going" returns to Today and it never shows again for that day; two missed days at once are named together.
3. The last joker: "That was your last joker. Next time, it's Day 1."
4. Give up: every step's first button leaves; step 3's button is locked 5 s; step 4 needs GIVE UP typed (case and spaces forgiven); then "You gave up on Day N", and Today is that screen until a new attempt starts.
5. Day 75 complete: the peak ("See your victory"), then Victory with the attempt's numbers and its confetti once; the attempt is saved as completed.
6. "Start a new challenge": the challenge defaults to the one just ended, the start to today (tomorrow after 18:00), a start before today is refused; the old attempt's days stay.
7. Opening the app on each of the four states shows its screen at once, never a blank or a flash of Today.

---

### Task 1: The repository

`challengeRepo.restart(failedChallengeId, startDate)`, `markCompleted(id)`, `giveUp(id, today)`, `acknowledgeJokers(id, count)`; `loadChallengeDays(challengeId)` for the stats; `useChallengeGate` marks a finished attempt completed (the web's `completedChallengeId`).

Tests: the web's cases from `repositories.test.ts` for these four (same names), and the gate marking Day 75 complete.

### Task 2: The screens that replace Today

`mobile/src/endings/`: `DayFailedScreen`, `JokerUsedScreen`, `GaveUpScreen`, with `GateHeading` (takes VoiceOver's focus), `MissedTasksList` and `YouSaid`. `Today` picks them from the gate; a joker now holds Today back until it is acknowledged.

Tests, from `DayFailedScreen.test.tsx`, `JokerUsedScreen.test.tsx`, `GaveUpScreen.test.tsx`: their words for one and several days, with and without a profile; the missed list; restart, keep going and their failure line; Review Focus 1, 2, 3 and 7.

### Task 3: A new challenge, and Victory

`NewChallengeForm` in a `Sheet` (the challenge, the start, "A new attempt starts on …", Start / Cancel) and `VictoryScreen` (the triumphant duck, "Attempt #N", the title and dates, the line, "Start a new challenge", the six numbers, the confetti once per session after the peak, the chime).

Tests, from `NewChallengeSheet.test.tsx` and `VictoryScreen.test.tsx`: Review Focus 5 and 6; "Jokers used" only where the challenge has jokers.

### Task 4: Give up

`GiveUpFlow` (four steps in one `Sheet`) and its row on the Settings tab while `canGiveUp(gate)`.

Tests, from `GiveUpFlow.test.tsx` and `GaveUpScreen.test.tsx`: Review Focus 4; the duck's line for 0, 1 and several perfect days; Day 75's own last warning.

### Task 5: On the phone, then the review

- [ ] The owner walks each ending with the developer seed and the phone's clock.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first, list the Minor ones in the ledger.

## Done when

- `npm run check` passes in `mobile/`.
- The seven Review Focus cases hold in tests.
