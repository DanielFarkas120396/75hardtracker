# Challenge variants: 75 Strong, 75 Medium and 75 Soft (design)

Date: 2026-09-26. Status: agreed with the owner, point by point.

## 1. Goal

Today the app only knows 75 Hard. Its rules are global constants, and the rule text is hard-coded across screens. This design adds three lighter challenges, chosen per attempt.

**Out of scope (noted for later):**
- colour palettes;
- the welcome flow with a local profile (name, goal, diet, typical schedule).

**Binding constraint.** The owner has a live 75 Hard attempt on an iPhone. It must pass through every release unchanged:
- same days, same completion, same streak, same XP;
- no Dexie version bump, so a rollback still opens the database.

## 2. Rules

| | 75 Hard | 75 Strong | 75 Medium | 75 Soft |
|---|---|---|---|---|
| Workouts | 2 × 45 min, one outdoors | as Hard | 1 × 45 min | 1 × 45 min, plus one recovery day a week |
| Diet | follow the diet (no cheat meals), no alcohol | as Hard, but a drink is allowed on a declared social occasion | eat healthy; a drink only on a declared social occasion | as Medium |
| Water | 3.8 L | 3.8 L | 3 L | 3 L |
| Reading | 10 pages, non-fiction | as Hard | 10 pages, any book | 10 pages, any book |
| Photo | one a day | one a day | one a day | one a day |
| Missed day | back to Day 1 | back to Day 1 | 1 joker | 3 jokers |

Every variant keeps the same five tasks (`TASK_IDS`). Only targets, copy, the recovery day, social occasions and jokers differ.

**Challenge week.** Day `d` belongs to week `Math.ceil(d / 7)`: days 1–7, 8–14, …, 71–75 (the last week has 5 days). It doesn't depend on the calendar weekday.

**Social occasion** (Strong, Medium and Soft):
- It is declared for a day **at least one day ahead**: tomorrow or later, never today.
- At most **one per challenge week**.
- On that day the "no alcohol" condition is waived. The diet toggle ("I followed my diet" or "I ate healthy") is still required.
- A declaration can be cancelled for today or a future day, never a past one. Cancelling only makes a day stricter.

**Recovery day** (Soft):
- At most one per challenge week.
- It is taken on the day itself, from Today's Workouts card.
- That day, the workouts task counts as complete.

**Jokers** (Medium: 1, Soft: 3). A day before today that isn't complete is a missed day.
- While the misses number no more than the jokers, the attempt goes on. Each miss uses a joker.
- The miss after the last joker fails the attempt, and the app shows the existing restart flow.
- A miss resets the 🔥 streak, because the streak counts consecutive perfect days. The attempt itself continues.

**Changing the variant** is allowed while the start date is editable: before Day 1, or on Day 1 (`isStartDateEditable`).
- After a victory, the next challenge is chosen along with its start date.
- After a failure, the restart keeps the variant, which can then be changed on the new Day 1.

## 3. Data model

These fields are all optional and not indexed, so there is **no Dexie version bump**.

```ts
// src/db/types.ts
interface Challenge {
  // …existing: id, startDate, attemptNumber, status
  variant?: ChallengeVariant    // missing = 'hard' (every existing row)
  socialDays?: number[]         // declared social-occasion day numbers
  jokersAcknowledged?: number   // jokers the user has seen announced
}
interface DayEntry {
  // …existing
  restDay?: true                // Soft recovery day
}
```

New rows always write `variant`. Reads go through `variantOf(challenge)`: a missing or unknown value means `'hard'`.

**Export/import.** `EXPORT_VERSION` stays 1, because the new fields are additive. Validation in `ROW_CHECKS`:
- challenge `variant`: optional, one of the four ids;
- `socialDays`: optional list of integers from 1 to 75;
- `jokersAcknowledged`: optional integer ≥ 0;
- day entry `restDay`: optional boolean.

