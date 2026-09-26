# Knife-duck companion: design

- **Date:** 2026-09-25
- **Branch:** `feat/knife-duck-companion`
- **Status:** approved in brainstorming, awaiting spec review
- **Assets:** [`2026-09-25-knife-duck-companion/`](2026-09-25-knife-duck-companion/):
  - `duck-rig.svg`: the traced, layered drawing (source of truth for the art)
  - `prototype.html`: the approved v3 motion prototype (open it in any browser)

## Summary

Replace the green blob mascot with the user's cartoon duck holding a kitchen knife. He is redrawn as layered vector art and animated in code, so he feels alive and reacts to what you do. He is funny-menacing: cute, deadpan and threatening. How threatening depends on whether today's remaining tasks still fit before your bedtime. You can tell him your plan ("reading at 22:30"), and he backs off until then. On the missed-day screen, a short AI-generated clip (Higgsfield) plays once before the code-drawn duck takes over.

## Decisions (from brainstorming)

| Topic | Decision |
| --- | --- |
| Tone | Funny-menacing: cute, deadpan threats. Not horror. |
| Rendering | Hybrid. A code-drawn, rigged SVG duck everywhere, plus one Higgsfield clip for the missed-day screen, kept only if it matches the style. |
| Target device | iPhone, as an installed PWA in Safari. Touch only: no hover, no Vibration API. |
| Motion quality | Time-based springs and crossfades; nothing may jump. |
| Knife rule | The knife never moves on its own. The arm (wing) carries it; the wrist may only rotate it around the grip. The one exception is a throw: the arm releases it, it flies a ballistic arc, and the hand catches it. |
| Menace timing | Menace depends on remaining tasks versus time left before a bedtime setting, not on the clock alone. |
| Plans | An "I've got a plan" button lets you give tasks a time; the duck ignores planned tasks until their window has passed. |

## Goals

- The duck is the companion on every screen that showed the old mascot, and in the app icon.
- The Today screen feels alive: the duck breathes, blinks, glances around, watches what you touch and reacts to taps and to tasks being ticked or unticked.
- His menace escalates only when it's deserved: when what's left no longer fits before bed, or when you break your own plan.
- Smooth on an iPhone, and respectful of "Reduce Motion".

## Non-goals

- No rebrand: the app's green/orange/blue palette and `theme_color` stay.
- No duck on Journey, Stats or Gallery.
- No device-orientation (gyroscope) tracking, which would need an iOS permission prompt.
- No ambient sound, music or voice lines.
- No notifications and no calendar sync for plans.
- Haptics on iPhone: Safari has no Vibration API. The existing `useHaptics` stays as it is (a no-op there).

---

## 1. The duck

### Art

`duck-rig.svg` is a vector trace of the reference image: about 91% of the reference's outline pixels are shared with the render. Its viewBox is `-10 20 490 500`, and each layer is its own group.

| Layer | Contents | Pivot (SVG units) |
| --- | --- | --- |
| `feet` | two orange ovals, behind the body | — |
| `body` | head and body in one path, including the body edges hidden under the wings | breathing: `234 490` |
| `rw` (right wing) | fill, outer stroke, yellow accent | `405 225` |
| `eyes` (`eL`, `eR`) | dark dots | centres `155.5 177.4`, `314.8 170.6` |
| `happy` | `^ ^` arcs, which replace the eyes | — |
| `brows` (`browL`, `browR`) | two strokes | centres `154 154.5`, `316.5 148` |
| beak | orange ellipse | — |
| `lw` (left wing) | fill, outer stroke, yellow accent, and the knife inside it | shoulder `51 195` |
| `kn` (knife) | blade, glint (clipped to the blade), pink handle | grip `100 332` |
| whole duck | everything above | bottom centre `234 500` |

Colours come from the reference: outline `#5a1a16`, body `#f9dd97`, beak and feet `#ffb624`, blade `#d8d7d5`, handle `#ffa6c5`, accents `#ffc605`. The art keeps these fixed colours in both themes. On the dark canvas the yellow fill defines the silhouette; this was checked in the prototype.

### Moods

`type DuckMood = 'content' | 'watching' | 'tapping' | 'hunting' | 'celebrating' | 'triumphant' | 'judging' | 'waiting' | 'sad'`

Angles are in degrees: negative raises the arm or knife. Brow `anger` goes from 0 (flat, suspicious) to 1 (furious).

