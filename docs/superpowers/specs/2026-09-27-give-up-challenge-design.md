# Giving up a challenge (design)

Approved by the owner on 2026-09-27: four confirmations, then a "You gave up" screen that starts the next challenge. Status: **built** (PR #5, merged into main on 2026-09-27). In v2, the danger zone is a group of rows at the bottom of Settings, and "Give up this challenge" opens the same flow.

## 1. Goal

A way to end the running attempt on purpose. The owner needs it now, to try the other challenges (the challenge locks after Day 1). Later, anyone can use it to stop. Because giving up is final, it sits behind four confirmations.

## 2. Rules

- **When it's allowed:**
  - only the active attempt, from Day 1 to Day 75 (`isChallengeDay(todayDayNumber)`);
  - only while the app's gate is `active`: not on the Victory, restart or joker screens;
  - not before Day 1: the challenge and its start date can still be changed then.
- **It's final.** There's no resume and no undo.
- **What changes on the attempt:** only `status` and `abandonedOn`. Its days, photos, badges and XP stay, and it appears in the history as **Abandoned**.
- **The next attempt:**
  - Afterwards, the app shows the "You gave up" screen until the next attempt is started.
  - Its button opens the existing "Start a new challenge" sheet: the challenge (the given-up one by default) and a start date (Today, Tomorrow or Pick a date).
  - The new attempt's number is the highest so far + 1, through the existing `startNew`.

## 3. Data model

- `ChallengeStatus` gains `'abandoned'`.
- `Challenge` gains `abandonedOn?: string`: the local ISO date the attempt was given up. Only `challengeRepo.giveUp` sets it.
- **No Dexie version bump.** Status values aren't part of the schema, and `abandonedOn` isn't indexed. Nothing is backfilled.
- **Import:**
  - `status` accepts `'abandoned'`;
  - `abandonedOn` is optional, and must be a valid ISO date (`isValidISODate`) when present;
  - `EXPORT_VERSION` stays the same.
- **Normalize:** no change.

## 4. `challengeRepo.giveUp(id, today)`

It returns `{ ok: true } | { ok: false; reason: 'locked' }` and runs in one read-write transaction on `challenges`:
- the challenge must exist and be `active`, otherwise the result is `locked`;
- `dayNumberForDate(startDate, today)` must be a challenge day (1–75), otherwise the result is `locked`;
- it writes exactly `{ status: 'abandoned', abandonedOn: today }` and nothing else, so a pre-variants attempt still gets no `variant`.

## 5. The gate

- **`restart.ts`:** `GateKind` gains `'abandoned'`. `evaluateChallenge` already passes non-active statuses through, and `resolveChallengeGate` returns `{ kind: 'abandoned', missed }` for them.
- **`useChallengeGate.ts`:** `ChallengeGate` gains `GateBase & { kind: 'abandoned' }`. `resolveGate` passes it through, and the joker check stays limited to `active`.
- **`useBadgeUnlocks`:** a given-up attempt is never evaluated, just like `needsRestart`. Badge context uses today's day number, so an abandoned attempt could otherwise keep earning badges.
- **`App.tsx`:**
  - `abandoned` renders `GaveUpScreen` full screen, with no bottom nav, like the restart and joker screens.
  - Settings receives `canGiveUp = gate.kind === 'active' && isChallengeDay(gate.todayDayNumber)` and `streak = gate.streak`.

## 6. History

- **`attempts.ts`:**
  - `givenUpDay(startDate, abandonedOn)` gives the day number of `abandonedOn`, or `undefined` when it's missing or not a challenge day.
  - `summarizeAttempt` takes `abandonedOn?`. For `'abandoned'`, `reachedDay` is `givenUpDay(…)`, or else the highest logged day number (0 if none).
  - `endDate` follows the existing rule (non-active and `reachedDay >= 1`), so it's the give-up date.
- **`useAttemptSummaries`** passes `challenge.abandonedOn`.
- **Attempt history:**
  - the chip reads "Abandoned", styled `bg-ink/10 text-ink`;
  - the label stays "Reached Day N";
  - in the detail, an incomplete give-up day is marked `🏳️` and reads "Day N · {date} · gave up", instead of "✗ … missed …".

## 7. Screens

### 7.1 Settings → Danger zone

When `canGiveUp`, the danger zone shows this above "Reset everything":
- the line "Stop this attempt for good. It stays in your history.";
- a full-width `danger` button, **Give up this challenge**, which opens the give-up flow.

### 7.2 The give-up flow (`src/screens/Settings/GiveUpFlow.tsx`)

- **Structure:**
  - A `Modal` whose content mounts on each open, so it always starts at step 1.
  - On every step, the first button (primary) is the way out, and it closes the flow without changing anything. So do a backdrop tap and Escape.
  - Each step's heading takes focus when the step appears. Step 1 leaves focus to the Modal's own panel.
  - The stats (perfect days, XP) come from `useChallengeStats`, loaded as the flow opens.

| Step | Duck | Heading | Body | Stay | Go on |
|---|---|---|---|---|---|
| 1 | — | `Give up {75 Hard}?` | `You're on Day {d} of 75. Giving up ends this attempt for good: you can't pick it back up. It stays in your history.` | Keep going | Give up |
| 2 | judging | `Look at what you built.` | `🔥 {streak}-day streak · {n} perfect day(s) · ⭐ {xp} XP`, then the duck line (below) | I'll stay | I'm sure |
| 3 | hunting | `Last warning.` | `Tomorrow is Day {d+1}. Quitters don't get a Day {d+1}.` (Day 75: `It's Day 75. Quitters don't get a finish line.`) | Keep going | `Give up ({s})`, disabled for 5 s (counting 5 → 1), then `Give up` |
| 4 | — | `Type GIVE UP to confirm.` | `This can't be undone.` and a text field | Cancel | Give up for good (`danger`) |

- **Step 2's duck line:**
  - 0 perfect days: `Not one perfect day yet, and you're already out?`
  - 1 perfect day: `1 perfect day. You'd throw it away?`
  - n perfect days: `{n} perfect days. You'd throw them away?`
- **Step 4:**
  - **The text field:**
    - it's labelled `Type GIVE UP to confirm`;
    - `autoCapitalize="characters"`, `autoComplete="off"` and `spellCheck={false}`;
    - it matches when the text, trimmed, with its spaces collapsed and upper-cased, equals `GIVE UP`.
  - "Give up for good" stays disabled until the text matches, or while it's saving ("Giving up…").
  - It calls `challengeRepo.giveUp(challenge.id, today)`:
    - on `ok`, the gate flips to `abandoned` and the app swaps to the "You gave up" screen;
    - on `locked`, it shows `This attempt can't be given up anymore.`;
    - on an error, it shows `Couldn't give up — try again.`

### 7.3 "You gave up" (`src/screens/RestartFlow/GaveUpScreen.tsx`)

It's laid out like the restart screen, with the judging duck:
- **Heading:** `You gave up on Day {givenUpDay}`, or `You gave up` when that day is unknown.
- **Body:** `{75 Hard}, attempt #{n}. It stays in your history.`
- **Duck line (bold):** `Fine. Pick something. I'm still watching.`
- **Primary button:** **Start a new challenge**, which opens `NewChallengeSheet` (imported from `../Victory/NewChallengeSheet`) with the attempt's variant as the default.
- **Small print:** `Pick your next challenge and when it starts.`

## 8. Dev scenario and README

- **`seedGaveUp()`:** a 75 Hard attempt that started 11 days ago, with Days 1–11 perfect and given up today (Day 12). It opens on the "You gave up" screen.
- **README:**
  - a **Giving up** feature bullet;
  - "giving up" in the Settings bullet;
  - the `seedGaveUp()` scenario row.

## 9. Tests

- **Logic:**
  - `resolveChallengeGate` and `resolveGate` for an abandoned attempt;
  - `summarizeAttempt` for an abandoned attempt, with and without `abandonedOn`;
  - `givenUpDay`.
- **Repository:** `giveUp`
  - sets exactly `status` and `abandonedOn`, and adds no `variant` to a pre-variants attempt;
  - is `locked` before Day 1, after Day 75 and on a non-active attempt;
  - `startNew` then creates attempt N+1.
- **Import:** it accepts `'abandoned'` and `abandonedOn`, and rejects a broken `abandonedOn`.
- **`useBadgeUnlocks`:** it never evaluates an abandoned gate.
- **UI:**
  - each step of the flow, and every way out;
  - the countdown, using fake timers;
  - the typed confirmation, and the `locked` and error messages;
  - Settings shows the button only when `canGiveUp`;
  - `GaveUpScreen` and its sheet;
  - the history chip and the give-up row.

## 10. Delivery

- **One PR:** branch `feat/give-up-challenge`, based on main. The owner merges it when they're ready.
- **Three tasks:**
  1. the engine: data, import, repository, gate, summaries, the badge guard, and the history chip style, so the build stays green;
  2. the "You gave up" screen: App routing, the history's give-up row, and the scenario;
  3. the give-up flow: Settings wiring and README features.
