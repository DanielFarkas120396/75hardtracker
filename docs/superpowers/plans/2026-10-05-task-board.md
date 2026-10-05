# Today task board — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Today's five tall task cards with a 2-column grid of six compact tiles, each opening a bottom sheet holding the task's controls.

**Architecture:** Pure status/progress functions in `content/taskStatus.ts`; a `TaskBoard` (tiles) and a `TaskSheet` (bottom sheet with a done-flip) in `screens/Today`; the existing card bodies become sheet bodies (`*Task.tsx`); the camera moves out of the photo body into a `PhotoCapture` provider so it survives the sheet closing. `Modal` gains a `placement: 'sheet'`.

**Tech Stack:** React 19, Tailwind v4 (`@theme` tokens), framer-motion, Dexie live queries, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-05-task-board-design.md`

## Global constraints

- Touch only, iPhone Safari; no hover; `min-h-touch` on controls; 16px+ text in fields.
- Honour reduce motion (`useReducedMotion`; `MotionConfig reducedMotion="user"` is set in `main.tsx`).
- Text 4.5:1 in light and dark; new colour tokens get a contrast test.
- No Dexie version bump; nothing new is stored.
- UI copy in English. Tests: `MotionGlobalConfig.skipAnimations = true`, `freshDatabase`/`addChallenge` fixtures.
- Before every commit: `npx tsc -b && npm run lint && npm run test && npm run build`.

---

### Task 1: Purple tokens + brand contrast test

**Files:**
- Modify: `src/styles/index.css` (light `@theme` block and `.dark` block)
- Create: `src/lib/__tests__/brandColors.test.ts`

- [ ] Add to the light `@theme` block after yellow: `--color-purple: #a98bff; --color-purple-dark: #8a66f0; --color-purple-light: #efe9ff;` and after `--color-yellow-ink`: `--color-purple-ink: #6b3fd4;`. In `.dark`: `--color-purple-light: #2a2347;` and `--color-purple-ink: #c4b0ff;`.
- [ ] Test reads `index.css` with `fs` (see `worldColors.test.ts`), extracts the `@theme {` block and the `.dark {` block, and for each of green, orange, blue, yellow, purple checks `contrastRatio(ink, bg) >= 4.5` for bg in `SURFACE[mode]`, the mode's `--color-canvas` of the block, and `--color-<name>-light` of the block.
- [ ] Run, commit `feat(board): purple tokens for the photo tile, brand contrast test`.

### Task 2: `content/taskStatus.ts` + `content/moods.ts`

**Files:**
- Create: `src/content/moods.ts` (move `MOODS` and `Mood` out of `DayNotesCard.tsx`)
- Create: `src/content/taskStatus.ts`, `src/content/__tests__/taskStatus.test.ts`

**Produces:**
```ts
export type BoardTask = TaskId | 'notes'
export const BOARD_TASKS: readonly BoardTask[]            // TASK_IDS + 'notes'
export const TASK_TITLES: Record<BoardTask, string>       // Workouts, Diet, Water, Reading, Photo, Mood & notes
export function taskStatusLine(task: TaskId, data: DayTaskData, rules: Ruleset, complete: boolean, bookTitle?: string): string
export function notesStatusLine(entry: { mood?: Mood; notes?: string }): string
export function taskProgress(task: TaskId, data: DayTaskData, rules: Ruleset): number | null   // 0..1, null for diet/photo
export function tasksLeftLine(missing: number): string    // "All five done" / "1 task left" / "3 tasks left"
```
Wording per the spec's table. Workouts count = `data.restDay ? required : qualifying workouts` via `isQualifyingWorkout`.

- [ ] Write the test table, run (fails), implement, run (passes), commit `feat(board): status lines and progress per task`.

### Task 3: `Modal` placement `sheet` + focus return

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Create: `src/components/__tests__/Modal.test.tsx`

**Produces:** `ModalProps` gains `placement?: 'center' | 'sheet'` (default center) and `labelledBy?: string`. Sheet: container `items-end p-0`, panel `w-full max-w-md rounded-t-[2.5rem] max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]`, motion `y: '100%' → 0`, `aria-labelledby`. On open remember `document.activeElement`; when `open` turns false, focus it again if still in the document.