| Mood | Where | Pose and behaviour |
| --- | --- | --- |
| `content` | Today, all done | Happy eyes, knife lowered (arm 5, knife 28), gentle hop, right wing waves. |
| `watching` | Today, default | Rest pose (0, 0). Glances around, blinks, a blade glint about every 4 s. |
| `tapping` | Today, cutting it close | Arm −15, knife 15, plus the **tap cycle**; brows shown (anger 0.15), eyes narrowed to 0.9, leans 1.03. |
| `hunting` | Today, out of time or plan overrun | Arm −26, knife 26, arm tremble (±1.1°, about 11 Hz), furious brows, eyes narrowed to 0.72, leans 1.08, stares, slow blinks. |
| `celebrating` | Day-complete overlay | Happy eyes, hop, **knife toss** every ~2.4 s. |
| `triumphant` | Victory screen | Happy eyes, knife raised overhead (arm −70), right wing waves, hop. |
| `judging` | Missed-day screen | Flat stare, brows (anger 0.6), slow tap cycle (period 1.6 s). |
| `waiting` | Before Day 1 | Relaxed, slow tap cycle (period 1.6 s), no brows. |
| `sad` | Error screens | Drooping eyes, knife lowered (arm 8, knife 35), a blue sweat drop, no menace. |

- **Tap cycle** (the knife-safe version of "sharpening"): one cycle per second by default. The arm lifts slowly to −12° (smoothstep over 72% of the cycle), strikes to +3° (ease-in over 8%), then settles back to 0 (smoothstep over 20%). The wrist adds half the angle. On each strike the body gets a small squash and the blade glints. The arm is continuous across the cycle, and the knife only rotates about the grip; the prototype measured 0 px grip drift over 300 frames.
- **Knife toss**: the arm winds down, then flicks up. At the arm's peak the knife is released and follows a parabola about 180 units up, spinning once. The raised hand catches it and dips to absorb the catch. At release and at the catch, the knife's position is continuous with the hand.

### Always-on life (when motion is allowed)

- Breathing: body scaleY 1 ± 0.012, period 2.6 s. Sway: ±1.8°, period 4.2 s.
- Blinks: 150 ms every 1.6–4.8 s. In `hunting`, a 460 ms slow blink every 4.5–7.7 s.
- Blade glint: a white band sweeps across the blade (520 ms, ease-in-out). It's scheduled by mood, and fires on every strike in the tap cycle.
- Glances, when no finger is down: every 1.8–4.4 s, one of: at you `(0, 3)`, down at the list `(5, 9)`, left `(−9, 1)`, right `(8, −1)`. In `hunting` he only stares at you `(0, 2)`.

### Touch gaze (iPhone)

- While a finger is on the screen (`pointerdown`, then `pointermove` with a button pressed), the eyes turn toward it. The offset is capped at 10 units; the gaze spring is k 520, c 42.
- For 1.3 s after the last touch he keeps looking there, then goes back to glancing.
- Scrolling the page makes him look down at the list for 1 s.
- There is no hover tracking.

### Reactions (Today)

| Trigger | Reaction | Line (2.2 s) | Sound |
| --- | --- | --- | --- |
| Tap on the duck | squash impulse, arm jab (−420°/s), wrist flick (−260°/s), brow flash | one of the poke lines | knife "shing" |
| 3 taps within 1.8 s | lunge: arm to −70 for 320 ms, then a stab (+900°/s), lean 1.32, a decaying shake, **one** red flash | "That's it." | knife "shing" |
| A task becomes complete | approving nod: a whole-body tilt impulse and a squash | none (the task card already cheers) | — |
| A task becomes incomplete again | glare: anger 1 and narrowed eyes for 1.5 s | "I saw that." | — |

### Motion engine

