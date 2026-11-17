# Weigh-in card exit

Date: 2026-11-17 · Status: **merged** into `main` on 2026-11-17 (PR #99); phone check pending. Agreed with the owner on 2026-11-17: option A, picked from a live preview of A and B.

## Why

On Today, the "Weigh in" card (PR #87) vanished the moment a weight was saved, and the tiles below jumped up.

## What it does

**A: logged, then folds.**

1. On Save, the keyboard goes away. The card stays and confirms what it kept: the scale icon becomes a ✓ that pops in, the line reads "86.4 kg logged.", and a faint glow in the world's colour lights the inside of the card.
2. After 0.55 s, the card fades (0.28 s), shrinks a little (to 97%) and folds closed (0.42 s, the board's morph ease). The tiles below slide up with it, without a jump.

Save can't be tapped again during the exit.

**Reduce motion:** no pop, no fold. The card fades out in 0.2 s, then the tiles move up in one step.

Rejected: **B**, the same fold straight away with no "logged" moment.

## How

`WeighInCard` wraps the card in `AnimatePresence`. The card's wrapper clips its content (`overflow-hidden`) and animates its height to 0 on exit, so the content below follows in normal flow. No layout animation is needed on the board. The form keeps the saved weight in local state, which the exiting card still shows.
