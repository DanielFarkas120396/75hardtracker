# Journey day cards

**Status:** in `main` since 2026-10-07 (PR #62 into `v3`, then PR #63 into `main`), checked on the phone. Round 2 (after the first phone check): the card was off-centre and too big; it now shows only the photo, the notes and the workouts.

## Why

The Journey was only something to look at: no stone could be tapped. The owner wants each day to open, showing what happened that day, photo and notes first.

## What

### The card

- Past days, today, and days a joker forgave can be tapped. Days not reached yet stay locked.
- A tap grows a card out of the stone, with a small spring. The card is centred, with margins, so the map stays visible behind it. A long day scrolls inside the card.
- Tapping outside, the close button, Escape, or swiping the card's top down shrinks it back into its stone.
- With "reduce motion", the card fades in and out instead.
- Inside, under "Day N · date": the photo, the notes, then the workouts (one chip each, logo and minutes). Nothing else: no mood, book or joker line (the owner's choice after the phone check).

### Books

- Each day remembers its book (`DayEntry.bookId`), saved when pages are logged with a current book. If the book changes during the day, the last one wins.
- Books get a cover (`Book.cover`, a Blob), picked from the photo library and shrunk before saving. It's added in the Reading task, by tapping the cover next to the current book.
- Backups carry the cover as base64 (`coverBase64`, `coverMimeType` on the book). The format version stays 1: old backups still import, and the new fields are optional.

### Data

No Dexie version bump: `bookId` and `cover` are optional, unindexed fields. Old rows keep working.

## Out of scope

- A full-screen photo from the card.
- Editing a past day from the card.
