# Photo compare

Date: 2026-10-20 · Status: **agreed** with the owner on 2026-10-20 (slider + time-lapse, first vs latest with a day picker, opened from the Gallery). **Built** on `feat/photo-compare` the same day; the iPhone check is still to do. The share card is a separate design, after this one.

## Why

Progress photos are the most motivating part of 75 Hard, but the Gallery only shows them one by one. Seeing Day 1 next to today is what makes the change visible. The camera already shows a ghost of the previous photo, so the photos are roughly lined up, which suits a slider and a time-lapse.

## Decisions

| Topic | Decision |
|---|---|
| Form | A **slider** (one photo over the other, drag to reveal) and a **time-lapse** (every photo in order). |
| Which photos | This attempt only. The slider opens on the first and the latest photo. Either side can be changed to another day of this attempt. |
| Where it opens | A "Compare" button in the Gallery header. Nowhere else. |
| Data | No new table, no Dexie change. |

## The Compare button

- In the Gallery header, next to the title, in the world colour.
- Shown only when the current attempt (`challengeRepo.getCurrent()`) has 2 or more photos. Photos from older attempts don't count.
- Opens the compare view.

## The compare view

A full-screen dark overlay, like the lightbox (`bg-black/90`, fades in). ✕ at the top right, Escape, and a tap outside the photo all close it. Escape is caught in the capture phase, as in the lightbox.

Two modes, switched by a pair of buttons under the photo: **Slider** (the default) and **Time-lapse**.

### Slider

- One frame, portrait, as wide as the screen allows (`max-h-[70dvh]`). Both photos are cropped to it the same way (`object-cover`), so lined-up photos stay lined up.
- The **earlier** photo is underneath and the **later** photo on top, clipped from the left edge to the line. The line starts in the middle.
- A line in the world colour with a round handle. Dragging anywhere on the frame moves the line to the finger. The frame has `touch-action: none` and is an HTML element, not an SVG (iOS ignores `touch-action` on SVG; see draw to commit).
- Labels in the top corners: the earlier day on the left ("Day 1"), the later day on the right ("Day 40"). Under the frame: "Day 1 → Day 40 · 39 days".
- **Picking a day:** tapping a label opens a strip of this attempt's photos (thumbnails, oldest first, scrolls sideways) under the frame. Tapping a thumbnail sets that side. The current day of that side is marked. The other side's day can't be picked (it's dimmed). If the pick puts the days in the wrong order, the two sides swap, so the earlier day is always underneath and on the left.
- **VoiceOver:** a native range input (0 to 100, visually hidden) over the frame, named "Compare Day 1 and Day 40", so swiping up or down moves the line. The labels are buttons: "Change the earlier day, Day 1".

### Time-lapse

- Plays every photo of the attempt, oldest first, in the same frame. A large day counter ("Day 12") sits in the top left corner.
- **Pace:** the whole run takes about 4 s. Each frame lasts `4000 / number of photos` ms, kept between 80 and 400 ms. So 10 photos take 4 s, 75 photos take 6 s, and 3 photos take 1.2 s.
- It starts when the mode is opened, stops on the latest photo, and then shows "Replay".
- **Scrubber:** a range input under the frame, one step per photo. Dragging it pauses the playback and shows that day. Replay starts again from the first photo.
- **Reduce motion:** the time-lapse never plays by itself. It opens on the latest photo, and the scrubber moves through the days. Replay isn't shown.
- Photos are decoded before the playback starts (the first frame waits until they're ready), so it doesn't stutter on the phone.

## Edge cases

- **Exactly 2 photos:** the slider works and the strip shows 2 thumbnails. The time-lapse plays 2 frames.
- **A photo retaken today:** the live query updates the view. If a side's photo is gone, that side goes back to the default (first or latest).
- **Day without a photo:** it's not in the strip or the time-lapse. Days are labelled by their challenge day, so gaps show in the numbers ("Day 3, Day 5").
- **No current attempt** or fewer than 2 photos: no button.

## How it's built

- `src/logic/photoCompare.ts`, pure functions:
  - `comparePair(entries, earlierId, laterId)`: the picked photos, earlier first. A picked photo that's gone falls back to the first or the latest, and the same photo is never on both sides.
  - `frameMs(count)`: `clamp(4000 / count, 80, 400)`.
- `src/screens/Gallery/PhotoCompare.tsx`: the overlay with both modes, using `BlobImage` for the slider. The time-lapse decodes every photo first, but plays after 3 s anyway, because `decode()` can wait forever (it did once in a hidden browser pane).
- `GalleryScreen.tsx`: the button and the open state. It takes the current `attemptNumber` from the App and picks this attempt's photos out of the gallery it already loads, so there's no second query.
- Reduce motion comes from `useReducedMotionConfig()`, as elsewhere.
- No new dependency.

## Tests

- `photoCompare.ts`: the default pair, the order, and the frame time at 2, 10 and 75 photos and at the bounds.
- Gallery: the button shows from 2 photos of the current attempt, and not for photos of an older attempt.
- Compare view: opens on the first and latest days; picking a day changes a side; a pick in the wrong order swaps the sides; the range input moves the line; Escape closes it.
- Time-lapse: it ends on the latest photo and shows Replay (fake timers); the scrubber shows the day; with reduce motion it doesn't play and opens on the latest photo.

## Not built, on purpose

- Comparing across attempts.
- Saving the time-lapse as a video, or sharing from the compare view (the share card is next).
- Pinch-zoom, or moving a photo to line it up.
- A compare link on Today or in the lightbox.

## Phone check

- Drag the line with a thumb: smooth, and the page doesn't move.
- Pick another day on each side, then pick days in the wrong order.
- Time-lapse with many photos (time travel, Day 40): no stutter, about 4 to 6 s.
- Reduce motion on: no playback, the scrubber works.
- Light and dark.
