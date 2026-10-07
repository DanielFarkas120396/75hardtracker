# Project journal

A day-by-day record of what shipped, for note taking and follow-up. Built from the git history and the PRs (merge commits not counted). Newest open items are at the end.

**Span:** 2026-09-24 → 2026-10-07 · 12 working days · about 220 commits · about **52 hours** of work · 65 PRs, all merged.

| Day | Time | Commits | PRs | Headline |
|---|---|---|---|---|
| 09-24 (Thu) | ~2h05 * | 11 | — | The app exists: Today, Journey, gamification, Gallery, Stats, Settings, PWA, dark mode |
| 09-25 (Fri) | ~8h10 | 25 | — | Polish phases 5–7; the knife-holding duck is born |
| 09-26 (Sat) | ~6h00 | 17 | #1–#3 | Duck merged; animated flame; the ruleset engine |
| 09-27 (Sun) | ~7h30 | 30 | #4–#6 | 75 Strong / Medium / Soft; give up a challenge |
| 09-28 (Mon) | ~3h55 | 10 | #7 | Welcome flow and player profile |
| 09-30 (Wed) | ~40 min | 1 | #8 | Sunday-evening backup reminder |
| 10-01 (Thu) | ~15 min * | 1 | — | Camera feedback note |
| 10-02 (Fri) | ~3h45 | 13 | #9–#14 | Inline camera; local-only decision; roadmap; Journey hell→heaven |
| 10-03 (Sat) | ~1h50 | 17 | #15–#19 | v2 redesign: the app wears your world |
| 10-05 (Mon) | ~8h10 | 48 | #20–#38 | v2 features, v2 → main, Today as a task board, workout history |
| 10-06 (Tue) | ~40 min * | 4 | #39–#40 | Onboarding redesign: sign the deal |
| 10-07 (Wed) | ~9h00 | 43 | #41–#65 | Onboarding & Today rounds, gauge, draw to commit, Ember v3 → main, Journey day cards |
| **Total** | **~52h** | **~220** | **65** | |