- **Springs**: time-based semi-implicit Euler, with 4 ms substeps and `dt` capped at 50 ms. Constants are carried over from the prototype: arm k140/c18, knife k160/c20, lean k120/c20, brows k200/c26, eyes (narrowing) k220/c28, happy-eyes crossfade k180/c24, vignettes k40/c13, gaze k520/c42, squash k380/c16.
- **Crossfades, not swaps**: round eyes and happy eyes crossfade through the `happy` spring; brows fade in and change slope; the bubble text fades out for 160 ms and back in.
- **Rendering**: one frame loop per mounted duck, using Framer Motion's `useAnimationFrame`. It writes SVG `transform` and `opacity` attributes through refs, and React doesn't re-render per frame. SVG attributes are the most reliable transform path on WebKit. The browser pauses the loop while the app is hidden.
- **Reduced motion**: when `useReducedMotionConfig()` is true (it follows the app's `MotionConfig reducedMotion="user"`):
  - every spring snaps to its target, giving a static pose per mood;
  - no idle loops, gaze, shake, pulse or clip;
  - taps still change the bubble line.

## 2. Menace on the Today screen

### The rule

A pure function in `src/logic/menace.ts`:

```ts
menace({ data: DayTaskData, nowMin: number, bedtimeMin: number, plans: Partial<Record<TaskId, number>>, estimates?: Partial<Record<TaskId, number>> })
  → { level: 'content' | 'watching' | 'tapping' | 'hunting', reason: MenaceReason, next?: { task: TaskId; at: number }, broken?: { task: TaskId; at: number } }
type MenaceReason = 'done' | 'plenty' | 'plan-pending' | 'plan-due' | 'close' | 'plan-broken' | 'wont-fit' | 'past-bedtime'
```

`nowMin` and `bedtimeMin` are minutes since local midnight.

**Estimated minutes to finish a missing task:**

| Task | Minutes | Kind |
| --- | --- | --- |
| workouts | 45 × workouts still needed. That's `max(0, 2 − qualifying)`, or 1 if two qualify but neither is outdoors. | long |
| water | 60 per remaining litre, rounded up to the minute | long |
| reading | 2 per remaining page | short |
| photo | 2 | short |
| diet | 2 | short |

**Plans.** A missing task planned at minute `p` has a window ending at `p + e + 15`, where `e` is the task's estimate stored when the plan was saved. When none is stored, `e` is the live `minutes(task)`. Progress made after saving never shortens the window.
- Before the window ends, the task is *covered*: it doesn't count. If `nowMin ≥ p`, the reason becomes `plan-due`.
- After the window ends, the task counts normally, and the level is at least `tapping` (`plan-broken`).
- Plans on tasks that are already complete are ignored.

**Level.** Let `U` be the missing tasks not covered by a plan.
1. No missing tasks → `content` (`done`).
2. `U` empty → `watching`: `plan-due` if a covered task's time has come, else `plan-pending`.
3. Otherwise, with `timeLeft = bedtimeMin − nowMin`, `needed = Σ minutes(U)` and `neededShort = Σ minutes(short tasks in U)`:
   - Long tasks in `U`: `slack = timeLeft − needed`. `hunting` if slack ≤ 0, `tapping` if slack ≤ 60, else `watching`.
   - Short tasks in `U`: `hunting` if `timeLeft − neededShort ≤ 0`, `tapping` if `timeLeft ≤ 30`, else `watching`.
   - The level is the highest of these and any `plan-broken` floor.
   - Reason priority: `past-bedtime` (timeLeft ≤ 0) > `wont-fit` > `plan-broken` > `close` > `plenty`.

**Reference cases.** These double as unit tests. Bedtime is 23:00 unless noted.

| # | Situation | Expected |
| --- | --- | --- |
| 1 | 10:00, nothing done | `watching` / `plenty` |
| 2 | 19:30, 1.7 L water, reading, photo and diet left (126 min) | `watching` (slack 84) |
| 3 | 20:00, same as 2 | `tapping` / `close` (slack 54) |
| 4 | 21:00, one workout left | `watching` (slack 75) |
| 5 | 21:15, one workout left | `tapping` (slack 60) |
| 6 | 22:15, one workout left | `hunting` / `wont-fit` (slack 0) |
| 7 | 22:25, only reading left | `watching` (35 min left) |
| 8 | 22:30, only reading left | `tapping` |
| 9 | 22:40, only reading left | `hunting` / `wont-fit` (20 min left − 20 min needed = 0) |
| 10 | 22:35, reading planned 22:30 | `watching` / `plan-due` (window until 23:05) |
| 11 | 23:05, reading planned 22:30, not done | `hunting` / `past-bedtime` |
| 12 | 20:50, only one workout left, planned 20:00 | `watching` / `plan-due` (window until 21:00) |
| 13 | 21:00, only one workout left, planned 20:00 | `tapping` / `plan-broken` (slack 75, floored) |
| 14 | 15:00, only diet left | `watching` / `plenty` |
| 15 | anytime, all done | `content` / `done` |
| 16 | 23:30, bedtime 23:59, only the photo left | `tapping` / `close` (29 min left ≤ 30; 29 − 2 > 0) |

`next` is the covered plan with the earliest time among the missing tasks. It feeds the `plan-pending` and `plan-due` lines. `broken` is the earliest plan whose window passed with its task still missing; it feeds the `plan-broken` line.

### The clock

- `useNow()` returns minutes since local midnight. It re-ticks every 30 s, and on `visibilitychange`, `focus` and `pageshow`, the same wake-up pattern as `useToday`.
- **Dev only:** `?now=HH:mm` freezes the clock, like `?db=`, so every level can be seen and screenshotted. Production builds ignore it.

### Atmosphere

`MenaceAtmosphere` is a fixed layer behind the Today content: the task cards sit above it, and the bottom nav keeps its own background.

- `tapping`: a warm dark vignette (`rgba(40,14,10,.26)` at the edges) fades in over about 1 s.
- `hunting`: a red edge glow (`rgba(190,24,34,.40)`) pulsing between 78% and 100% opacity with a 2.8 s period. That is far below WCAG 2.3.1's three-flashes-per-second limit.
- The glow covers only the left, right and bottom edges; a mask keeps the top 160 px clear, where the header text sits on the canvas. Card text sits on card surfaces above the layer. Contrast of all text therefore stays as validated in Phase 6. This is re-checked in the browser, in both themes.
- The lunge's single red flash is user-triggered and happens once.
- Reduced motion: a static vignette at its resting opacity, with no pulse.

### Copy (English, in `src/content/microcopy.ts`)

`duckLine({ level, reason, missing, next, dayNumber })` replaces `mascotLine`. Where a row has several lines, they rotate by day number, like the task cheers.

| Case | Line(s) |
| --- | --- |
| `content` | "Perfect day. The knife rests." · "All five. You may live." · "Acceptable. Same time tomorrow." |
| `watching`, nothing done | "New day. I'm watching." |
| `watching`, some done | "{done} down, {left} to go. I'm watching." |
| `watching`, one left | workouts "Just the workouts left. Go." · diet "Tick off your diet. I'll wait." · water "Just the water left. Drink." · reading "Just your pages left. Read." · photo "Just the photo left. Smile. Or else." |
| `plan-pending` | "{Task} at {HH:mm}. I'll be there." (the next plan) |
| `plan-due` | "It's {HH:mm}. {Task}. I'm watching." |
| `close` | "Tick. Tock. You're cutting it close." |
| `plan-broken` | "You said {HH:mm}." |
| `wont-fit` | "Midnight's coming. So am I." |
| `past-bedtime` | "Past your bedtime. Not mine." |
| Poke | "Hands off. Hands on your water bottle." · "Poke me again. I dare you." · "That tickles. The knife does not." |
| Lunge | "That's it." |
| Glare (task unticked) | "I saw that." |
| Plan saved | "{HH:mm}. Not a minute later." (earliest plan) |

`{Task}` uses `TASK_NAMES`.

## 3. Plans ("I've got a plan")

- **Button:** "🗓 I've got a plan" under the bubble on Today (touch height ≥ 48 px). It's shown while any task is missing, and reads "🗓 Edit plan" once a plan exists.
- **Sheet:** the existing `Modal`, titled "Tell the duck your plan". One row per missing task, in `TASK_IDS` order:
  - the task name;
  - `<input type="time">` (the native iOS wheel);
  - a "Clear" button when the row has a value.
  - Actions: "Save plan" and "Cancel".
- **Validation, per row, shown under the input:**
  - earlier than now (minute precision) → "Pick a time later than now.";
  - `time + minutes(task) > 24:00` → "That won't fit before midnight.";
  - Save is refused while any row has an error.
  - Only rows changed since the sheet opened are checked, so an earlier plan whose time has passed never blocks saving the others.
- **After saving**: the duck lowers the knife (a short `content`-like relax) and says the plan-saved line for 2.2 s.
- **Persistence:**
  - Plans live in `DayEntry.plans?: Partial<Record<TaskId, string>>` ("HH:mm"), and each plan's estimate (minutes, frozen at save time) lives in `DayEntry.planEstimates?: Partial<Record<TaskId, number>>`. Both are written by `dayEntryRepo.setPlans(entryId, plans, estimates)`.
  - Plans don't affect completion, so there's no re-sync.
  - Plans are per day: a new day starts with none.

## 4. Bedtime setting

- A new Settings section, "🦆 Companion", placed after "Sound & haptics":
  - `<input type="time">` labelled "Bedtime", range 18:00–23:59, default 23:00;
  - helper text: "The duck only gets menacing when what's left no longer fits before this time. Reading, the photo and the diet only count in the last half hour."
- Stored as the settings row `bedtime` ("HH:mm"). An invalid stored value falls back to 23:00.

## 5. Screens

| Screen | Change |
| --- | --- |
| Today | Duck 88 px (was 64). He's a `<button aria-label="Poke the duck">` with the SVG inside set to `aria-hidden`; the bubble is the message. Adds the plan button, the atmosphere, the reactions and `duckLine`. |
| Day-complete overlay | `celebrating` duck (140 px). Confetti unchanged: its palette already has yellow and orange. |
| Victory | `triumphant` duck (160 px). |
| Pre-start | `waiting` duck (120 px). Copy unchanged. |
| Missed day | The cinematic (section 6) plays once, then the `judging` duck. The closing line becomes "Again. From Day 1. I'm watching." The facts, the missed-task list and the reassurance that data is saved are unchanged. |
| Storage error | `sad` duck (110 px) when storage failed; `waiting` while an update is blocked or opening is slow. No menace, copy unchanged. |
| App error boundary | `sad` duck (110 px), no menace. Copy unchanged. |
| Settings | Companion section (section 4). |
| App icon | `public/mascot.svg` becomes the duck in the `watching` pose, cropped square. `ICON_BACKGROUND` becomes `#e2ddca`, the reference image's backdrop. Icons are regenerated with `npm run generate-pwa-assets`. |

## 6. Missed-day cinematic (Higgsfield)

- **Content:** about 4 s, portrait 9:16, no audio.
  - A dark room with a buzzing bulb.
  - The duck steps out of the shadow and raises the knife, which stays in his wing.
  - The light flickers.
- **Pipeline:**
  1. Render `duck-rig.svg` in the `watching` pose to a 1024 px PNG.
  2. Upload it to Higgsfield.
  3. `gpt_image_2_5` makes the 9:16 start frame: the same flat, thick-outlined style, in a dim room lit from below.
  4. Review the start frame.
  5. `kling3_0` animates it: `std` mode, 5 s, sound off, 9:16, with the start frame as `start_image`.
  6. Encode with ffmpeg (via `imageio-ffmpeg` in a scratch venv): trim to ≤ 4.5 s, 540×960, H.264 (CRF about 28), `yuv420p`, audio track stripped, `+faststart`.
  7. Take a small WebP poster from the first frame.
- **Budget:** about 10 credits per attempt, at most 2 attempts (≤ 20 of the 163.5 available).
- **Acceptance** (reviewed with the user before integration):
  - recognisably the same duck, in a flat 2D style with the maroon outline and pale-yellow body;
  - the knife never leaves the wing;
  - no extra limbs, faces, text or watermark;
  - ≤ 700 KB.
  - If both attempts fail, the cinematic is dropped and the screen uses the `judging` duck alone.
- **Files:** `public/media/failed-day.mp4` and `public/media/failed-day-poster.webp`, both precached (`includeAssets` in `vite.config.ts`).
- **Playback** (`FailedDayCinematic.tsx`), over the missed-day screen:
  - The clip is fetched as a Blob and played from an object URL. iOS Safari makes Range requests for media, which a service-worker precache doesn't answer; a Blob URL avoids that.
  - `<video muted playsInline autoPlay>` with the poster.
  - Tapping anywhere skips it. On `ended` or skip, it fades out over 400 ms.
  - It plays once per `(challengeId, failedDayNumber)`, recorded in `localStorage` (the key is wrapped in try/catch).
  - It never plays under reduced motion, or if the fetch, decode or `play()` fails; the screen then simply shows without it.

## 7. Sound

`playKnifeShing()` in `src/lib/sound.ts` is synthesized like the existing chime, with no audio file:
- band-passed noise sweeping 2→8 kHz over 250 ms;
- plus three short metallic partials (about 3.1, 4.7 and 6.2 kHz) with fast decay.

It plays on pokes and the lunge, gated by the sound setting through a `useSound`-style hook. It's never ambient.

## 8. Architecture

| File | Responsibility |
| --- | --- |
| `src/components/mascot/duckArt.tsx` | The layered SVG from `duck-rig.svg`, with refs for each animated group. No logic. |
| `src/components/mascot/rig.ts` | Pure motion model: the spring step, the pose table per mood, the tap cycle, the toss arc, blink/glance/glint schedules and reactions. `(state, dt, events) → next state + frame transforms`. |
| `src/components/mascot/Mascot.tsx` | The component: `mood`, `size`, optional `reaction` signal and `onPoke`. It runs the frame loop and writes attributes. Keeps its name and path; the `state` prop becomes `mood`. |
| `src/components/mascot/useTouchGaze.ts` | Window touch and scroll listeners → the gaze target. |
| `src/logic/menace.ts` | The rule in section 2, plus `parseHHmm` / `formatHHmm` helpers and the minutes-per-task constants. |
| `src/hooks/useNow.ts` | The minute clock, with the dev `?now=` override. |
| `src/hooks/useMenace.ts` | Entry + workouts + bedtime + plans + now → `menace(...)`. |
| `src/screens/Today/PlanSheet.tsx` | The plan sheet (section 3). |
| `src/screens/Today/MenaceAtmosphere.tsx` | The atmosphere layer. |
| `src/screens/RestartFlow/FailedDayCinematic.tsx` | The clip player (section 6). |
| `src/screens/Settings/CompanionSection.tsx` | The bedtime setting. |
| `src/content/microcopy.ts` | `duckLine` and the poke, lunge, glare and plan-saved lines; `mascotLine` is removed. |
| `src/db/types.ts`, `dayEntryRepo.ts`, `settingsRepo.ts`, `exportImport.ts` | `DayEntry.plans` and `DayEntry.planEstimates`, `setPlans`, the `bedtime` key, and import validation of `plans` and `planEstimates` (both optional; keys must be task ids, values "HH:mm" for `plans` and finite minutes ≥ 0 for `planEstimates`). |
| `src/hooks/useSettings.ts` | Exposes `bedtime` and `setBedtime`. |
| `src/lib/sound.ts`, `src/hooks/useSound.ts` | The knife sound, and `useKnifeSound`, which is gated by the sound setting. |
| `public/mascot.svg`, `pwa-assets.config.ts`, generated icons | The new icon. |
| `vite.config.ts` | Precache the clip and poster. |
| `src/dev/scenarios.ts` | Seeds for the menace and plan states, used with `?now=`. |

There is no Dexie schema version bump: neither `plans` nor `planEstimates` is indexed, and settings are key-value rows.

## 9. Testing

- **Unit (Vitest):**
  - `menace` covers every reference case in section 2, plus bedtime parsing and fallback.
  - The rig checks:
    - the knife's grip stays in the hand for every mood and the tap cycle, and it only leaves during a toss, continuous at release and catch;
    - the tap cycle is continuous at its phase joins;
    - the springs settle;
    - reduced motion gives exactly the target pose.
  - `duckLine` covers each row of the copy table.
  - Plan validation: a past time, overflow past midnight, clearing a row.
- **Database** (`fake-indexeddb`): `setPlans` round-trips; export → import keeps plans; import rejects a malformed `plans`; the `bedtime` default and fallback.
- **Components** (Testing Library):
  - `Mascot` renders each mood and is decorative where it should be;
  - `PlanSheet` shows the validation messages and saves;
  - `CompanionSection` edits the bedtime;
  - the missed-day screen skips the clip under reduced motion.
- **In the browser** (dev server, 390×844 iPhone viewport, light and dark, with and without reduced motion):
  - every screen and mood through the dev scenarios and `?now=`;
  - frame-continuity sampling like the prototype (no dropped frames, no jumps, 0 px grip drift);
  - text contrast over the atmosphere;
  - screenshots for the user.
- **Gates:** `npm run lint`, `npm run test`, `npm run build`. The PWA manifest and precache must include the clip.

## 10. Implementation order

Each step is one commit and leaves the app working.

1. The duck art, rig and `Mascot` with all moods, swapped in on every screen (Today still uses the old lines).
2. The menace rule, `useNow`, `useMenace`, the atmosphere, `duckLine` and the Today reactions.
3. The bedtime setting, plans data and the plan sheet.
4. The celebration toss, victory, pre-start, missed-day `judging` and the error screens.
5. The knife sound and the app icon.
6. The Higgsfield cinematic: generate, review with the user, integrate.

## Risks

| Risk | Mitigation |
| --- | --- |
| The AI clip drifts off-model or the knife floats | Acceptance gate with a 2-attempt cap; fall back to the rig alone. |
| iOS Safari refuses to play video from the service-worker cache | Play from a Blob URL (section 6). |
| Frame drops on older iPhones | One loop per visible duck, attribute writes only, no per-frame React renders, measured in the browser. |
| The copy feels too harsh after 75 days | All lines live in `microcopy.ts`, so they're easy to tune. |