- [ ] Tests: sheet renders a dialog labelled by the heading; closes on backdrop click and Escape; focus goes to the panel on open and back to the trigger on close.
- [ ] Commit `feat(ui): bottom-sheet placement for Modal`.

### Task 4: `Burst` + `DoneBadge` out of `Card`

**Files:**
- Create: `src/components/ui/Burst.tsx` (the `Burst` from Card, unchanged) and `src/components/ui/DoneBadge.tsx` (the popping ✓ badge: `pop: boolean` animates from scale 0 unless reduce motion)
- No test of their own (covered through TaskBoard and TaskSheet).

- [ ] Commit `refactor(ui): Burst and DoneBadge as their own components`.

### Task 5: task tones + `TaskBoard`

**Files:**
- Create: `src/screens/Today/taskTones.ts`: `TASK_TONES: Record<BoardTask, { tint: string; ink: string; bar: string; iconBox: string }>` (Tailwind classes: workouts orange, diet green, water blue, reading yellow, photo purple, notes `bg-surface ring-1 ring-ink/10 dark:ring-0` / `text-ink-muted`), `TASK_ICONS: Record<BoardTask, IconName>`.
- Create: `src/screens/Today/TaskBoard.tsx`, `src/screens/Today/__tests__/TaskBoard.test.tsx`

**Produces:**
```ts
interface TaskBoardProps {
  entry: DayEntry; data: DayTaskData; completion: Record<TaskId, boolean>; missing: readonly TaskId[]
  rules: Ruleset; bookTitle?: string; photo?: Blob; onOpen: (task: BoardTask) => void
}
export function TaskBoard(props: TaskBoardProps)
```
Renders `<p>` tasksLeftLine, then `<div class="grid grid-cols-2 gap-3">` of `TaskTile`. A tile is a `<button type="button">` with: icon in a rounded square, title, status line, progress bar (`taskProgress` non-null), `DoneBadge` + `<span class="sr-only">, done</span>` when done; done → `bg-world-soft`, else the tone's tint; photo done → `BlobImage` cover + dark gradient + white text. The tile pops (Burst + DoneBadge pop) when `complete` flips to true after mount (previous-render compare).

- [ ] Tests: six buttons named "Workouts 0 of 2 · 45 min each" etc. (Hard, empty entry); "3 tasks left" with 2 done; a done water tile says "3.8 L" and "done"; the photo tile renders an `img` when done with a blob; progress bar width `50%` at 1.9 L of 3.8; click calls `onOpen('water')`; mounting done → no burst; flipping → burst present.
- [ ] Commit `feat(board): the task grid`.

### Task 6: `TaskSheet`

**Files:**
- Create: `src/screens/Today/TaskSheet.tsx`, `src/screens/Today/__tests__/TaskSheet.test.tsx`

**Produces:**
```ts
export interface TaskSheetContent { task: BoardTask; ruleLine: string; complete: boolean; cheer?: string; body: ReactNode }
export const CHEER_VISIBLE_MS = 1500
export function TaskSheet({ content, onClose }: { content: TaskSheetContent | null; onClose: () => void })
```
Keeps the last non-null content in a ref so the exit animation shows it. Inside `Modal placement="sheet"`, `SheetContent key={task}`: header (tone tint, icon box, `<h2 id>` title, rule line, close button `aria-label="Close"`), then `body`. Previous-render compare on `complete`: when it turns true → `DoneBadge pop`, cheer pill in `role="status"`, `vibrate(20)`, timer `CHEER_VISIBLE_MS` → `onClose()`. Opens already complete → badge, no cheer, no timer. Turns false → badge and cheer go, timer cleared.

- [ ] Tests (fake `setTimeout`): renders header + body, close button calls onClose; flipping complete shows the cheer, vibrates once, and calls onClose after 1500 ms; opening complete shows ✓ and never auto-closes; flipping back clears the cheer and cancels the timer.
- [ ] Commit `feat(board): the task sheet with its done flip`.

