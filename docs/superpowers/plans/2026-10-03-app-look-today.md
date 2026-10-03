# App look, part 2 (Today): plan

Spec: `docs/superpowers/specs/2026-10-03-app-look-design.md` (Parts 2–5 outline, Today). Built on part 1's world tokens, icons and display font.

1. **Folding cards.** `Card` gains `title`, `icon` and `summary`. A done card with a summary folds into one line, made of its icon, title, summary, tick and chevron, inside an `aria-expanded` header button; tapping it opens the card again.
   - A card that's already done when it mounts opens folded.
   - A card that's just been done folds after its cheer (2.5 s).
   - Undoing a task opens its card again.
   - Unfinished task cards get a light world-coloured border.
   - Tests are in `Card.test.tsx`.
2. **Task cards** pass their titles, icons and summaries instead of their own emoji `<h2>`:
   - Workouts: "2 workouts · 95 min", or "Recovery day"
   - Diet: "Followed · no alcohol" or "Followed · social occasion"
   - Water: "3.8 L"
   - Reading: "10 pages · <book>"
   - Photo: "Taken"
   - The day-notes card gets the new `notes` icon.
3. **Hero.** `TodayHero` replaces the header. It sits on `world-soft` and holds:
   - the greeting and the attempt line
   - "Day N" in Lilita One and `world-ink`
   - a 92px ring of tasks done
   - streak, XP and joker chips
   - `worldProgressLine` ("Hell · 7 days to escape", in `src/content/worldLines.ts`, with its own tests)
   The duck and its bubble follow it, then the "why" quote.
4. Checks: tests, lint and build, plus the browser at phone size.
