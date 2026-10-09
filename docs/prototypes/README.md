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

### Still to do

Diet, Photo, Workouts, Water. The first ideas (glow with sparks, camera flash then a lens opening, 15-minute blocks, liquid with a wave) are in mockup C on the canvas.

Nothing here is agreed as a feature yet: once the tiles are settled, write the design in `docs/superpowers/specs/`.
