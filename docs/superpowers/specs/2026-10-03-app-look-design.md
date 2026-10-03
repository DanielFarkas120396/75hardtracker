# App look: "your world everywhere" — design

Date: 2026-10-03 · Status: approved in conversation, to be reviewed as a document.
Follows the Journey redesign (PR #14): the climb from hell to heaven now shapes the whole app's look.

## Decisions

| Topic | Decision |
|---|---|
| Direction | **Your world everywhere**: the Journey world you're in (hell → heaven) sets the app's colours, on a polished, playful game style. |
| Strength on Today | **Colours only**: no images outside Journey. The world sets the accent and a soft tint. |
| Light / dark | The app keeps following the user's light/dark setting; each world has a light and a dark version of its colours. |
| Today top | **Big progress hero**: big "Day N" in the world colour, a thick ring with tasks done (3/5), streak and XP badges, where you are in the world, the duck beside it with its speech bubble. The quote moves under it, smaller. |
| Done tasks | **Collapse to one line**: icon, tick, summary ("2 workouts · 95 min"); tap to reopen. |
| Icons | **Custom icon set** drawn in code (replaces emoji in the UI), coloured by the world. |
| Fonts | Nunito for text + **Lilita One** for big numbers and titles. |
| Stats | **Progress story**: journey progress through the 6 worlds, illustrated totals, then the weight chart. |
| Gallery | **Grid by world**, with a duck-with-camera empty state. |
| Settings | **Grouped list** like iPhone Settings: compact rows in sections, each opening its own page or sheet. |
| Nav bar | **Floating bar**, active tab in a pill of the world colour. |

## Delivery: five parts, one PR each

1. **Foundation**: world colours, display font, icon set, floating nav bar, restyled buttons and cards. (Specified below.)
2. **Today**: progress hero, collapsing done tasks.
3. **Stats**: progress story.
4. **Gallery**: grid by world, empty state.
5. **Settings**: grouped list.

Each part is testable on the phone through the PR's Vercel preview before merging. Parts 2–5 get their own short plan when they start; their outline is at the end.

## Part 1 — Foundation

### World colours

**Which world:** the current attempt's day picks the world (`worldForDay`, from `src/screens/Journey/worlds.ts`).
- Before the start: **hell** (you're at the bottom).
- After a completed challenge (victory): **heaven**.
- No attempt yet (onboarding): **hell**.

**Mechanism:** a small hook in `App` sets `data-world="hell" | … | "heaven"` on `<html>`, next to the existing `.dark` class. `src/styles/index.css` defines the world tokens per `[data-world]`, with a light block and a `.dark[data-world]` block. Screens only use the token names, so a new world recolours the app without any screen changing.

**Tokens** (Tailwind theme names; starting values below, tuned until the contrast test passes):

| Token | Use |
|---|---|
| `--color-world` | accent fill: progress rings, active nav pill, primary buttons, done ticks |
| `--color-world-ink` | text and icons in the world colour (≥ 4.5:1 on `surface`, `canvas` and `world-soft`) |
| `--color-world-soft` | tint: hero background, active and done states, chips |
| `--color-on-world` | text on a `world` fill (≥ 4.5:1) |
| `--color-canvas` | the page background, overridden per world with a faint tint of it |

| World | Light: world / ink / soft / canvas | Dark: world / ink / soft / canvas |
|---|---|---|
| Hell | #e2531f / #b33a12 / #fde6dc / #fdf6f3 | #ff6a2a / #ff8a5a / #3a1812 / #1a1211 |
| Wasteland | #8a7b6e / #6b5d52 / #efe9e3 / #f8f6f3 | #b3a598 / #cbbfb3 / #2e2824 / #171513 |
| Dark Forest | #2f7d4f / #22643c / #dcefe2 / #f4f9f5 | #4fae74 / #6fd093 / #16301f / #111815 |
| Meadows | #3f9a3a / #2f7a2b / #e1f2d6 / #f6fbf1 | #6cc35e / #8fdc80 / #1e3418 / #121811 |
| Mountains | #3a8cc9 / #1f6aa3 / #dfeefa / #f4f8fc | #7cc0f0 / #9fd2f7 / #1c2a38 / #10161c |
| Heaven | #d9a521 / #8a6100 / #fbf0cf / #fdfaf0 | #f3c23a / #ffd76a / #3a3017 / #17150e |

- The existing brand colours (green, orange, blue, yellow, danger) stay for **meaning**: water is blue, the streak is orange, XP is yellow, danger is red. The world colour carries **identity** and progress.
- The theme-colour meta tag (the iPhone status bar) follows `canvas`.

**Contrast:** the README promises WCAG contrast (4.5:1 for text) in both themes. A unit test computes the contrast ratio for every world in light and dark mode:
- `world-ink` on `surface`, `canvas` and `world-soft`
- `on-world` on `world`

### Display font

- **Lilita One** through `@fontsource/lilita-one` (v5.3.0), self-hosted and precached like Nunito (latin subset only).
- Exposed as `--font-display`, with Nunito as the fallback.
- Used for big numbers and screen titles only, never for body text.

### Icon set

- New `src/components/icons/`: simple rounded SVG icons drawn in code, 24×24 grid, 2px round strokes with soft fills.
- They take `currentColor`, so they follow the world.
- **Set:** workout (dumbbell), diet (leaf), water (drop), reading (book), photo (camera), streak (flame), XP (star), journey (map/flag), today (check), stats (chart), gallery (images), settings (gear), lock, plus, minus, close, chevron, joker (card).
- Emoji stay where they're content (the 🃏 on joker days in Journey, the mood scale), and in the duck's speech.

### Floating nav bar

- A rounded bar floating 12px above the bottom edge (plus the safe area), on `surface` with a soft shadow.
- The five tabs use the new icons. The active tab gets a pill in `world-soft`, with its icon and label in `world-ink`.
- Screens' bottom padding grows to clear it.

### Buttons and cards

- **Primary** buttons use `world` / `on-world`; the existing chunky "press down" edge stays, in a darker shade of the world colour. **Danger** buttons keep red.
- **Cards:** 24px radius, `surface` with a hairline border in light mode and none in dark mode, card titles with an icon in `world-ink`.
- **ProgressRing:** world-coloured, with a thicker stroke.
- Toggles and steppers take the world colour when on or active.

### Out of scope for part 1

- Layout changes inside screens (the parts after).
- Journey's own colours (unchanged; it has the world images).

### Testing for part 1

- **World selection:** a unit test for the day → world mapping, including before the start, victory and no attempt.
- **The hook:** sets `data-world` on `<html>`, and updates it when the day moves into a new world.
- **Contrast:** the test above, for every world in both themes.
- **Icons:** each one renders, and is hidden from screen readers unless given a label.
- **Nav bar:** marks the active tab (`aria-current`).
- **Existing tests:** all keep passing (some selectors may move from emoji to labels).
- **In the browser:** screenshots of Today, Stats, Gallery and Settings in hell and in heaven, in light and dark mode.

## Parts 2–5 outline

- **Today:** the hero card (`Day N` in Lilita One with `world-ink`, a ring of tasks done, streak and XP badges, "Hell · 3 days to escape" style world progress, the duck and its bubble beside it). Done task cards collapse to a summary line and reopen on tap. Unfinished ones get a `world` border.
- **Stats:** a journey card (Day N of 75, a bar split into the 6 worlds), illustrated total tiles (water bottle filling, a stack of books, workout hours), then the weight chart restyled.
- **Gallery:** photos grouped by the world of their day, each group with its name and colour. The empty state shows the duck with a camera and a button to Today's camera.
- **Settings:** sections You · Challenge · App · Data · Danger zone, made of compact rows (icon, label, current value, chevron) that open a sheet or sub-page holding today's controls.
