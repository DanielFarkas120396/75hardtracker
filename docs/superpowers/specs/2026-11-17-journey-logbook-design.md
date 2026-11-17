# Journey logbook: design

Date: 2026-11-17 · Status: **built** on `feat/journey-logbook`, waiting for the owner's phone check.

## Why

The Journey was the last screen still drawn as a bright picture book (the hell → heaven map from the [journey map design](2026-10-02-journey-map-design.md)), while every other screen wears the [Ember look](2026-10-07-ember-look-design.md). The owner asked for a redesign from scratch that matches the rest of the app. A road-lighting animation on the old map was tried first and turned down.

Three directions were mocked (`2026-11-17-journey-logbook/board.html`: the trail, the wall, the logbook). The owner picked **the logbook**, then the version with the worlds as chapters (`2026-11-17-journey-logbook/logbook.html`, screen 1). The mockups load the world pictures from `/journey/`, so they only show them when served by the dev server.

## What the owner asked for

| Topic | Decision |
|---|---|
| Keep | Tapping a past day (or today) opens the day card: photo, notes, workouts. The card stays as it is. |
| Look | Ember, like Stats: warm black, cards, condensed numbers, the world's muted colour. |
| Worlds | Kept, as the chapters of the logbook. |
| Drop | The illustrated map, the road, the stones, the signs, the three.js particles. |

## The screen

From top to bottom, newest first:

1. **Header** like Stats: "Attempt #n", the title "Journey" with its icon, the flame streak.
2. **The climb card** from Stats (world name, Day n of 75, the bar in world segments).
3. **The next world**, locked: its cover greyed with "In n days" ("Tomorrow" the day before). Only the next one, never all the worlds ahead. Gone once you are in Heaven.
4. **The current world's cover**, with its score ("8/13") and "n to go".
5. **Today**, outlined in the world's colour: "Today · Day n", "In progress" or "Done".
6. **The days before**, one row each, newest first: the progress photo, "Day n", the date, the first line of the notes, the workouts as chips (logo and minutes).
7. At each world's first day, **the cover of the world below** closes its chapter: "Cleared", the days, the score (and jokers), the date it was finished.

Rows:

- A day a joker forgave is a dashed row: "Day n · forgiven with a joker".
- A day the restored backup didn't contain says "Not in your backup".
- A past day not finished (yesterday before noon) says "Not finished".
- Every row except the days ahead opens the day card, growing from the tap.

## The worlds

- **Cover:** the world's own picture (the ones from the old map), darkened into the canvas so the name reads on it, in the world's colour.
- **Colour:** each row wears its world's colours (`data-world`), so scrolling back the screen goes green, forest green, grey, amber: the colour shift is the descent.
- **Altitude rail:** a thin bar fixed on the left edge, Hell at the bottom and Heaven at the top, filled in each world's colour up to today, with a mark at each border and the duck at your height. Tapping a stretch jumps to that world's cover (a world ahead jumps to the top).

## Edge cases

- **Before Day 1:** the climb card says "Not started yet", Hell is the next world ("In n days"), no rows.
- **After Day 75:** every world is cleared, Heaven's cover is on top, no next world.
- **Reduce motion:** the jump from the rail is instant instead of smooth.
- **Light mode:** the same layout on the cream canvas; covers fade into the cream.

## Not changed

No database change. The day card (`DayCard.tsx`) and its tests stay. `three` stays (Today's tile fills use it).
