# App look, part 3 (Stats): plan

Spec: `docs/superpowers/specs/2026-10-03-app-look-design.md` (Parts 2–5 outline, Stats).

1. **The climb.** `climbSegments(dayReached)` in `src/logic/climb.ts` splits the 75 days into the six worlds and fills them up to the day reached (tested).
   - `ClimbCard` shows the world's name, "Day N of 75" in Lilita One, the six-part bar in each world's stone colour, and the % of the climb.
   - `StatsScreen` now gets `todayDayNumber` and `completed` from `App`; after a victory, the bar is full.
2. **Illustrated totals** (`StatTiles.tsx`):
   - water: a bottle filled against the water owed so far
   - pages: a stack of books, one more every 100 pages
   - training: hours and minutes
   - perfect days, XP and streak, each with its icon
3. **Weight:** the card gets a `scale` icon and the hairline border; the chart line uses `world-ink` (`--color-chart-line`).
4. The title uses the stats icon instead of the emoji.
5. Checks: tests, lint and build, plus the browser at phone size.
