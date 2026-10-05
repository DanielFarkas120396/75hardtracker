# Late logging: design

Date: 2026-10-05 · Status: **built** (PR #22, merged into `v2`).

## Problem

A day closes at midnight. If you did everything but forgot to log it before then, the app counts the day as missed: 75 Hard and Strong go back to Day 1, and Medium and Soft spend a joker. It's the most likely way for a real user to lose trust in the app (see the app review, 2026-10-05).

## Decisions

| Topic | Decision |
|---|---|
| Grace window | Yesterday stays open until **12:00** the next day (local time). |
| How | **Log it for real**: a "Day N isn't finished" card on Today opens yesterday's tasks with the same controls. Yesterday's photo can only come **from the library**. |
| Challenges | **All four.** It's about logging; the tasks still had to be done that day. |

## Rule

- Before 12:00, the day before today (if it's Day 1–75) is the **late day**. Until noon, it doesn't count as missed, even if it's incomplete.
- At 12:00, an unfinished late day counts as missed as before: the restart flow, or a joker.
- **Streak:** while the late day is open and unfinished, the streak counts back from the day before it, so the flame doesn't drop to 0 in the morning.
- **Day 75:** if it's unfinished at midnight, the attempt stays active until 12:00 on "Day 76". It's a victory as soon as Day 75 is complete, and a miss at noon if it isn't.
- **Celebration:** finishing the late day gets the usual day-complete celebration, and the victory if it's Day 75.

## Code

- `src/logic/lateDay.ts`: `GRACE_END_MIN = 720` and `lateDayNumber(todayDayNumber, nowMin)` (the open day, or null).
- In `src/logic/restart.ts`: `missedDayNumbers`, `evaluateChallenge` and `resolveChallengeGate` take an optional `lateDay`. An unfinished late day isn't missed, and Day 76 with an open, unfinished Day 75 stays `active`.
- `calculateStreak(entries, today, lateDay?)`.
- In `useChallengeGate`:
  - reads the clock (`useNow`), so the gate re-evaluates at noon
  - the gate gains `lateDayNumber` (the open day, done or not) and `lateDayPending`
- `useDayCompleteCelebration` also watches the late day.
- **Today:**
  - a `LateDayCard` under the hero while the late day is pending
  - a late-day view with that day's cards: no duck and no plan, a back link, and a library-only photo
  - on Day 76 with Day 75 pending, Today shows the late-day view directly
- Time travel gets a "Yesterday unfinished" stop.

## Testing

- **Unit tests:** the late day before and after noon, missed days, jokers, Day 76, and the streak.
- **Gate hook:** noon closes the window.
- **Today:** the card shows, and finishing yesterday from it hides it.
- **In the browser and on the phone:** through time travel.