### Task 7: `PhotoCapture` + `useEntryPhoto` + `useCurrentBook`

**Files:**
- Create: `src/hooks/useEntryPhoto.ts` (`useEntryPhoto(photoId: number | null | undefined): Photo | undefined` live query), `src/hooks/useCurrentBook.ts` (`{ books, currentBook }` from `bookRepo.getAll` + `SETTING_KEYS.currentBookId`).
- Create: `src/screens/Today/PhotoCapture.tsx`: provider with context `{ photo, busy, error, cameraFailed, libraryOnly, takePhoto(), chooseFromLibrary() }`, `usePhotoCapture()`. Props: `entry`, `libraryOnly?`, `openCameraNow?`, `onCameraOpened?`, `onCameraOpen?` (called whenever the camera or the phone's camera app opens, so the host closes the task sheet), `children`. Owns the two hidden inputs, `savePhoto` (compress + `photoRepo.replaceForEntry`), the portalled `CameraSheet` with ghost and `onUnavailable`. Logic copied from `PhotoCard.tsx` minus the card.
- Move `PhotoCard.test.tsx`'s three camera cases to `PhotoCapture.test.tsx` (render provider with a child button calling `takePhoto`).

- [ ] Commit `refactor(today): camera and photo saving live in PhotoCapture`.

### Task 8: card bodies become `*Task.tsx`

**Files:**
- Rename `WorkoutCard.tsx → WorkoutTask.tsx` (props minus `cheer`; keeps `complete` for the recovery control), `DietCard → DietTask` (minus `complete`, `cheer`), `WaterCard → WaterTask` (minus `complete`, `cheer`; drop the "Goal:" line, the header carries it), `ReadingCard → ReadingTask` (minus `complete`, `cheer`; uses `useCurrentBook`), `PhotoCard → PhotoTask` (props: `entry` only; reads `usePhotoCapture()`; shows preview/"No photo yet", buttons, cameraFailed note, error), `DayNotesCard → DayNotesTask` (no section/title; mood row + notes field; imports `MOODS` from content).
- Rename the tests accordingly; drop the `Card` wrapper expectations; `PhotoTask.test.tsx` renders inside `PhotoCapture`.
- Delete `src/components/ui/Card.tsx` and `src/components/__tests__/Card.test.tsx`.

- [ ] Commit `refactor(today): task controls as sheet bodies`.

### Task 9: `TodayScreen` and `LateDay` on the board

**Files:**
- Modify: `src/screens/Today/TodayScreen.tsx`, `src/screens/Today/LateDay.tsx`
- Create: `src/screens/Today/useTaskSheets.tsx` — `describeTask(task, ctx): TaskSheetContent` building title/rule line/complete/cheer/body for each of the six tasks from `{ entry, workouts, data, completion, rules, dayNumber, socialToday, canPlanSocial, onPlanSocial, weekRestDay, libraryOnly, currentBook }`.
- `TodayTasks`: state `openTask: BoardTask | null`; wrap in `<PhotoCapture entry openCameraNow onCameraOpened onCameraOpen={() => setOpenTask(null)}>`; `<main>` holds `<TaskBoard … onOpen={setOpenTask} />`; `<TaskSheet content={openTask && describeTask(openTask, ctx)} onClose={() => setOpenTask(null)} />`. Same in `LateDayView` with `libraryOnly`, `canPlanSocial: false`.
- `TodayScreen.test.tsx`: open the tile before asserting a control (`fireEvent.click(screen.getByRole('button', { name: /^Diet/ }))`); late-day case opens the photo tile and checks the library-only wording.

- [ ] Commit `feat(today): the task board replaces the cards`.

### Task 10: README, phone check, PR

- [ ] README "Today" feature: tiles + sheet wording; spec status → built.
- [ ] `npm run dev` in the browser at 375px: hell and heaven (`?db=time-travel&travel=1` / `&travel=75`), light and dark, a sheet open, reduce motion; screenshots.
- [ ] Four checks, push, PR into `main`.
