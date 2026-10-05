# Today as a task board — design

Date: 2026-10-05 · Status: **built**. Delivered as two PRs into `main`: the XP removal (PR #31), then the board.

## Why

On an iPhone, Today takes three screens of scrolling to show the five tasks: each unfinished task is a tall card with all its controls open. Done cards already fold to one line (Card's `summary`), so the problem is the unfinished ones. The owner likes a "quest board" layout: a grid of compact tiles, each opening the task's controls on tap.

## Decisions

| Topic | Decision |
|---|---|
| Layout | A 2-column grid of six tiles under the hero, the duck and the quote: Workouts, Diet, Water, Reading, Photo, and "How was today?" (mood and notes) sixth, so the grid closes. |
| Tap | A tile opens a **bottom sheet** with the task's controls. Today stays underneath; the hero and the duck stay in view above the sheet. |
| Colours | **A pastel per task**, the same in every world: workouts orange, diet green, water blue, reading yellow, photo purple (new tokens), mood neutral (`surface`). The world colour keeps the hero, the done tiles and the nav bar. |
| Done | A done tile turns `world-soft`, swaps its progress for a tick, and its status line becomes the summary ("2 workouts · 95 min"). The photo tile shows the photo itself. |
| Completion | When a task completes inside its sheet, the sheet's header flips to done (tick pops, cheer pill, haptic) and the sheet **closes itself** after the cheer. This replaces today's "card folds after the cheer". |
| XP | **Removed** from the app before the board ships (see below). Tiles carry no XP pill. |
| Late day | "Finish Day N" (yesterday until noon) uses the same board, without the duck. |

## XP removal (PR 1)

XP unlocked nothing: no levels, no rewards, badges ignore it. On 75 Hard a day is either perfect or it ends the attempt, so XP was 75 × days + milestone bonuses, i.e. the day number and the streak in a bigger number. It goes:

- `logic/xp.ts` and its constants (`XP_PER_TASK`, `PERFECT_DAY_BONUS`, `STREAK_MILESTONE_BONUS`) are deleted. `MILESTONES` stays if the streak badges use it.
- `ChallengeStats` and `AttemptSummary` lose `xp`; `DayCelebration` loses `xpEarned`.
- The XP badge leaves the Today hero, the Journey header, the Stats tile, the victory stat, the attempt history rows, the give-up "what you built" line and the day-complete celebration (which keeps the day, streak and cheer).
- The `xp` Button variant and icon go if nothing else uses them.
- README: "XP, streaks and badges" becomes "Streaks and badges". Nothing is stored, so backups are unaffected.

## The board (PR 2)

### Above the grid

Unchanged: the hero (Day N, ring, streak, jokers), the late-day card, the banners, the duck with its bubble and "I've got a plan", the quote. One new line right above the grid, in `ink-muted`: "3 tasks left" / "All five done" (and, on 75 Soft, the recovery day counts as workouts done, as it does today).

### A tile

A `<button>` of fixed height, rounded like a card, with:

- the task's icon in a rounded square of the task's `-ink` colour on its `-light` tint;
- the title in Nunito extrabold;
- one status line, from a pure function in `content/taskStatus.ts`:

  | Task | Not started | In progress | Done (summary) |
  |---|---|---|---|
  | Workouts | "0 of 2 · 45 min each" | "1 of 2 logged" | "2 workouts · 95 min" / "Recovery day" |
  | Diet | "2 to tick" | "1 of 2 ticked" | "Followed · no alcohol" / "Followed · social occasion" |
  | Water | "0 / 3.8 L" | "1.25 / 3.8 L" | "3.8 L" |
  | Reading | "0 of 10 pages" | "4 of 10 pages" | "12 pages · Atomic Habits" |
  | Photo | "No photo yet" | — | "Taken" |
  | Mood & notes | "How was today?" | "😄 Good" / "Notes saved" | — (never "done") |

  Diet on a social day has one thing to tick, so "1 to tick" / "Followed · social occasion". Workouts on 75 Medium/Soft say "0 of 1 · 45 min". Wording follows the ruleset the way the cards do now.

- a thin progress bar along the bottom edge for the measurable tasks (workouts, water, reading), in the task's colour;
- when done: `world-soft` background, a `world` tick badge in the corner (it pops with the existing burst when the task completes while the board is visible, never on mount), and the summary as the status line. The photo tile's background becomes the photo (`BlobImage`, covered, with the title and tick over a soft gradient so they stay readable).

The tile's accessible name is "Workouts, 1 of 2 logged" (title and status); a done tile adds "done".

### The sheet

`Modal` gains a `placement` prop: `'center'` (today's dialog) or `'sheet'`. A sheet is anchored to the bottom edge, full width up to `max-w-md`, with the top corners rounded (`2.5rem` like the camera sheet), at most 85 dvh tall and scrolling inside, padded for the home indicator. It slides up and down (nothing under reduce motion), closes on backdrop tap, Escape and a close button in its header, and moves focus to its heading on open and back to the tile on close. PlanSheet and SocialOccasionSheet keep the centred dialog.

`TaskSheet` renders the sheet for one task:

- a header on the task's tint: the icon square, the title, the rule line the cards show today ("2 sessions of at least 45 minutes, one of them outdoors."), the close button;
- the body: the task's controls. `WorkoutCard`, `DietCard`, `WaterCard`, `ReadingCard`, `PhotoCard` and `DayNotesCard` drop their `Card` wrapper and render their controls only; they are renamed to `WorkoutTask`, … , `DayNotesTask` since they are no longer cards. Their props don't change otherwise.
- completion: `TaskSheet` compares `complete` with the previous render (the pattern Card uses now). When it turns true, the header shows the tick (popped) and the cheer pill, the haptic fires, and the sheet closes after `CHEER_VISIBLE_MS` (1500 ms, down from 2500). The board underneath then shows the tile turned done. Unticking inside the sheet (diet, outdoor) just returns the header to its plain state.
- photo: "Take photo" closes the sheet and opens the existing `CameraSheet` over Today; the camera's own close returns to the board, not the sheet. "Choose from library" stays in the sheet. Arriving from the Gallery's "take a photo" still opens the camera directly.
- mood and notes: the sheet never auto-closes (nothing completes). The notes field keeps its debounced save; closing the sheet flushes it, as unmounting does today.

### Day complete

Unchanged: `DayCompleteCelebration` plays over everything when the fifth task completes. With the sheet closing itself after the cheer, the order is: sheet cheer → sheet closes → tile pops → celebration. The celebration already waits on the gate's live query, so no new timing code.

### Colours

New tokens, light and dark, following the pattern of the four brand colours: `--color-purple`, `--color-purple-dark`, `--color-purple-ink`, `--color-purple-light`. The contrast test covers `purple-ink` on `surface`, `canvas` and `purple-light` in both themes, like the others.

### Files

- New: `src/screens/Today/TaskBoard.tsx` (grid, tile, the "N tasks left" line), `src/screens/Today/TaskSheet.tsx`, `src/content/taskStatus.ts`.
- Changed: `TodayScreen.tsx` and `LateDay.tsx` render `TaskBoard` and one `TaskSheet` (the open task in state, keyed by day); `Modal.tsx` (placement); the six task files (renamed, no wrapper); `Card.tsx` loses the fold, the cheer and the burst (they move to the tile and the sheet) and keeps being the plain surface card Settings-style sections could use; `index.css` (purple tokens); README features ("Today").
- Dexie: untouched. Nothing new is stored.

### Testing

- `taskStatus.test.ts`: every row of the table above, per ruleset where the wording differs.
- `TaskBoard.test.tsx`: six tiles with their status lines and accessible names; a done tile shows the summary and the tick; the photo tile shows the photo; the progress bars; the "N tasks left" line; tapping a tile calls `onOpen(task)`.
- `TaskSheet.test.tsx`: opens with the header and body, closes on backdrop, Escape and the close button, returns focus; the header flips to done and the sheet closes after the cheer when `complete` turns true; it doesn't close when it opens already done; reduce motion skips the pop.
- `Modal.test.tsx` (new): the sheet placement's role, focus and closing.
- The task tests (`WorkoutTask.test.tsx`, …) keep their current cases minus the fold and cheer ones, which move to the two files above. `Card.test.tsx` shrinks to the plain card. `TodayScreen.test.tsx` and the late-day test open the tile before touching a control.
- Contrast test: the purple tokens.
- On the phone (`dev:phone`): the board in hell and heaven, light and dark; the sheet with the keyboard up (notes, book title); the camera from the photo sheet; reduce motion on.

## Out of scope

- Levels, rewards, or any replacement for XP.
- Moving the Day 1 "You can switch challenge in Settings" note.
- Any change to the hero, the duck, the plan or the social occasion sheets.