`normalize` removes recovery days and social days the rules don't allow: the wrong variant, a second one in the same week, or a day out of range. It then recomputes completion for the affected days.

## 4. The ruleset module

```ts
// src/logic/rulesets.ts
export type ChallengeVariant = 'hard' | 'strong' | 'medium' | 'soft'
export interface Ruleset {
  variant: ChallengeVariant
  requiredWorkouts: number      // 2 | 2 | 1 | 1
  requireOutdoor: boolean       // true | true | false | false
  minWorkoutMin: number         // 45
  waterTargetMl: number         // 3800 | 3800 | 3000 | 3000
  pagesTarget: number           // 10
  restDaysPerWeek: number       // 0 | 0 | 0 | 1
  socialDaysPerWeek: number     // 0 | 1 | 1 | 1
  jokers: number                // 0 | 0 | 1 | 3
  dietKind: 'strict' | 'healthy'   // strict | strict | healthy | healthy
  readingKind: 'non-fiction' | 'any'
}
export const RULESETS: Readonly<Record<ChallengeVariant, Ruleset>>
export const VARIANTS: readonly ChallengeVariant[] // ['hard', 'strong', 'medium', 'soft']
export function variantOf(challenge: { variant?: unknown }): ChallengeVariant
export function rulesFor(challenge: { variant?: unknown }): Ruleset
export function challengeWeek(dayNumber: number): number
```

The constants `WATER_TARGET_ML`, `PAGES_TARGET`, `MIN_WORKOUT_MIN` and `REQUIRED_QUALIFYING_WORKOUTS` are **deleted**, so the compiler finds every use. `rules` becomes a **required** parameter: a silent Hard default could judge a Medium attempt by Hard rules. `CHALLENGE_LENGTH`, `MAX_WORKOUTS` and the XP constants stay global.

## 5. Completion

`DayTaskData` gains `restDay?: boolean` and `socialDay?: boolean`. Both are resolved by `toDayTaskData(entry, workouts, challenge)` (`socialDay` = the challenge's `socialDays` includes the entry's day).

**Workouts** is complete when either:
- `rules.restDaysPerWeek > 0 && data.restDay`; or
- the qualifying workouts (duration ≥ `rules.minWorkoutMin`) number at least `rules.requiredWorkouts`, and, when `rules.requireOutdoor` is set, one of them is outdoors.

**Diet** is complete when `data.dietFollowed && (data.noAlcohol || (rules.socialDaysPerWeek > 0 && data.socialDay))`.

**The other tasks:**
- **Water:** `water_ml ≥ rules.waterTargetMl`.
- **Reading:** `pages_read ≥ rules.pagesTarget`.
- **Photo:** unchanged.

**The stored flag.** `syncDayCompletion(entryId)` reads the entry's challenge inside its transaction and uses `rulesFor(challenge)`. So the flag can never disagree with the variant. Every repository transaction that syncs completion uses the shared `COMPLETION_TABLES` (dayEntries, workouts, challenges; photoRepo adds photos).

## 6. The gate: missed days, jokers and completion

```ts
// src/logic/restart.ts
missedDayNumbers(entries, todayDayNumber): number[]   // days 1 … min(today − 1, 75) not complete
evaluateChallenge({ currentStatus, dayEntries, todayDayNumber, jokers })
  : { status: ChallengeStatus; missed: number[]; failedDayNumber?: number }
```

- **Failed** when `missed.length > jokers`. `failedDayNumber = missed[jokers]`.
- **Completed** when not failed, and either today > 75, or today = 75 with Day 75 complete.
- **Otherwise active.**

For Hard (0 jokers) this is today's rule, with one fix. The old scan reached Day 76, which never has an entry, so an attempt that was fully complete but first opened on Day 77 was wrongly failed. The cap at 75 ends that.

**Gate kinds** (`useChallengeGate`):
- `needsRestart`;
- `completed`;
- a new `jokerUsed`, when active and `missed.length > (challenge.jokersAcknowledged ?? 0)`;
- `active`.

