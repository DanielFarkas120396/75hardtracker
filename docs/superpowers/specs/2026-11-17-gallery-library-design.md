# Gallery library

Date: 2026-11-17 · Status: **agreed** with the owner on 2026-11-17 (mockups seen in chat). Built on `feat/gallery-library`, PR open; phone check pending.

## Why

The Gallery split photos by world (Dark forest…) and by attempt, which broke the run of photos into chunks. The owner wants one continuous library of this attempt, Compare up front, and control over how fast the time-lapse plays.

## Decisions

| Topic | Decision |
|---|---|
| Groups | None. One grid, newest first. No world names, no attempt labels. |
| Which photos | The current attempt only. Older attempts stay in Settings → Attempt history, which already shows each attempt's photos. |
| Subtitle | "This attempt's progress photos." |
| Compare | A centred pill under the title, above the grid (mockup "B"): two small round thumbnails (the first and the latest photo, overlapping), "Compare", and "Day 1 → Day 32" under it. Shown from 2 photos. Opens the same full-screen Compare as before. The header button is gone. |
| Speed | A slider in the time-lapse, under the day scrubber, "Slow" on the left and "Fast" on the right. From 1 s to 0.05 s per photo, on a log scale. |
| Empty state | Unchanged. |
| Data | No Dexie change. |

## Speed slider (calls made by Claude)

- Starts at today's pace (`frameMs(count)`, about 4 s for the whole run), so nothing changes for someone who never touches it.
- A change applies from the next photo, even mid-play.
- Not remembered: it starts at the default each time Compare opens.
- Hidden under "reduce motion", since the time-lapse doesn't play by itself then.
- No "x s per photo" line under it (the owner dropped it). VoiceOver reads it as "Speed", with the time per photo as its value.

## How it's built

- `GalleryScreen` takes the current `challengeId` and loads `useGalleryPhotos(challengeId)`. `groups.ts` and its test are deleted.
- The Compare pill is a `button` named "Compare", in `GalleryScreen`.
- `src/logic/photoCompare.ts`: `speedToFrameMs(position)` and `frameMsToSpeed(ms)`, between 1000 and 50 ms.
