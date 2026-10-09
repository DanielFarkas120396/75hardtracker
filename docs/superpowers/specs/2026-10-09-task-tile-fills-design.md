# Task tile fills (design)

Date: 2026-10-09 · Status: **approved** by the owner on 2026-10-09; nothing is built yet. Plan: `docs/superpowers/plans/2026-10-09-task-tile-fills.md`.

On Today, each open task tile fills up with its own animation as the task progresses, in place of the thin progress bar at its bottom, and a full tile turns into its chip. The five fills were chosen one tile at a time in throwaway pages (`docs/prototypes/`, with the exact settings and building notes in its README). `docs/prototypes/today-preview.html` puts all five on the real Today screen with a smoothed flow; the owner approved it on 2026-10-09 ("it looks really good").

## What the owner chose

| Tile | Fill | Prototype |
|---|---|---|
| Reading | An open 3D book: each page read lifts from the right half, curls over the spine and fades; the tile fills from the left, a tenth per page. | `reading-tile.html` |
| Diet | Green ink blooming through water from the switches: half the tile per switch, the whole tile on a social day (one switch). It keeps drifting slowly. | `diet-tile.html` |
| Photo | A camera iris shuts, a flash fires, and its blades swirl open on the day's photo in the world's colour. | `photo-tile.html` |
| Workouts | A sprint: the fill races in from the left with speed lines in lanes; half the tile per workout, the whole tile on Medium and Soft (one workout). Thin lines keep flowing through it. | `workouts-tile.html` |
| Water | A rising wave: two crossing waves and a darker one behind; each pour sloshes, sends a ripple from the "+ 250 ml" chip and stirs up bubbles. | `water-tile.html` |

The settings in the prototypes' README become constants in the code, with two changes made for the smoothed flow (below): the book's pages lift at once, and the sprint leaves at full speed.

## The flow

As in `today-preview.html`:

1. **A fill starts on the tap**: a quick action ("+ 250 ml", "10 left", "+ Workout", Snap) or a diet switch. Tapping the tile still opens its sheet. A change made in a sheet plays when the sheet closes, from where the tile was, so it is never missed behind the sheet. Opening Today shows every fill at its level at once, and tasks already done as chips; only changes animate.
2. **The book lifts at once.** The page keeps the chosen 2.1 s of motion but loses the 0.9 s wait it had before lifting. Several pages at once ("10 left") riffle through, all landing within about 2.5 s; one page keeps the calm pace (a new one every 1 s).
3. **The sprint leaves at full speed** (ease out instead of ease in-out), so the streaks are longest on the tap and pull in as it stops.
4. **Counts follow the fill.** Pages and litres count up in the status line with the animation (litres to the nearest 50 ml); other status changes slide in. A shortcut that's no longer needed ("10 left", "+ Workout", Snap) shrinks away.
5. **A full tile is validated, then becomes its chip.** It brightens with a ring in the world's ink and swells a little (0.38 s). Then it shrinks into its chip in the row above (0.72 s): its fill fades into the chip's colour, and its icon and title fly into the chip's (the photo shrinks into the chip's thumbnail). On landing, the tick pops and the gauge counts it.
6. **The board closes up smoothly.** The other tiles slide to their new places, and the buttons under the board slide with them. A tile that changes width (the odd one out takes the whole row) widens or narrows smoothly, its fill redrawn at its size.
7. **5/5 waits for the board.** "Day complete!" and anything else that comes at 5/5 wait for the last chip to land.
8. **Undo** ("Logged … · Undo") eases the fill back down; the book doesn't turn pages backwards, its fill just recedes. If a chip's task is no longer done, the chip fades out and the tile grows back into the grid.
9. **Data never waits.** Saving happens at once, as today; only the display waits for the animation, so leaving mid-animation loses nothing.

## Choices to approve

### Rendering: one shared WebGL context (recommended)

- **A. A canvas and WebGL context per tile**, as in the prototypes. The simplest port, but it needs five contexts (more while a tile resizes), Safari on the iPhone limits and recycles contexts, and every resize means rebuilding the fill and crossfading.
- **B. One three.js renderer for the whole board** draws each tile's fill on a hidden canvas and copies it into a plain 2D canvas inside the tile. One context however many tiles there are. Each tile is drawn at its live size every frame, so resizes and the morph need no rebuild, and the tiles keep their normal page layering (text and buttons above the fill). The cost is one small copy per moving tile per frame.
- **C. Redo the fills in CSS or 2D canvas.** The lightest, but it loses the looks that were chosen (the ink, the iris's lighting, the book's curl).