Time is an estimate; the method and the hour-by-hour stretches are in [Time spent](#time-spent). * = no session transcript that day, so a lower bound from commit times.

---

## 2026-09-24: the first version

Built in one afternoon (14:20 → 17:18), straight on `main`.

- **Foundation:** Vite + React + TypeScript scaffold, Dexie schema, pure challenge-logic module with unit tests.
- **Screens:** Today (task logging, day-complete celebration), Journey map with the day-failure / restart flow, Gallery, Stats, Settings with JSON export/import.
- **Gamification:** XP, streak, badges, mascot states.
- **Hardening:** fixes for Day-75 completion, streak, start date, midnight rollover and date parsing; unique indexes, safe export/import, photo cleanup, error screens.
- **Platform:** installable offline PWA; dark mode (system / light / dark).
- Weight logging with a chart started (finished the next day).

## 2026-09-25: polish phases, and the duck

**Morning, phases 5–7 (09:33 → 11:57)**
- Mood and notes on Today; a celebration per finished task; mascot on Today.
- History shows each attempt's progress, days and photos.
- Books can be edited and safely deleted; future Journey days are locked.
- Performance: attempt stats in one batched query; rule values from constants.
- Accessibility: reduced motion honoured, every text colour meets WCAG contrast in both themes, desktop fit, reliable sound unlock.
- "Log the rest of today's pages" in one tap. README describes features, scripts, dev scenarios, backups.

**Afternoon and evening, the knife-holding duck (15:34 → 20:51)**
- Designed and planned, then built: a spring motion rig (poses per mood, tap cycle, knife toss) replacing the blob mascot.
- **Menace rule:** the duck threatens only when the remaining tasks no longer fit before bedtime. Bedtime is a setting; each day stores a plan.
- Lines per menace level, plan and reaction; a synthesized knife sound (gated by the sound setting).
- You can tell the duck your plan. Minute clock with the dev-only `?now=` override.
- The duck becomes the app icon.

## 2026-09-26: duck merged, flame, rulesets

- **PR #1 merged:** the knife duck. Final fixes: a plan's time estimate is frozen when saved; the duck stays still on error screens with Reduce Motion; he waits for the saved bedtime before judging; Today starts each day with fresh state.
- **PR #2:** animated streak flame (Noto's animated fire), with tests for going out and coming back.
- **PR #3 (refactor, part 1 of 2 for variants):** challenge rulesets (75 Hard, Strong, Medium, Soft) defined; every rule check takes a ruleset; each day is judged by its own attempt's rules. Missed days counted only up to Day 75, rulesets can forgive some. A golden test proves an old (pre-variants) 75 Hard attempt is judged exactly as before.

## 2026-09-27: challenge variants and giving up

**PR #4, 75 Strong / Medium / Soft (merged)**
- Recovery days and declared social occasions count toward completion (jokers).
- Choose, switch and start variants; the challenge can be changed in Settings until Day 1; pick the next one after a victory.
- A used joker is announced; forgiven days are marked on the Journey.
- Every rule, cheer and screen is worded for the attempt's challenge.
- Fixes: start-date validation, occasions stay on their dates when the start moves, confirmation before cancelling today's occasion, this week's recovery day shown up front.
- Tests prove every new write path leaves an old attempt untouched.

**PR #5, give up a challenge (merged)**
- New "abandoned" status; Settings → give up, behind **four confirmations**.
- A blocking "You gave up" screen that starts the next challenge; the give-up day is marked in the history.

**PR #6:** quiet test output (the Lottie player is stubbed in tests); full-screen screens focus their title.

Also: the emoji flame stays when the Lottie player can't load.

## 2026-09-28: welcome flow

**PR #7 (merged)**
- Welcome flow, one screen at a time: name, challenge, reason, start. Finishes in one transaction.
- The player's profile is stored; the app greets them by name, keeps the reason in view and quotes it back when it gets hard.
- Name and reason editable in Settings → Profile.
- Fixes: no attempt is created before the welcome flow finishes; double taps between steps are ignored.
- Fire animation and character inspiration assets added; dated feedback notes.

## 2026-09-30: backup reminder

- **PR #8** (merged 10-02): a Sunday-evening reminder to export a backup.

## 2026-10-01

- Feedback note for an in-app camera.

## 2026-10-02: camera, decisions, Journey

- **PR #9, inline camera:** the camera lives in a sliding sheet at 65% over a 25% tint, page scrollable behind, floating controls. Never full-screen.
- **PR #10:** duck animations brainstorm notes, **on hold** (no Higgsfield credits).
- **PR #11:** decision to **stay local-only** (no backend, no sign-in); Google Drive backup first if ever needed.
- **PR #12:** roadmap: design pass → photo compare / share card → Face ID lock → dev time travel → paywall.
- **PR #13:** the end-of-Day-1 challenge lock is made clear in Settings.
- **PR #14, Journey map:** a climb from hell to heaven through 6 worlds, with the owner's generated background images, eased cross-fades, and three.js particle effects per world.

## 2026-10-03: v2, the app wears your world

Built on the long-lived `v2` branch, tested over the local network.

- **Part 1 (#15):** contrast-checked colour palettes per world as CSS tokens; the app takes the current Journey world's colours; Lilita One for titles; custom icon set; floating nav bar with a world pill; buttons, cards, rings, toggles and steppers wear the world.
- **Part 2 (#16):** Today hero; done tasks fold into one line.
- **Part 3 (#17):** Stats tells the climb: worlds bar, illustrated totals, world-coloured chart.
- **Part 4 (#18):** Gallery grouped by world, with a duck empty state that opens the camera.
- **Part 5 (#19):** Settings as a grouped list, each row opening its own page.

## 2026-10-05: v2 lands, Today becomes a board

The biggest day by commits (48).

**Finishing v2 (into `v2`)**
- **#20:** dev-only time travel to any world of the climb.
- **#21:** HTTPS dev server for phone tests, so the inline camera works.
- **#22:** late logging: yesterday stays open until noon, finishable from Today.
- **#23–#24:** app lock: a PIN, banking-app style, with Face ID (WebAuthn) as the shortcut and a tripwire way out.
- **#25:** install-first onboarding on phones, restore from the welcome screen, password-protected backups.
- **#26–#27:** CLAUDE.md, refreshed README, specs and roadmap; tests for the backup sheet and restore.

**v2 → main**
- **#28 merged v2 into `main`**; tag `v1` keeps the first version. **#29** documents it.
- **#30:** tidy repeated copy, a silent failure and the badge toast stack.

**Today as a task board (into `main`)**
- **#31:** XP removed; spec for the board.
- **#32:** a grid of task tiles with status lines and progress, a task sheet per tile, shortcuts on tiles (a glass of water, a page, the camera), a shorter top so the board fits without scrolling, the duck in the hero's corner.
- **#33:** diet switches sit on the diet tile; the social-occasion button moves under the duck.
- **#34:** the Workouts tile opens a small "Add workout" sheet.

**Workout history (#35–#38)**
- Logos for the seven activities; workouts grouped by activity; a "feel" per session (kept in backups).
- Stats: Weight folded, Workouts under it; the streak and perfect-days tiles go (#37); the Training tile goes and workout cards start closed (#38).
- **#36:** a flaky onboarding test fixed.

## 2026-10-06: onboarding redesign

- **PR #39 (merged):** sign the deal, progress kept between visits, a clearer start and picker.
- **PR #40:** ignore `.impeccable/` (local design reviews).
- Two slow first renders get more test time under load.

## 2026-10-07: rounds, Ember, Journey days

The busiest day by PRs (25). Until about 15:50, five rounds on v2 shipped straight into `main`; then the whole app was reskinned as **v3, the Ember look**.

**1. Onboarding round 2 (#41–#44)**
- No preselected challenge; the deal stays within reach; Hold sits after the rules card; the deal fades in line by line.
- After 18:00 the start date defaults to Tomorrow; the social occasion says it's weekly.
- The flow reopens on the first step whose answer is missing or invalid.

**2. Today round 2 (#45–#46)**
- Quiet done tiles; an urgent evening board.
- The duck speaks in a bubble above him that comes and goes, with catchphrases.
- The hero is rebuilt around a large, centred ring. `worldLines.ts` removed.

**3. Today round 3 (#47–#48)**
- One quiet done mark (a tick on the icon's corner).
- At 5/5, the day's notes are the closing ritual. A cleaner hero.
- A photo from the shortcut has no Undo (it would delete the photo).

**4. Gauge ring (#49–#50):** a bar gauge with a crown replaces the ring, one wave per change.

**5. Draw to commit (#51–#52):** the deal is signed by drawing a checkmark. After the phone check: the pad's HTML frame holds the page still on iOS, and a fast checkmark with a tiny first arm is accepted.

**6. Ember look, v3 (#53–#61)**
- Five style mockups compared; **Ember** chosen: warm black, cream ink, amber accent, a sunrise glow behind the hero, world colours muted.
- Built on the `v3` branch: foundation (tokens, fonts, flat pill buttons, nav) #53 · Today #54 · Stats #55 · Welcome and onboarding #56 · done tasks fold into chips at any hour, tiles keep their place #57 · the other screens #58 · stacked workout cards back, keeping their colour and unfolding smoothly #59.
- **#60 merged v3 into `main`**; tag `v2` (7a2f876) is the fallback. #61 documents it.

**7. Journey day cards (#62–#64):** tap a past day, today or a forgiven day; a card grows from the stone, centred, with only the photo, notes and workouts. Phone-checked.

**8. PR #65 (merged 10-07, 19:12):** two tests failed after 18:00 because of the Tomorrow default; their clock is now frozen at 09:00.

---

## Time spent

**Total: about 52 hours** over 12 working days (2026-09-24 → 2026-10-07, up to 18:29 on the last day).

How it's estimated:
- The timestamps of every message in the Claude Code sessions for this project (main checkout and worktrees, subagents included), in Brussels time.
- Parallel sessions count once: it's wall-clock time, not the sum of the sessions.
- A gap of more than 20 minutes is a break. Each stretch gets 15 minutes in front, for reading and thinking before the first message.
- Days without a transcript (*) use commit times instead (a gap of more than an hour is a break). They're lower bounds: the work before the first commit and between commits isn't seen.
- Work that ran past midnight counts on the day it started.

| Day | Time | Stretches |
|---|---|---|
| 09-24 | ~2h05 * | 14:05–14:50, 16:00–17:18 |
| 09-25 | ~8h10 | 09:18–12:20, 13:56–14:28, 14:44–17:13, 18:56–21:04 |
| 09-26 | ~6h00 | 10:10–11:33, 17:31–20:04, 22:26–00:31 |
| 09-27 | ~7h30 | 03:26–05:43, 08:26–10:58, 13:26–15:15, 19:57–20:12, 20:40–21:01, 21:33–21:49 |
| 09-28 | ~3h55 | 10:54–13:40, 15:46–16:42, 19:34–19:50 |
| 09-30 | ~40 min | 19:01–19:43 |
| 10-01 | ~15 min * | 13:59–14:14 |
| 10-02 | ~3h45 | 08:19–08:38, 08:45–09:00, 10:39–12:33, 16:02–17:17 |
| 10-03 | ~1h50 | 11:15–12:18, 12:56–13:12, 14:30–15:02 |
| 10-05 | ~8h10 | 08:54–09:09, 10:27–10:57, 11:08–11:23, 12:52–14:02, 14:11–14:44, 15:03–20:28 |
| 10-06 | ~40 min * | 16:02–16:43 |
| 10-07 | ~9h00 | 08:05–10:14, 10:21–11:36, 12:22–12:44, 12:55–13:17, 13:37–16:37, 16:45–18:36 |
| **Total** | **~52h** | |

---

## Open items (as of 2026-10-07)

- [x] **Merge PR #65** (test clock freeze): merged 2026-10-07; all 945 tests pass on `main`.
- [ ] **`.claude/launch.json`** has an uncommitted `dev-phone-main` entry (port 5197, `main-phone` worktree): commit or drop.
- [ ] **Phone pass on the Ember screens.** The specs record phone checks for the earlier rounds and the Journey cards, not for the whole v3 look.
- [ ] **Duck animation around the signature** (draw to commit): still to design.
- [ ] **Face ID on the iPhone:** untested, needs a real domain (not the Wi-Fi IP).
- [ ] **Roadmap left:** photo compare / share card, paywall.
- [ ] **Parked:** duck animations (brainstorm notes from 10-02).
- [ ] **Parked:** per-variant palettes (deferred since the variants work).
