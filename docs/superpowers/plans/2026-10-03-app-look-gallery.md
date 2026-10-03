# App look, part 4 (Gallery): plan

Spec: `docs/superpowers/specs/2026-10-03-app-look-design.md` (Parts 2–5 outline, Gallery).

1. **Groups by world.** `groupByWorld(entries)` (`src/screens/Gallery/groups.ts`, tested) splits the newest-first photos into runs from the same world of the same attempt. Each run keeps its place in the whole list, so the lightbox still swipes through everything.
2. **Each group wears its world.**
   - The dark world CSS blocks also match `.dark [data-world]`, so any element can set its own `data-world`.
   - A group's pill and thumbnail rings use its world's colours; the attempt number shows only when there are several attempts.
3. **Empty state.** The duck with a camera badge, a line of text, and "Take today's photo" (tested).
   - The button goes to Today with the camera open: `App` keeps a one-time `cameraRequested` flag, passed through `TodayScreen` to `PhotoCard`.
   - `PhotoCard` starts with its camera open, scrolls into view, and clears the flag. The flag is also cleared when switching tabs.
4. The title uses the gallery icon instead of the emoji.