Completion wins over `jokerUsed`.

## 7. Streak, XP, badges and stats

- **Streak:** unchanged (consecutive complete days). A miss resets it.
- **XP:** unchanged per task (10), plus the perfect-day bonus (25) and the milestone bonuses. Completion comes from the attempt's ruleset.
- **Badges:** unchanged list. "Hydrated" uses the attempt's water target, and qualifying workouts use its minimum.
- **Victory:** shows the real streak instead of a hard-coded 75, and "Jokers used x/y" for Medium and Soft.

## 8. Screens

**Today**
- **Header:** "75 Medium · Attempt #2", which replaces "Attempt #2".
- **Jokers chip:** Medium and Soft show "🃏 1 joker left" or "🃏 3 jokers left" next to the header stats. It is hidden for Hard and Strong.
- **Day-1 hint:** while the variant can still change, a small line under the header reads "Doing 75 Hard. You can switch challenge in Settings until the end of Day 1."
- **Cards:** targets and copy come from the ruleset (§10).
- **Workouts card (Soft):**
  - offers "Take my recovery day";
  - once taken: "Recovery day ✓", with "Undo";
  - if the week's recovery day was used on another day: "Day 9 was this week's recovery day."
- **Diet card (Strong, Medium, Soft):**
  - "🥂 Plan a social occasion" opens a sheet (`Modal`);
  - the sheet has a date picker (tomorrow to Day 75) and a "Declare" button; errors explain `too-late` (before tomorrow) and `week-taken` (the week already has one);
  - below the picker, the sheet lists the declared occasions from today on, each with a "Cancel" button;
  - on a declared day, the "No alcohol" toggle is replaced by "🥂 Social occasion today — a drink is allowed.";
  - after declaring, the duck announces "Saturday. One drink. I'm counting." (the weekday of the declared day), through the existing DuckHeader announcement.

**JokerUsedScreen** (full screen, like DayFailed):
- the judging duck;
- title: "Day 12 wasn't completed", or "Days 12 and 13 weren't completed";
- the missed tasks (the list shared with DayFailed);
- "Joker used. 0 left." (or "2 jokers used. 1 left.");
- the duck's line "I'll let that one go. Once.";
- "Keep going" calls `challengeRepo.acknowledgeJokers(id, missed.length)`, which only increases the count.

**Journey:** a `missed` node state for joker days: muted, with 🃏.

**Settings → Challenge** (the start-date section, renamed "Challenge"):
- a variant picker: four cards, each with its name and one-line rules, above the start date;
- both can be edited while the start date can. Afterwards the section shows the variant read-only.
- `challengeRepo.changeVariant(id, variant, today)`:
  - clears social days and recovery days the new rules don't allow;
  - recomputes the completion of the attempt's entries;
  - runs in one transaction.

**Victory:** "Start a new challenge" opens a sheet with the variant picker (defaulting to the finished variant) and a start date: Today, Tomorrow or a date. It calls `challengeRepo.startNew(startDate, variant)`.

**DayFailed and PreStart:** copy per variant (§10).

## 9. The duck's menace

`minutesToFinish(task, data, rules)`, `planError(task, time, data, nowMin, rules)` and `menace({ …, rules })` use the ruleset:
- Medium and Soft water estimates count toward 3 L;
- workouts need `rules.requiredWorkouts` (plus one when outdoors is required and missing);
- a recovery day or a social day completes its task, so the task isn't missing.

## 10. Copy (English UI)

