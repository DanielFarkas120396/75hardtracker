# Wallet stack — design

Date: 2026-11-17 · Status: **built** (PR #94), phone check pending.

## Why

The owner likes the Workouts activity cards in Stats but finds they take too much room: with four activities the stack was about 520 px tall. Keep the overlapping idea, take less space.

## Decisions

Chosen from mockups in the app's real tokens (slim tabs, wallet, deck; then four wallet variations): **front card first, tabs tucked under**.

| Topic | Decision |
|---|---|
| Order | Most sessions first (the number of times the activity was done, not the time spent); ties keep the app's list order. |
| Top card | The first activity, full size as before: big logo, name, big number, sessions and time. |
| Tabs | Every other activity is a slim tab tucked under the card above it, full width: small logo, name, time, count. Each a shade softer than the one above. |
| Tap a card | It opens where it is, full size, with its feels and sessions; the cards below move down. One open at a time; tapping it again folds it. |

Height with six activities: about 340 px.

## Tried and dropped

The first build brought a tapped tab to the front, with each tab narrower further back ("depth"). The owner found it worse: a card should open where it is.
