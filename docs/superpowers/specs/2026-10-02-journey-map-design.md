# Journey map: the climb from hell to heaven (design)

Date: 2026-10-02 · Status: **built** (PR #14, merged into main on 2026-10-02). Written down afterwards, on 2026-10-05, from the decisions made in conversation.

## Why

The owner's feedback (FEEDBACK.md, 2026-09-28): the Journey is pretty but needs a better design and a real background. It was the first step of the design pass in the [roadmap](2026-10-02-roadmap-notes.md). It later shaped the whole v2 look ([app look](2026-10-03-app-look-design.md)).

## Decisions

| Topic | Decision |
|---|---|
| Theme | A climb **from hell to heaven**. Day 1 is at the bottom, Day 75 at the top. |
| Worlds | Six, each with a roadside sign where it begins (table below). |
| Images | The owner made one 9:16 image per world with an AI image tool. They're in `public/journey/*.webp`. |
| Blends | Long, eased cross-fades between worlds. The first, short fades were "way too rough". |
| Stones | Stepping stones in each world's style. |
| Light / dark | The map keeps the same colours in both themes. |
| Life | Particle effects per world (three.js), plus flags on milestone days. |
| Opening | The map opens on today (Day 1 before the start, Day 75 once it's done). |

## The worlds (`src/screens/Journey/worlds.ts`)

| World | Days | Particles |
|---|---|---|
| Hell | 1–10 | flames, sparks, a pulsing heat glow |
| The Wasteland | 11–22 | ash flakes, dust swirls |
| The Dark Forest | 23–37 | fireflies, falling needles and leaves |
| The Meadows | 38–50 | petals, leaves, pollen |
| The Mountains | 51–64 | snow, with wind gusts |
| Heaven | 65–75 | golden sparkles, rising orbs |

These ranges also pick the app's colours in v2 (`worldForDay`).

## How it works

- **Images:** a world is 2–3 screens tall, longer than its image, so the image repeats down the world with soft fades. A world's `tiles` list can take more middle images later (no sky, no gates), used before anything repeats. Heaven is `[heaven-gates, heaven-clouds]`, so the gates appear only once, at the top.
- **Blends:** each world fades out over the opaque world below it, and the backdrop colour blends across each border.
- **Effects** (`src/screens/Journey/effects/`):
  - one sticky, screen-sized WebGL canvas between the scenery and the road;
  - only the worlds on screen are simulated, at up to 30 fps, and a scroll is followed on the very next frame;
  - three.js loads lazily with the Journey (about 133 KB gzipped);
  - glowing (additive) particles vanish on pale worlds, so heaven and the meadow pollen use solid gold instead;
  - nothing runs with "reduce motion" on, or without WebGL.
- **Milestones:** a flag beside Days 7, 14, 21, 30, 50 and 75 (gold on Day 75). It waves once the day is behind you.
- **Joker days** keep their 🃏.

## Open points

- Scrolling smoothness on a real iPhone wasn't checked when the PR was merged.
- More images per world ("repeat now, more images later").
