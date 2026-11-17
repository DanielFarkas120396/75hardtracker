# Wallet stack — design

Date: 2026-11-17 · Status: **built** (PR #94), phone check pending.

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
