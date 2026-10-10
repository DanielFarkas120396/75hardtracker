# Prototypes

Throwaway pages for trying an idea before it's designed and built into the app. Open one in a browser; they need an internet connection for fonts and libraries.

## Task tiles that fill up (started 2026-10-08)

Idea: on Today, each open task tile fills up as the task progresses, with its own animation, in place of the thin progress bar at the bottom. The look stays Ember (the world's colours). Mockups of the whole screen are on the canvas at https://claude.ai/artifact/UAn6vKxtA1XDnWb3B2o3mX (mockup C is the real Today screen with a fill per tile).

We go one tile at a time.

### Reading: done, `reading-tile.html`

An open book in 3D (three.js): the spine is in the middle of the tile, both halves curve down into a shaded gutter. Each page read lifts from the right half, its bottom corner leading, curls, turns over the spine and fades out on the left. The tile fills from left to right, one tenth per page, starting before the page has landed. The icon and the text stay in front of the pages.

Chosen settings:

| Setting | Value |
|---|---|
| Page speed | 3.0 s |
| Fade starts at | 70% of the turn |
| Gutter curve | 60% |
| Page base fade | 60% |
| Blend over fill | 80% |

Notes for building it:

- three.js is heavy for one tile. Load it only when Today opens, or redo the effect in CSS/canvas.
- Each page draws its depth first, pushed back slightly (`polygonOffset`), then its colour. Without that the curl blends over itself; without the offset it z-fights.
- Reduce motion: no pages, the fill just steps.
- Not yet checked: several pages overlapping on a phone.

### Diet: chosen, `diet-tile.html`

Green ink blooming through water. It starts at the two switches and spreads with a curling, smoky edge, darker in its veins and where it pools at the rim. Each tick covers half the tile, or the whole tile on a social day (one switch). Unticking pulls the ink back. While there is ink, it keeps drifting slowly.

Tried and dropped on 2026-10-09: a glow with sparks (canvas), then grass, peas, flip cards and falling leaves, then napkins (cloth), jelly and origami (all three.js).

Chosen settings:

| Setting | Value |
|---|---|
| Starts from | The switches |
| Spread time | 1.1 s |
| Swirl | 81% |
| Swirl size | 150 px |
| Edge softness | 20 px |
| Drift | 36% |
| Opacity | 67% |

Notes for building it:

- It's one fragment shader on a quad: in the app it needs raw WebGL (or a tiny wrapper), not three.js.
- The ink's radius for a share of the tile is read off the sorted distances from the start point to a grid of points, plus a margin for the swirl and the soft edge.
- The drift keeps a frame loop running while the tile shows ink. Pause it when Today isn't visible.
- Reduce motion: no spread and no drift, the ink just appears at its level.

### Photo: chosen, `photo-tile.html`

A camera iris. Tapping Snap shuts it fast, a flash fires as it closes, then its blades swirl open on the day's photo, shown in the world's green with a little of its real colour. Photo has one step, so this plays once, just before the tile becomes the done chip with the photo's thumbnail. The page has a stand-in photo and a "Use my own photo" button.

Tried and dropped on 2026-10-09: a Polaroid that slides in and develops, a mosaic of blocks flying in, and a glassy ripple from the Snap button.

Chosen settings:

| Setting | Value |
|---|---|
| Blades | 8 |
| Close time | 110 ms |
| Open time | 0.9 s |
| Twist | 55% |
| Flash | 70% |
| Colour | 30% |
| Opacity | 85% |

Notes for building it:

- Each blade is a large plate whose inner edge sits at distance r from the centre, so the blades leave a polygon of inradius r open: r below 0 is shut, r past the tile's corners is fully open. The blades turn as they open, which gives the swirl. Each one has a thin light edge.
- The photo is set behind the iris while it is shut, so it never pops in.
- In the app, wait for the iris to open before the tile becomes the done chip.
- Reduce motion: no iris and no flash, the photo just appears.
- This one has real 3D lighting on the blades: three.js, or flat 2D plates with a gradient if that's too heavy.

### Workouts: chosen, `workouts-tile.html`

A sprint. Each workout logged makes the fill race in from the left, half the tile at a time (the whole tile on Medium and Soft, one a day). Speed lines streak ahead of its ragged front in lanes, and pull back into it as it stops. While there is fill, thin lines keep flowing through it.

Tried and dropped on 2026-10-09: weight plates rolling in, a heartbeat trace and a stopwatch hand (all three.js).

Chosen settings:

| Setting | Value |
|---|---|
| Run time | 0.7 s |
| Lanes | 12 |
| Streak length | 90 px |
| Ragged front | 16 px |
| Flow after | 30% |
| Opacity | 85% |

Notes for building it:

- It's one fragment shader on a quad, like Diet: raw WebGL, not three.js.
- How far the streaks reach follows the front's speed (relative to its top speed), smoothed, so they stretch out mid-run and shrink back as it stops.
- The flow keeps a frame loop running while the tile shows fill. Pause it when Today isn't visible.
- Reduce motion: no run, no streaks and no flow, the fill just steps.

### Water: chosen, `water-tile.html`

A rising wave. The tile fills from the bottom with green water whose surface rolls on two crossing waves, with a second, darker wave just behind it for depth. Each pour lifts the level slowly, tips the water into a slosh, sends a ripple out from under the "+ 250 ml" chip and stirs up the bubbles. Caustics shimmer near the top and a bright line runs just under the surface. While there is water, it keeps moving. Water is the odd tile, so it spans the whole row (the page uses 358 × 130).

Tried and dropped on 2026-10-09: a stream pouring from the chip, gooey drops falling from it, and a 3D tank seen from above (all three.js).

Chosen settings:

| Setting | Value |
|---|---|
| Rise time | 2.4 s |
| Wave height | 8.5 px |
| Slosh | 69% |
| Bubbles | 82% |
| Shimmer | 28% |
| Back wave | 66% |
| Opacity | 78% |

Notes for building it:

- One fragment shader on a quad, like Diet and Workouts: raw WebGL, not three.js.
- Empty puts the surface just under the tile, full puts it past the top (waves and slosh included), so the first 250 ml already shows and the last one covers the whole tile.
- The slosh is a damped spring that tilts the surface; the ripple is a wave packet running out both ways from the chip.
- The bubbles are 14 procedural ones in the shader, brighter for a moment after each pour.
- The waves keep a frame loop running while the tile shows water. Pause it when Today isn't visible.
- Reduce motion: no rise, no slosh or ripple, and no moving waves; the water just stands at its level.

### The whole screen: `today-preview.html`

The Today screen in a phone frame with all five fills at once. The header (duck, gauge, streak, quote), the two buttons and the tab bar were copied from the real app (forest world, dark, 390 px wide) with their computed styles. The board is rebuilt so each tile carries its animation, wired like the app: the diet switches, Snap, "10 left", "+ Workout" and "+ 250 ml"; tapping a tile does one step. "Play a whole day" runs through a day in about 40 s.

The flow, smoothed on 2026-10-09 at the owner's request ("as smooth as possible"):

- Every fill starts on the tap. The book's pages lift at once (the chosen 2.1 s of page motion, without the 0.9 s wait it had before lifting), and the sprint leaves at full speed (ease out instead of in-out).
- Pages and litres count up in the status line with the animation; other status changes slide in. A shortcut that's no longer needed ("10 left", "+ Workout", Snap) shrinks away.
- Several pages at once riffle through, all starting within 2.4 s (for ten, the last one lands at about 4.4 s); a single page keeps the calm pace.
- When a fill is complete, the tile brightens with a ring and swells slightly (0.38 s), then shrinks into its chip in the row above (0.72 s): its fill fades into the chip's colour, its icon and title fly into the chip's (the photo shrinks into the thumbnail), and on landing the tick pops and the gauge counts it.
- Meanwhile the other tiles slide to their new places, the buttons under the board too. A tile that changes width (the odd one out takes the whole row) resizes smoothly, its old animation fading out while a new one at the new size fades in.
- Reduce motion: no glow, no morph, no slides; tiles turn into chips at once.

What it showed:

- Tiles change size as others finish: Water starts on its own row and drops to half width once Diet is done; Workouts or Reading can end up alone on a row. Every fill must handle both 173 × 120 and 358 × 120.
- Five tiles mean five WebGL contexts at once (more for a moment while one resizes). Fine on a computer; to be checked on the iPhone (Safari caps how many it keeps alive), or the fills share one canvas.
- In the app today the tile turns into a chip the moment the task is done. Here it waits for its fill, glows, then morphs.

### Next

All five tiles are chosen and built into the app, following `docs/superpowers/specs/2026-10-09-task-tile-fills-design.md`: PR #74 (the engine, the board's flow and Water), PR #75 (Diet and Workouts), PR #76 (Photo) and PR #77 (Reading's book).
