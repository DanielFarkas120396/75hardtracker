# Duck animations — brainstorm notes (on hold)

Status: **on hold** (2026-10-02). Brainstormed and agreed in principle, not yet a final spec. Nothing built.
Resume by turning this into a design spec, then a plan.

## Decisions taken

- **Production:** approach A — duck poses generated with **Higgsfield** (transparent images), movement done in code (pop in, slide, walk across, bounce). Only a few loops that need real frames (walk cycle, dances, swim, moonwalk) become small **animated WebP** files. Higgsfield's AutoSprite model can turn one pose into a sprite sheet (walk, run, idle) for those loops.
  - iPhone Safari can't play transparent WebM, so no video files: animated WebP / APNG only.
- **Old code-drawn duck:** undecided. **Decide after a test**: render today's duck to an image, use it as the reference for a Higgsfield character sheet + 4 test poses (side walk, three-quarter flex, edge peek with face and wings, sleepy nightcap), compare side by side, then choose keep both / replace / redo prompts.
- **Random pools:** every event has several animations picked at random, never the same twice in a row.
- **Knife:** only in menacing moments (evening pressure, judging, missed days, sharpening). Otherwise the wings are free for props.
- **Angles to draw:** side profile and three-quarter (plus the front we already have).
- **New moods:** sleepy, proud, excited.
- **Ways to appear:** in place (where the duck already is), **edge peek** (~60px, half visible, slides in and out), **walk across** (~90px, side view), **camera peek** (face and wings gripping the top of the camera view).
- **Surprise appearances:** "now and then" — at most one every few minutes, never while typing. Respect Reduce Motion (still pose instead).

## How it would work (agreed)

- **Pose library:** one image per pose, fixed size (e.g. `duck/side-walk.webp`, `duck/34-flex-2.webp`), with a list in code: angle, knife yes/no, mood.
- **Duck director:** the app reports events (water added, workout logged, badge unlocked…); the director picks from the event's pool, avoids repeats, rate-limits surprises, and handles Reduce Motion.
- Poses cached on the phone the first time they're used (keeps the first load small). Budget: ~512px WebP, ~30–60 KB each.

## Full wish list

🔪 = knife in the animation.

**Today screen — tasks**
| Moment | Where | Pool |
|---|---|---|
| Workout logged | edge peek | 3–4 flex poses (three-quarter, side) |
| +Water | edge peek | sip from a glass · splash, shakes it off |
| Water goal reached | walk across | swims across on a little wave |
| +Reading pages | edge peek | reading glasses · side-view peek at the book |
| Reading late at night | edge peek | falls asleep over the book (zzz) |
| Diet / no-alcohol on | header | thumbs-up nod + 2–3 other approving poses |

**Today screen — time of day**
| Moment | Where | Pool |
|---|---|---|
| First open of the day | header | wakes up under a blanket · coffee mug · other greetings |
| All 5 tasks done | in place + walk across | dances (spin, moonwalk, wing wave) · victory lap · deck chair with sunglasses |
| Evening, day not done | edge peek | 🔪 sharpening the knife · sad puppy eyes · peeks and stares |
| After 23:00, day done | header | points at a bed: go to sleep |
| After 23:00, day not done | header | 🔪 night watch with a flashlight |

**Other screens**
| Moment | Where | Pool |
|---|---|---|
| Journey: today's day | map | side-view duck walking in place |
| Journey: days 7, 25, 50, 75 | map | plants a flag |
| Journey: future days | map | looks at the road ahead |
| Gallery: opening a photo | edge peek | photographer, old camera, flash |
| Gallery: first vs latest photo | edge peek | looks back and forth, impressed |
| Camera panel | camera peek | face and wings over the top edge, curious |
| Stats, Settings | — | nothing |

**Events**
| Moment | Where | Pool |
|---|---|---|
| Badge unlocked | next to the badge toast | pins it on its chest · bites the medal |
| Streak 7 / 14 / 30 / 50 | header, bigger each time | fire hairdo / next to the flame, escalating |
| Tapping the duck | wherever it is | quack, ruffle, spin, fall over… too many taps → annoyed, then turns its back |
| Missed day / gave up | in place | 🔪 writes in a notebook ("I'll remember this") |
| Joker used | in place | pulls a playing card out of nowhere |
| Onboarding | in place, per step | introduces itself · listens to your "why" · excited at the start |

## Short list if credits are tight (16 images)

| # | Pose | Used for |
|---|---|---|
| 0 | Character sheet (front, three-quarter, side) | reference for everything |
| 1 | Side view, walking | walk across, Journey |
| 2 | Side view, peeking from an edge | evening, surprises, Gallery |
| 3 | Face and wings over an edge | camera panel |
| 4–5 | Two flex poses | workout |
| 6 | Sipping water | +water |
| 7 | Reading glasses | reading |
| 8 | Sleepy with a nightcap | night, late reading |
| 9 | Coffee mug | morning |
| 10 | Thumbs up | diet / no alcohol |
| 11 | Proud, chest out | badges, streaks |
| 12 | Excited, bouncing | onboarding, day done |
| 13 | Dancing | day done |
| 14 | 🔪 Sharpening the knife | evening |
| 15 | 🔪 Writing in a notebook | missed day |

The rest keeps using today's code-drawn moods until there are more credits.

## Credits (as of 2026-10-02)

- Higgsfield account: **0 credits, free plan**.
- Rough cost: ~2 credits per good-quality image (Nano Banana Pro). Short list with retries + background removal ≈ **80–120 credits**.
- Options seen: 3-day MCP trial (100 credits, card required, auto-charges €49/month unless cancelled), Plus (1,000 credits/month), Ultra (3,000 credits/month). Prices change — recheck before buying.
- Free first step that needs no credits: build the director + ways of appearing with today's code duck; Higgsfield art slots in later.

## Existing duck (for reference)

- Code-drawn SVG + motion rig: `src/components/mascot/` (`Mascot.tsx`, `rig.ts`, `duckArt.tsx`).
- Moods today: content, watching, tapping, hunting, celebrating, triumphant, judging, waiting, sad. Reactions: poke, lunge, approve, glare, relax.
