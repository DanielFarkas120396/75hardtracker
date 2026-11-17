# Wallet stack — design

Date: 2026-11-17 · Status: **built** (branch `feat/wallet-stack`), phone check pending.

## Why

The owner likes the Workouts activity cards in Stats but finds they take too much room: with four activities the stack was about 520 px tall. Keep the overlapping idea, take less space.

## Decisions

Chosen from mockups in the app's real tokens (slim tabs, wallet, deck; then four wallet variations): **front card first, with depth**.

| Topic | Decision |
|---|---|
| Front card | One full card on top, as before: big logo, name, big number, sessions and time. At first, the activity with the most sessions. |
| Tabs | Every other activity is a slim tab tucked under the front card: small logo, name, time, count. Highest count first. Each tab sits a little narrower and darker than the one before, like a pile seen from above. |
| Tap a tab | Its card comes to the front, closed; the old front card goes back among the tabs, which stay highest count first. |
| Tap the front card | It unfolds its feels and sessions as before; the tabs move down under it. Tapping it again folds it. |
| Motion | Cards slide to their new places; with "reduce motion", they jump. |

Height with four activities: about 250 px (half of before).
