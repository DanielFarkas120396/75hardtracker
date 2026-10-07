# Journey day cards

**Status:** approved 2026-10-07, being built on `feat/v3-journey-days` (PR into `v3`).

## Why

The Journey was only something to look at: no stone could be tapped. The owner wants each day to open, showing what happened that day, photo and notes first.

## What

### The card

- Past days, today, and days a joker forgave can be tapped. Days not reached yet stay locked.
- A tap grows a card out of the stone, with a small spring. The card is centred, with margins, so the map stays visible behind it. A long day scrolls inside the card.
- Tapping outside, the close button, Escape, or swiping the card's top down shrinks it back into its stone.
- With "reduce motion", the card fades in and out instead.
- Inside, in order:
  1. the world and the date, then "Day N of 75"
  2. the photo, big ("No photo this day" without one)
  3. the notes, with the mood
  4. the workouts: one chip each, logo and minutes
  5. the book: its cover, title and the pages read that day
- A joker day also says "Forgiven by a joker".

### Books

- Each day remembers its book (`DayEntry.bookId`), saved when pages are logged with a current book. If the book changes during the day, the last one wins.
- Days logged before this have no book. Their card shows "Choose the book", a list of your books.
- Books get a cover (`Book.cover`, a Blob), picked from the photo library and shrunk before saving. It can be added in the Reading task, next to the current book, or by tapping the cover in a day card.
- Backups carry the cover as base64 (`coverBase64`, `coverMimeType` on the book). The format version stays 1: old backups still import, and the new fields are optional.

### Data

No Dexie version bump: `bookId` and `cover` are optional, unindexed fields. Old rows keep working.

## Out of scope

- A full-screen photo from the card.
- Editing a past day from the card.
