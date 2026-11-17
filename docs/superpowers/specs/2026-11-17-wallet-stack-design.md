# Wallet stack — design

Date: 2026-11-17 · Status: **merged** (PR #94, 2026-11-17), phone check pending.

## Why

The owner likes the Workouts activity cards in Stats but finds they take too much room: with four activities the stack was about 520 px tall. Keep the overlapping idea, take less space.

## Decisions

Chosen from mockups in the app's real tokens (slim tabs, wallet, deck; then four wallet variations): **front card first, tabs tucked under**, then every card the same shape.

| Topic | Decision |
|---|---|
| Order | Most sessions first (the number of times the activity was done, not the time spent); ties keep the app's list order. |
| Cards | Every card has the same shape and look, each tucked under the one above: logo, name, time, count. Each a shade softer than the one above. |
| Favourite | The top card (most sessions) is the same shape, a little taller, with a star and "Your favorite" before its time. A warm glow rises from below it, with tiny sparks drifting up (style "E2", picked from mockups of rims, outlines, halos and embers); with "reduce motion" the sparks stand still. |
| Tap a card | It unfolds its feels and sessions where it is; the cards below move down. One open at a time; tapping it again folds it. |

Height with six activities: about 350 px.

## Tried and dropped

The first build brought a tapped tab to the front, with each tab narrower further back ("depth"). The owner found it worse: a card should open where it is.

The second build kept the top card (and any open card) full size, with a big logo and number. The owner wanted every card the same shape, the top one only starred.

The plain starred top card looked shorter than the others (it has nothing tucked over it), so it grew a little; an outer halo was tried and dropped for a glow inside the card.

## The rest of Stats (same PR)

| Topic | Decision |
|---|---|
| Weight | First on the page: the latest weight (big), its change, and the chart (taller, soft fill under the line, scale on the right, a big dot on the latest trend). Only an arrow under it unfolds the weigh-ins: one compact row each (day, date, weight, ▼/▲ since the one before, a ruler icon for body measurements). A row opens the edit sheet, which now holds Delete. |
| Compact weight | The "Weight" title goes (kept for screen readers): icon, latest weight, change (no "since Day 1") and "+ Log" share one line; a shorter chart; the arrow tight under it. |
| Reading the chart | No floating box and no animation: a finger anywhere on the chart (not just on a dot) puts a plain cursor on the closest weigh-in by day, and dragging moves it; the header line shows it (weight, day, date, trend). The cursor stays where the finger lets go (owner, after the merge; PR follow-up). Vertical swipes still scroll the page. |
| Order | Weight, the training totals, water and pages, then the workout cards. |
| Trend line | A smoothed trend from the first weigh-in (each one pulls it 15% of the way per day since the one before), instead of the 7-day average that only began on Day 7 and broke across gaps. |
| Workout totals | No more three small cards: the time trained, big ("53h15", "of sweat"), a thin divider, then the sessions and "under the sky" (outdoors) as two lines. Picked ("D") from big-number, hero, ring, sentence, banner and bar ideas, then hybrids. |
| Day card | The "Day X of 75" climb card leaves Stats: Today and Journey already show the day. Journey keeps it. |
| Water | A glass bottle with a cap and a highlight, filled against the water owed so far; two waves roll on the water and bubbles rise (still with "reduce motion"). Chosen from four (glass, sport bottle, drop, glass with a goal mark). |
| Pages | A wooden shelf, a book for every 100 pages (seven fit, then "+n"). The book in progress sticks out above the others, fills up from the bottom over its 100 pages, and has a red ribbon on top. At 0 pages, a dashed outline. Chosen from shelf, stack, tome and filling-stack ideas, then pulled-out variations and drawing styles. |
