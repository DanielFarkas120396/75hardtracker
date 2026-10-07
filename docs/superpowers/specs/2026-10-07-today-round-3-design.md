# Today, round 3 (design)

Status: **merged** into `main` on 2026-10-07 (PR #47), after the owner checked it on the phone. Two changes while building: the tick sits on the icon's corner (the same place on every tile, clear of the diet switches), and a photo from the shortcut has no Undo (undoing it would delete the photo).

This comes from the second Impeccable critique of Today on 2026-10-07, which scored 27/40 again. Round 2 fixed most of the first critique's issues; this round fixes what the redesign itself brought.

The owner's choices:
- start with the done tiles and the hero line;
- Mood & notes becomes a closing ritual at 5/5;
- everything is in scope, the small points included.

There is no Dexie change.

## 1. One quiet "done"

At 4/5, the done tiles currently outshine the open one: a solid world-colour icon square and a red tick badge on each.

- **One done mark:** the corner tick badge. The Diet tile gets it too, placed under its switches instead of replacing the icon.
- **The done icon box goes neutral** (`canvas`, muted icon), like the rest of the tile.
- **World colour is kept for the ring.** On the board it is only the small tick.
- **Open tiles keep their pastel and coloured icon**, so they are the loudest thing on the board.

## 2. Mood & notes: the closing ritual

Mood & notes leaves the grid. It is optional and never "done", so it shouldn't sit among the tasks.

- **The board:** five task tiles. Photo, the fifth, spans both columns.
- **At 5/5:** the hero shows "How did it go?" under the ring, and that button opens the Mood & notes sheet. Once a mood is set, the button shows it instead ("😄 Good · notes saved").
- **Before 5/5:** a small "📝 Notes" button in the row under the board, next to "Plan my evening", so a bad day can still be written down.
- **Late day:** a small "📝 Notes" button under its board.

## 3. A hero line that never breaks

**Top line**, centred and on one row: "Day 3" in display type, then the attempt in muted text, "75 Hard #1".
- The "/ 75" goes, since the Journey shows the 75 days.
- That removes the "75 / 75 Hard" clash.

**The streak and jokers** move to the hero's empty right column, stacked: the flame with its number, then the joker count. The top line no longer wraps on Soft and Medium.

**The flame** doesn't grow on Today. It keeps its 1.5× growth on Journey and Stats, where it has room. `FlameStreak` gets a `grow` prop.

**The duck's bubble:**
- at most 3 lines;
- 7rem wide, still inside the duck's column and the gap before the ring.

## 4. A "Day won" hero

At 5/5, after the celebration overlay:
- the ring is filled;
- under it, "Day N won" in the world's ink colour;
- the duck is content;
- the "How did it go?" button from §2.

**The duck stops repeating the count.** His watching lines no longer say "3 down, 2 to go". Instead he says:
- the task left, when only one is;
- the next plan, when there is one;
- otherwise his greeting, "Started. Not finished.", or a catchphrase.

**Mid-day, the right column** shows the streak and jokers (§3). Under the ring, the next plan's time ("Reading at 21:00") shows when one is set; in the evening the countdown takes its place.

## 5. Quieter shortcuts, with Undo

**The shortcut chips** keep their 48 px touch area, but the visible chip shrinks:
- 32 px tall;
- the task's own tint, with a hairline border instead of a white fill;
- coloured text.

They no longer outshine the tile title.

**Undo after a shortcut:** "+250 ml", "+N left" and a photo from the shortcut show a 4 s toast above the tab bar, "Logged 250 ml · Undo" or "Logged 6 pages · Undo".
- Undo takes the water or pages back off, and the book's bookmark too.
- One toast at a time. A new action replaces it.

**Water's shortcut:** "+250 ml" stays. The sheet keeps −250, +250 and +500.

## 6. A smarter evening

At `tapping` or `hunting`:
- **Order:** the open tiles sort by how long they take to finish, quickest first (`minutesToFinish` from `logic/menace`), so the next move is the top-left tile.
- **The red edge** goes only on tasks that no longer fit before midnight. The others get a plain stronger border.
- **At `hunting`**, "Plan my evening" is hidden. There's nothing left to plan, only to do.

## 7. Small points

- **Indoor / Outdoor:** the toggle is labelled "Outdoor", and the switch says on or off. This applies to Add workout and to the workout rows.
- **The Add workout sheet** gets the same header as the task sheets: the orange tint, the icon, the title, and a close button.
- **The buttons under the board** ("Plan my evening", "Plan a social occasion", "Notes") are short enough to stay on one line at 375 px. The social one becomes "🥂 Social night".
- **The water sheet:** the three buttons sit on one row.
- **Dark-mode switches:** the off state shows a light thumb on a muted track, like iOS.
- **The 🥂 on a done Diet tile** keeps full colour.
- **VoiceOver names:** no "·". For example, "Workouts, 0 of 2, 45 minutes each".
- **Badge toasts** wait until the day-complete celebration is dismissed.
- **Pre-start** uses the Today hero's look (world-soft card, ring at 0, the countdown under it), so Day 1 isn't a jump.

## Out of scope

- The menace logic.
- The plan and social sheets.
- Journey and Stats, apart from the flame prop.

## Tests

- **Board:**
  - a done tile has the corner tick and a neutral icon box, Diet included;
  - five tiles, with Photo spanning two columns;
  - at urgent, the open tiles are ordered by time to finish, and the red edge appears only on tasks that won't fit.
- **Hero:**
  - "Day N" and the attempt with no "/ 75";
  - streak and jokers in the right column;
  - "Day N won" and "How did it go?" at 5/5, opening the notes sheet;
  - the button shows the mood once set.
- **Duck:** the watching lines contain no counts.
- **Shortcuts:** the Undo toast after +250 ml and +N left reverts the water, the pages and the bookmark.
- **Small points:**
  - the "Outdoor" label;
  - the Add workout header and its close button;
  - no "·" in tile names;
  - badge toasts held during the celebration;
  - pre-start shows the ring.
- **Contrast:** the new chip colours, in light and dark.
