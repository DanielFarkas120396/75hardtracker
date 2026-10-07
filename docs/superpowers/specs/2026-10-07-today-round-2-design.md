# Today, round 2 (design)

Status: **approved** by the owner on 2026-10-07. **Built** on `feat/today-round-2` (PR pending the owner's phone check). While building, `worldLines.ts` went with the world line, its last user.

This comes from the Impeccable critique of the Today screen on 2026-10-07, which scored it 27/40.

The owner's choices:
- start with done versus open tiles;
- in the evening, show both the countdown and a reshaped board;
- everything is in scope, the small points included.

There is no Dexie change and nothing new is stored. It builds on the [task board design](2026-10-05-task-board-design.md).

## 1. Done goes quiet, open stays loud

Today a done tile turns `world-soft`, which is close to the task pastels: Hell's peach looks like the Workouts orange, and the Meadows green looks like Diet.

- **Open tile:** keeps its task pastel, progress bar and shortcut, exactly as today.
- **Done tile:**
  - a neutral `surface` fill;
  - the icon square turns `world`, with the tick;
  - the title is in `ink-muted`;
  - the status line is the summary.
- **Photo tile:** still shows the photo.
- **The tick:** stays in the corner. On the Diet tile it moves under the switches, so it no longer collides with the 🍽️ emoji.
- **Order:** tiles keep their places during the day. §3 covers the evening.

## 2. The duck speaks, then falls quiet

The old bubble floated over "Day N / 75", the attempt line and the ring, and screen readers never heard it. A fixed caption was tried first; after the phone check the owner asked for speech that comes and goes instead (2026-10-07).

**Where:** a speech bubble rises above the duck, with its tail pointing down at him. It stays narrow, in the space left of the ring, so it never covers the count. (First placed under the duck; the owner asked for above, 2026-10-07.)

**When he speaks** (about 4 s each time, then the bubble fades):
- a beat after Today opens: the day's line ("New day, Sam. I'm watching.", "Started. Not finished.", "Yesterday's still open. Noon.");
- when that line changes: a task ticked ("3 down, 2 to go."), one left, the clock getting close;
- when he reacts, for about 2.5 s: a poke, a glare at an unticked task, a saved plan, a declared social occasion;
- now and then on his own, every 40–75 s: a catchphrase for his mood, never the same one twice in a row.

**Catchphrases:**
- calm (all done): "The knife rests. For now." · "Perfect. Suspiciously perfect." · "Sleep well. I won't."
- watching: "I'm watching." · "Tick the boxes. Keep your fingers." · "The knife is sharp. Are you?" · "No excuses. Only tasks."
- tense: "Tick. Tock." · "Clock's running. So am I." · "I can hear the clock. Can you?"
- hunting: "Midnight's coming. So am I." · "Run." · "I'm sharpening."

**Accessibility:** the bubble sits in an `aria-live="polite"` region, so VoiceOver reads each line as he says it. With reduce motion on, it only fades.

**The hero is built around the ring** (the owner's call after the phone check, 2026-10-07):
1. a small centred line: "Day N / 75", the attempt, the streak and the jokers;
2. the ring, large (132 px) and centred, with "2/5" big inside and "tasks done" under it; the duck at its bottom left, talking upwards; the evening countdown under the ring;
3. the reason, centred, clamped to two lines.

The world line ("The Meadows · 11 days to …") leaves the hero, since the Journey tab already says it, so nothing gets cut off any more.

**The ring:**
- It shows "2/5" at a readable size. The 8 px "TASKS" label goes.
- Its accessible name is "2 of 5 tasks done".

## 3. The evening: a countdown, then the board reshapes

These changes apply only when the duck's menace is `tapping` or `hunting` (cutting it close, a broken plan, won't fit, past bedtime) and tasks are still open.

**The countdown:**
- Under the ring, "1h30 left" counts down to midnight, in `danger-ink`, at 12 px or more.
- It updates with the clock that `useNow()` already provides.

**The open tiles lift:**
- a 2 px `danger-ink` border;
- the status line bold, in `ink`. It is not red, because `danger-ink` on the dark green tile only reaches 4.48:1, below 4.5.

**The board reshapes:**
- The done tasks and "Mood & notes" fold into one row of small chips above the open tiles. Each chip shows the task's icon and a tick, and the notes chip has no tick. A chip still opens its sheet.
- The open tasks stay as full tiles in the 2-column grid. With one open task left, its tile spans both columns.
- The change animates with framer's `layout`, and is instant with reduce motion on.
- Back to calm (all done, or a new day): the full six-tile board returns.

## 4. Keeping the log honest

**One way to add a workout:**
- The sheet's "+ Add workout" no longer writes a 45-minute run.
- It closes the sheet and opens the same "Add workout" form as the tile's shortcut: activity, length, place, feel.

**Undo:**
- Removing a workout (✕) shows a "Workout removed · Undo" toast for 5 s.
- Undo writes the same workout back: activity, length, place and feel.

**Sheets that close themselves:**
- The Workouts sheet stays open after the day's workouts are done, so a feel can still be added.
- The other sheets keep closing 1.5 s after the cheer, as today.

## 5. In reach, and one meaning per emoji

**A row under the grid** holds the two hero buttons, now labelled pill buttons in the thumb zone:
- 🗓️ "Plan my evening" (or "Edit my plan"), while tasks are open;
- 🥂 "Plan a social occasion", on challenges that have one, until Day 74.

They leave the hero, which only keeps the duck, the day and the ring.

**🥂:** it then means "a drink is allowed today" only on the Diet tile, and is always next to the text "Plan a social occasion" in the action row.

**Shortcuts:**
- **Photo:** "Snap", next to the camera icon, so it reads as an action and not decoration.
- **Reading:** "6 left" adds the pages still missing in one tap, for example 6 when 4 of 10 are read. With no target left, it isn't shown, since the tile is done.
- **Water:** "+250 ml" stays.

## 6. Copy

- **Diet tile:** "0 of 2" becomes "2 to tick", with "1 of 2" while in progress, as the task-board spec intended.
- **Water:** the tile and the sheet show the same figure, for example "0.75 / 3.8 L". `formatLiters` keeps up to two decimals, and the targets still read "3.8" and "3".
- **The duck notices progress:**
  - "New day, {name}. I'm watching." only while nothing is logged at all;
  - with something logged but nothing ticked: "Started. Not finished.";
  - after that, the lines don't change.
- **The duck notices yesterday:** while yesterday is still open, before noon, the calm line becomes "Yesterday's still open. Noon." The late-day card stays as it is.

## 7. Small points

- **Haptics:**
  - iPhone Safari can't vibrate, and CLAUDE.md says nothing may.
  - The "Haptic feedback" setting, `useHaptics` and the `vibrate()` calls in the sheet, the day-complete celebration and the victory screen all go.
  - The stored value stays, unused, so old backups still import.
- **Day 1:** with a streak of 0, the grey flame and its "0" are hidden. The flame appears from a streak of 1.
- **Pre-start:** "pick your book" gets the same book picker and "Add a book" form as the reading sheet, reused from `ReadingTask`.
- **Day complete:** the celebration uses the world colour (`bg-world`, `text-on-world`) instead of always green, so the peak follows hell → heaven. The contrast test already covers `on-world` on `world`.
- **The task-board spec:** gets a note.
  - the "N tasks left" line was dropped, because the ring says it;
  - the Diet tile's done line stays a short "Followed", because the switches sit beside it;
  - done tiles changed in this round.

## Out of scope

- The plan and social sheets' insides.
- The menace logic itself (levels, bedtime).
- The late-day view, apart from the reshape, which it doesn't get, since a late day has no evening.
- Journey and Stats.

## Tests

- **`TaskBoard`:**
  - a done tile uses the neutral style and the open ones keep their tint;
  - the reshape at `tapping`/`hunting` (chips for done tasks and notes, open tiles, one open task spans both columns);
  - back to the grid when calm.
- **`TodayHero` / `DuckHeader`:**
  - the bubble speaks a beat after opening, falls quiet after a few seconds, says a catchphrase on its own later, and is live for VoiceOver;
  - there is no floating bubble;
  - the ring's accessible name;
  - the countdown only at `tapping`/`hunting`, with the right "1h30 left".
- **Workouts:**
  - the sheet's "+ Add workout" opens the form;
  - removing shows Undo, and Undo restores the same fields;
  - the Workouts sheet doesn't close itself.
- **Copy (`taskStatus`, `microcopy`):**
  - "2 to tick";
  - water with two decimals;
  - "Started. Not finished.";
  - the yesterday line.
- **Shortcuts:** "Snap", and "6 left" adding the missing pages.
- **Small points:**
  - no "Haptic feedback" in Settings;
  - no flame at a streak of 0;
  - the pre-start book picker;
  - the celebration in the world colour.
- **Contrast:** the countdown's `danger-ink` on the hero's `world-soft` in every world (already covered by the warning test from onboarding round 2).
- **On the phone:** a morning, an afternoon, and 22:30 with tasks open (the reshape), in Hell and Heaven, light and dark.
