# v4 Part 4c-2: Today, the board's choreography and the gauge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A task that gets done plays out as on the web: its tile fills to the top, glows, and shrinks into its chip while the other tiles close up; the chip's tick pops; the gauge then counts it with one wave through its bars, and at 5/5 the crown fills, pops and sparkles. An undone task grows back.

**Architecture:** The board's phases are the web's reducer (`@logic/boardPhases`: tile, full, morphing, chip). `TaskBoard` follows the web's effects one for one. The movement is Reanimated's: the lifted tile's box travels between two boxes the board knows from layout, its title and icon fly as separate views, the other tiles move with a layout transition. The gauge stays react-native-svg, its bars, label and crown driven by shared values on the UI thread.

**Tech Stack:** as part 4c-1 (Reanimated 4, react-native-svg).

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 4c). Web designs: `2026-10-05-task-board-design.md` and its rounds, `2026-10-07-gauge-ring-design.md`, `2026-10-09-task-tile-fills-design.md`. Every timing: `today-porting-brief.md` sections 5.1 and 5.8.

## What differs from the web, on purpose (said plainly to the owner)

- **The chip shows one or two frames after the tile lands on it**, not in the very same frame: the flight ends on the phone's UI thread and the chip is shown by React. The lifted tile stays where it landed, looking like the chip, until then.
- **A tile that widens shows its content at the new width at once**, revealed as the box widens (the web redraws the content at each width on the way).
- **The gauge's bars change colour in step with the wave, without the web's 0.6 s colour transition per bar** if that proves too heavy for 41 bars; said in the report if so.

## Global Constraints

- Parts 1 to 4c-1's constraints hold.
- The web's numbers: hold 380 ms, morph 720 ms `cubic-bezier(.55,0,.2,1)`, resize 460 ms `cubic-bezier(.2,.8,.2,1)`, tick 440 ms, chip bounce 360 ms; gauge front 700 ms, waves 950 / 1100 / 850 ms, number pulse 600 ms, crown fill 260 ms and pop 800 ms, twelve stars.
- Reduce motion: no glow, the tile fades out as the chip fades in (250 ms), no slides; the gauge shows its end state at once.
- The gauge counts chips that have landed, never saved completions. While a sheet is open the board holds still and plays what changed once it closes.
- "{Title} done." is said, and the light haptic given, when the task becomes done (not when the chip lands).

## Review Focus

1. Opening Today with tasks done: chips at once, the gauge counts up from 0 once, nothing else moves.
2. A task done from the board: tile → full (its fill settled at the top) → glow → morph → chip; the gauge moves only when the chip lands.
3. A task undone at any phase goes back to a tile, and the gauge steps down.
4. Two tasks done close together each make their trip; the gauge ticks once per chip.
5. The board reports "busy" until the last chip has landed (the day-complete peak waits on it, part 4c-3).
6. A sheet open over the board: frozen; the change plays after.
7. Reduce motion: no movement, the same end state.

---

### Task 1: The phases on the board

`TaskBoard`: `phasesReducer` with `sync`, `full` (the fill's `settledAt === 1`, or at once without a fill), the hold, `morph`, `landed`; `onLandedChange`; `setBoardBusy` (`mobile/src/today/boardSettle.ts`, the web's store and `useSettledCelebration`); the chips row shows morphing and landed tasks, the grid the open ones.

Tests, from `TaskBoard.test.tsx` with fake timers and a fake engine: the phases in order; undo from each phase; the landed count; busy until the last chip; nothing animates on opening.

### Task 2: The trip into the chip

`mobile/src/today/boardMotion.tsx`: the glow (ring in world ink to 80%, scale 1.03, 500 ms), `MorphingTile` (the box from the tile's to the chip's, corners 20 → pill, the surface passing through 55% world colour at 22% of the way, the content fading in the first 30%, the title and the icon flying to the chip's, the photo gathering as a 72-point circle into the thumbnail), the tick's pop and the chip's bounce, the reduce-motion fade.

Tests: the morph ends by reporting "landed" once; cancelled when the task is undone; under reduce motion the trip is a fade.

### Task 3: The others close up

The grid's cells move and resize with a layout transition (460 ms); a tile coming back grows in (opacity 0, scale 0.92 → 1); a chip leaving fades and shrinks (0.8); the buttons under the board follow.

### Task 4: The gauge's wave

`mobile/src/components/GaugeRing.tsx`: `held`, the count-up from 0 on first mount, one timeline per change (the front lighting or dimming bars, the wave riding it, the grey bars ahead absorbing it short of 5/5, the number ticking once per task with its pulse, the label and the crown filling with the front, the white sweep), and at 5/5 the crown's fill and pop, the label's pop and twelve stars. A change cut short starts again from where the gauge was.

Tests, from `GaugeRing.test.tsx`: 3/5 and 5/5 at rest; held keeps the last state and catches up; the number ticks once per task from where it was; reduce motion shows the end at once.

### Task 5: Wiring

`TodayScreen` gives the gauge the landed count (the hero no longer counts completions), freezes the board under a sheet, and `LateDayView` does the same.

### Task 6: On the phone

- [ ] The owner completes each task from its tile and from its sheet, undoes one, and finishes a day; light and dark; reduce motion once.

## Done when

- `npm run check` passes in `mobile/`.
- The seven Review Focus cases hold in tests.
