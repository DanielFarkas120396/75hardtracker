# v4 Part 6: Gallery and Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Gallery tab on the phone is the web's: this attempt's progress photos in one grid of three, newest first, the Compare pill on top (two faces, "Compare", "Day 1 → Day 12"), a lightbox for one photo (Older / Newer, Close), and Compare: a slider over two photos (drag the line, tap a side's "Day N" to pick another day from a strip) and a time-lapse of them all (play, scrub, Replay, a speed slider). With no photo yet, the empty state with the duck and "Take today's photo", which opens Today with its camera.

**Architecture:** One live read gives the attempt's photo entries (a day entry with a photo, its picture's file, newest first), as the web's `useGalleryPhotos(challengeId)`. The rules are already shared: `src/logic/photoCompare.ts` (`comparePair`, `frameMs`, the speed mapping). The lightbox and Compare are full-screen views in one `Modal` each, never both open: Compare and the lightbox swap inside one `Modal` if both are needed. The slider's line follows the finger on the UI thread (Reanimated shared value, the later photo clipped by a view whose width is animated). "Take today's photo" asks Today to open its camera through a small store, then brings Today forward (`router.navigate('/')`).

**Tech Stack:** as part 5. No new package expected; `@react-native-community/slider` is NOT installed: the two range inputs (time-lapse day, speed) are drawn as the app's own slider (a track and a thumb with PanResponder, `accessibilityRole="adjustable"` with increment / decrement actions), unless one already exists in `components/ui/controls.tsx` (check first).

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 6). Web designs: `2026-11-17-gallery-library-design.md`, `2026-10-20-photo-compare-design.md`. Web code: `src/screens/Gallery/` (`GalleryScreen`, `PhotoThumbnail`, `PhotoLightbox`, `PhotoCompare` and their tests), `src/hooks/useGalleryPhotos.ts`, `src/logic/photoCompare.ts`, Today's `openCamera` / `onCameraOpened` props (`src/screens/Today/TodayScreen.tsx`).

## What differs from the web, on purpose (said plainly to the owner)

- **Escape, focus return and `aria-pressed`** have no phone equivalent; VoiceOver gets `accessibilityState={{ selected }}` on the Slider / Time-lapse pills and on the strip's marked day, and a Close button in each view.
- **The time-lapse preloads with `Image.prefetch`** of every file (the web decodes object URLs, with the same 3-second limit before it plays anyway).
- **The slider clips the later photo with a view's width**, not `clip-path`; same split, same line and knob.

## Global Constraints

- Parts 1 to 5's constraints hold (the `v4` worktree, `npm run check` before every commit chained with `&&`, `@logic/*` and `@schema` only, `transaction()` for every write, no clock or ref read while rendering, tests outside `app/`, ONE `Modal` at a time, 48-point targets, reduce motion, English copy, one shared gate via `useGate()`).
- Same wording as the web: "Attempt #N", "Gallery", "No photos yet", "One photo a day, and in 75 days you'll see how far you climbed.", "Take today's photo", "Compare", "Day 1 → Day 12", "Day 12 progress", "Attempt #2 — Day 12 · 12 Oct 2026", "← Older", "Newer →", "Slider", "Time-lapse", "Change the earlier day, Day 1", "Day 1 → Day 12 · 11 days", "Replay", "Slow", "Fast", "Speed", "Loading…".
- The Gallery only reads. Reduce motion: the time-lapse opens on the last photo, paused, with no speed slider (as the web).
- A photo row whose file is missing (a seed from before part 5, a failed copy) shows the tile's world tint, never a crash.

## Review Focus

1. The grid: this attempt's photos only, newest first, three across, "Day N" on each; a retaken photo shows once.
2. The pill: only with two photos or more; the first and the latest; opens Compare.
3. The empty state: duck, words, "Take today's photo" brings Today forward with its camera open (once: going back to Gallery and to Today again does not reopen it).
4. The lightbox: the photo tapped, "Attempt #N — Day N · date", Older / Newer disabled at the ends, Close and a tap beside it.
5. Compare's slider: starts on the first and the latest; dragging moves the line (0 to 100%); picking a side's day from the strip (the other side's day disabled, the marked one centred) keeps the earlier one earlier (`comparePair`); "N days" / "1 day".
6. The time-lapse: plays once from the first photo at `frameMs(n)`, stops on the last, Replay; scrubbing pauses; speed changes the pace; reduce motion as above.
7. One `Modal` at a time; a blocking screen bringing Today forward closes whatever is open on the Gallery (as the Journey's day card does).

---

### Task 1: The photos

`mobile/src/gallery/useGalleryPhotos.ts`: entries for the gate's attempt (day entries with a photo, their photo rows in one `photoRepo.getMany`, file URIs through `pictureUri`), newest first. Tests: Review Focus 1, a missing file.

### Task 2: The page

`gallery/GalleryScreen.tsx` (header with the flame, the pill, the grid, the empty state), `gallery/PhotoThumbnail.tsx`, the route `app/(tabs)/gallery.tsx` reading `useGate()`. "Take today's photo": a `cameraRequest` store read by Today's `PhotoCapture` (open the camera once, then clear), plus `router.navigate('/')`. Tests: Review Focus 2, 3.

### Task 3: The lightbox

`gallery/PhotoLightbox.tsx`. Tests: Review Focus 4.

### Task 4: Compare

`gallery/PhotoCompare.tsx` (`CompareView`, `Slider`, `DayStrip`, `TimeLapse`) and the slider control if `components/ui` has none. Tests: Review Focus 5, 6 (fake timers with the 16 ms `requestAnimationFrame` stub where animations run).

### Task 5: Seeds, check, review

- [ ] "Seed Day 30" already gives 29 pictures; check the Gallery and Compare with it.
- [ ] `npm run check`, commit, push.
- [ ] One independent review of the part's diff on a frozen snapshot; fix Critical and Important findings with a failing test first, list the Minor ones in the ledger `.superpowers/sdd/2026-11-19-v4-part-6-gallery/progress.md`.

## Done when

- `npm run check` passes in `mobile/`.
- The seven Review Focus cases hold in tests.
- The spec's build-order line for part 6, the memory file and a hand-over note say where things stand.
