# Ember look (v3): design

Date: 2026-10-07 · Status: **merged into `main`** (PR #60, 2026-10-07) after parts 1–5 and the board change landed on `v3` (PRs #53–#59). The tag `v2` keeps the app as it was just before.

The owner found the app too "Duolingo-y": chunky buttons, rounded fonts, candy colours. Five style mockups were compared on 2026-10-07 (Night sky, Ember, Performance, Paper dark, Deep forest); the owner picked **Ember**. The mockup source is `2026-10-07-ember-look/board.html` (throwaway HTML, all five styles, `?style=s2` for Ember) and the render is `2026-10-07-ember-look/ember.png`.

## What the owner asked for

| Topic | Decision |
|---|---|
| Keep | The duck, the gamification (streak, XP, worlds, the climb), the Today layout (hero, 5 tiles, chips, floating nav). |
| Drop | Chunky "press down" buttons, Lilita One and Nunito, saturated accents and soft candy tints. |
| Feel | Serious and athletic, but calm and premium. References: Pillow, BitePal, Hatch Sleep. Deep moody backgrounds, softness without cuteness, big clean numbers, warmth. |
| Theme | Dark first. Light mode stays but is secondary. |
| World colours | Kept, muted: the world sets the accent, used sparingly. |
| Layout | Mostly skin: structure stays, small layout changes allowed. |
| Gauge | Free to change (the bar gauge from PR #49 is not sacred). |
| Icons | Free to change per style. |

## The Ember direction

- **Canvas**: near-black warm brown (`#16110e`), cards one step lighter (`#221a15`), no hairlines in dark mode.
- **Ink**: cream (`#f6ecdc`), muted at 62% for secondary text.
- **Accent**: amber (`#e2a45a`) for the brand; done states in a muted green (`#7fb08a`) on a dark green tint (`#1d2419`). In the app the amber is the Hell/Ember base; each world replaces it with its own muted accent (same lightness, same role).
- **Sunrise band**: a radial amber glow behind the hero (top 380px), fading into the canvas. The world colour tints this band.
- **Type**: Barlow Condensed (600) for big numbers, screen titles and the welcome headline (uppercase); DM Sans for everything else; Fraunces italic only for the quote.
- **Shapes**: 20px card radius, pill buttons and chips, 12px icon wells.
- **Gauge**: a 240° arc of ticks (40 ticks), amber ticks lit for done tasks, the number in the middle, "today's tasks" under it.
- **Icons**: the existing stroke set, 2.25px strokes, amber on a 14% amber well; green when done.
- **Duck**: current art, warmed (`sepia(.35) saturate(.9)`), 62px in the hero, 112px on Welcome.
- **Nav**: floating bar in `#1d1612`, active tab on a 16% amber pill with amber icon and label.
- **Welcome**: duck in the glow, uppercase condensed headline, amber pill button, underlined restore link.
- **Stats**: same cards; the world progress bar in amber segments. The workouts keep their stacked activity cards (the owner preferred them to the mockup's rows, 2026-10-07), in a muted amber-to-brown stack.

## Board: chips by default (added 2026-10-07)

The Today board used to fold done tasks into chips and sort the open tiles quickest-first only late in the evening. The owner liked that layout and asked for it as the default, so in v3 it is: done tasks are chips above the board at any hour (the photo chip shows the photo), the open tiles sit in a fixed order (what each task takes in full, quickest first: diet, photo, reading, workouts, water) and never move while a task progresses, and the evening only adds the edge on the tiles (red on what no longer fits before midnight). The tile's pop and burst went with the done tile; the sheet keeps its own cheer.

## Open points for the build

- Light mode values for the Ember palette (not mocked).
- Per-world accent values for the muted set, checked against the 4.5:1 contrast test.
- Whether the arc gauge replaces the bar gauge and crown, or the crown returns on top of the arc.
- Weights, walking and running glyphs in Stats are placeholders in the mockup.

## Delivery

Like v2: `v3` is a long-lived branch from `main`; each part is a PR into `v3`, and `v3` merges into `main` in one go at the end. `main` keeps working meanwhile. Suggested parts: foundation (tokens, fonts, buttons, cards, nav) → Today → Stats → Welcome and onboarding → the rest (Journey chrome, Gallery, Settings).