**B** is recommended. three.js is already a dependency (the Journey's particles). The fills are loaded lazily on Today, after the first paint. Until they're ready, or if WebGL is missing or its context is lost, tiles show today's thin bar.

### Reduce motion: a gentler version

The app honours the iPhone's Reduce Motion setting (CLAUDE.md), but the preview's reduced version was too blunt for the owner. Instead:

- No movement: each change crossfades the fill to its new level in 0.25 s.
- The ink's drift, the waves and the sprint's flow stand still.
- A full tile crossfades into its chip.
- The other tiles move to their places without sliding.
- The gauge already has its own reduced version (its spec).

This only shows on a phone with Reduce Motion turned on.

### Colours, worlds and light mode

The prototypes are the forest world in dark. In the app, each fill takes its colours from the world's palette (world, edge, ink, soft) in both themes, like the rest of Ember.

The text on a tile must keep 4.5:1 contrast over a full fill, in every world and both themes. A test checks it, like `worldColors.test.ts`. Where it fails, that fill is made lighter for that theme. The text shadow from the prototypes stays, but the test doesn't count on it.

## How it's built

- **`src/logic/taskFill.ts`** (pure): `taskFill(task, data, rules, socialToday)` gives 0–1 for all five tasks:
  - diet: switches ticked / switches needed (one on a social day)
  - photo: 0 or 1
  - reading: pages / target
  - workouts: done / required (by variant)
  - water: ml / target

  All are capped at 1. It replaces `taskProgress` on the board; the thin-bar fallback uses it too.
- **`src/screens/Today/fills/engine.ts`**: the shared renderer and the one frame loop.
  - Tiles register a 2D canvas and a painter. Each frame, the loop steps the moving painters, renders each at its tile's current size and copies it in.
  - It runs only while something moves or drifts: every frame while a fill moves or a tile morphs, 30 frames a second for the idle drift.
  - It stops while the page is hidden, Today isn't the tab shown, a sheet covers the board, or a tile is scrolled off screen.
  - Pixel ratio capped at 2. It rebuilds after a lost context.
- **`src/screens/Today/fills/{book,ink,iris,sprint,wave}.ts`**: one painter per task, ported from the prototypes.
  - The interface they share: set the level (animated or at once), resize, step, the level shown now, whether the fill is complete, dispose.
  - The iris opens on the day's real photo (the same Blob as the done chip's thumbnail).
- **`src/screens/Today/fills/TileFill.tsx`**: the canvas in a tile. It feeds its painter the level and reports the level shown (for the count-up) and "full".
- **The board** (`TaskBoard.tsx`, with `boardMotion.ts`):
  - A small pure state per task: tile → full → morphing → chip, and back on undo.
  - One FLIP helper on the Web Animations API runs the slides, the width changes, the glow and the morph.
  - It replaces framer-motion's `LayoutGroup` on the board, because the morph, the slides and the resizes are measured and timed together.
  - The late and open rings of the evening stay as they are.
- **Gauge and 5/5**: TodayHero's gauge counts the chips that have landed (the board reports them), not the saved completions. The "Day complete!" overlay waits for the board to settle, 4 s at most.

## Testing

- **Unit tests:**
  - `taskFill` for every task and variant (a social day, one workout on Medium/Soft, 3 L and 3.8 L).
  - The board's state per task: a tile becomes a chip only once full, goes back on undo, and the landed count is right.
  - The count-up text: pages, and litres to 50 ml.
- **Contrast test:** the title and status over a full fill, every world, both themes.
- **Component tests:**
  - `TaskBoard` with a fake engine (jsdom has no WebGL). With `MotionGlobalConfig.skipAnimations` the chip appears at once, as today.
  - The existing board tests keep passing, or are updated where they look for the thin bar.
- **On the iPhone**, on each PR's Vercel preview:
  - Smooth while filling and morphing.
  - No heat after a minute on Today.
  - Reduce Motion on and off, light and dark, a late day (until noon).

## Order of work

One PR each, into `main`:

1. The engine and the board's flow: glow, morph, slides, count-up, the timing of the gauge and of 5/5. Water's wave is the first fill.
2. Diet's ink and Workouts' sprint.
3. Photo's iris, on the real photo.
4. Reading's book.

Tiles without their fill yet keep the thin bar.

## Not in scope

- The fills' looks and settings (chosen in the prototypes).
- The task sheets, the camera sheet and the "Day complete!" overlay themselves (only their timing).

## Open points

- The owner reviews the gentler reduce-motion version above.
- If copying the fills (option B) is too slow on the iPhone, fall back to option A.
- The fills in light mode and in each world, seen on the phone.