| Where | Hard | Strong | Medium | Soft |
|---|---|---|---|---|
| Picker line | Two 45-min workouts (one outdoors), strict diet, no alcohol, 3.8 L of water, 10 pages of non-fiction, a photo. Miss a day: back to Day 1. | Everything in 75 Hard, plus one social occasion a week, declared the day before. | One 45-min workout, eat healthy, 3 L of water, 10 pages of any book, a photo. One social occasion a week. One joker. | Like 75 Medium, plus a recovery day a week. Three jokers. |
| Workouts card | 2 sessions of at least 45 minutes, one of them outdoors. | as Hard | 1 session of at least 45 minutes. | 1 session of at least 45 minutes. One recovery day a week. |
| Diet card | No cheat meals, no alcohol. | No cheat meals. No alcohol, except a declared social occasion. | Eat healthy. No alcohol, except a declared social occasion. | as Medium |
| Diet toggle | I followed my diet | I followed my diet | I ate healthy | I ate healthy |
| Water amount | 3.8 | 3.8 | 3 | 3 |
| Water card | Goal: 3.8 L a day. | 3.8 L | 3 L | 3 L |
| Reading card | 10 pages of non-fiction a day. | as Hard | 10 pages of any book a day. | as Medium |
| Task rule (failed-day list) | 2 workouts of 45+ min, one outdoors / Diet followed, no alcohol / 3.8 L of water / 10 pages read / Progress photo | as Hard, with the diet line "Diet followed, no alcohol unless declared" | 1 workout of 45+ min / Ate healthy, no alcohol unless declared / 3 L of water / 10 pages read / Progress photo | Soft workout: "1 workout of 45+ min (or a recovery day)" |
| Workouts cheer (first) | Both workouts done! 💪 | as Hard | Workout done! 💪 | as Medium |
| Water cheer (second) | All 3.8 L down | 3.8 L | All 3 L down | All 3 L down |
| DayFailed text | 75 Hard is all-or-nothing on every task, every day. | 75 Strong is all-or-nothing on every task, every day. | 75 Medium forgives one missed day. This was your second. | 75 Soft forgives three missed days. This was your fourth. |
| Victory title | 75 Hard complete! 🏆 | 75 Strong complete! 🏆 | 75 Medium complete! 🏆 | 75 Soft complete! 🏆 |
| Victory line | 75 days. Two workouts, the diet, the water, the reading and the photo — every single day. | as Hard | 75 days. The workout, the diet, the water, the reading and the photo. | as Medium |
| PreStart line | …plan two workouts a day… | as Hard | …plan a workout a day… | as Medium |

Other rules for the copy:
- Litres print without a trailing ".0": `formatLiters` turns 3800 into "3.8" and 3000 into "3" — the water amount, task rule and water cheer rows above all go through it.
- The rest of the copy (the duck's lines, the menace lines) is unchanged.
- `index.html`'s description names 75 Hard, Strong, Medium and Soft.
- The README gets a variants table.

## 11. Delivery

**PR 1: the ruleset engine, with no visible change.**
- `rulesets.ts`, the required `rules` parameters, and the rules lookup in `syncDayCompletion` and `normalize`;
- the capped `missedDayNumbers` and `evaluateChallenge` with `jokers`: 0 for every attempt, which fixes Day 77;
- `Challenge.variant` typed and validated on import, but never written;
- only Hard is reachable.

Tests: the existing suites pass `RULESETS.hard` with **unchanged expectations**. A golden test checks that a database shaped like the owner's (v3, no variant, with plans) gives the same gate, streak and XP, with no row changed.

**PR 2: the variants.** Everything else in §2–§10: data fields, social occasions, recovery days, jokers, pickers, copy, dev scenarios (`seedStrongSocial`, `seedMediumJoker`, `seedSoftRestDay`, `seedDay77Complete`) and the README.

## 12. Risks

1. **A table missing from a completion transaction** throws at runtime, and a logged task would be lost. Mitigations: `COMPLETION_TABLES`, plus tests on every write path.
2. **Hard behaviour drifting silently.** Mitigations: the required `rules` parameters, unchanged test expectations and the golden test.
3. **Release timing.** With `autoUpdate`, a release activates at the next launch. Release in the morning.
