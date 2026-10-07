# Onboarding, round 2 (handover notes, 2026-10-07)

Status: **done**: answered and built on 2026-10-07 (PR #42). The owner's choices and the work are in [2026-10-07-onboarding-round-2-design.md](2026-10-07-onboarding-round-2-design.md).

## Where things stand

- **Round 1 is merged.** The onboarding redesign went in on 2026-10-06 (PR #39). Its design is in [2026-10-06-onboarding-redesign-design.md](2026-10-06-onboarding-redesign-design.md). It covers:
  - the deal card and "Hold to commit";
  - the draft kept in `localStorage`;
  - the evening hint and the 60-day limit on the start date;
  - the new challenge cards;
  - the why ideas that never overwrite your own text.
- **The owner tried it on their phone,** and it works.
- **`.impeccable/` is in `.gitignore`** (PR #40). The critique reports are on the owner's PC only, so their findings are copied below.
- **This branch** (`feat/onboarding-round-2`) was made from `main` for the round 2 work.

## The second critique (2026-10-06): 26/40, the same as round 1

All of round 1's issues are fixed. This critique looked at the new screens and found these. Line numbers are as of `main` on 2026-10-07.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | System status | 3 | An early release of Hold gives no "keep holding" feedback |
| 2 | Real-world match | 3 | "Joker" is defined before any card shows one |
| 3 | User control | 3 | The deal has no edit links |
| 4 | Consistency | 2 | Two date formats on the deal; chip axes differ per card |
| 5 | Error prevention | 2 | At 21:10 the default is still Today |
| 6 | Recognition | 3 | The start step shows Day 75 but not Day 1 |
| 7 | Flexibility | 3 | — |
| 8 | Minimalist | 2 | Dense challenge cards; "75 Hard" 3 times on the deal |
| 9 | Error recovery | 3 | A disabled Hold on an invalid restored draft gives no reason |
| 10 | Help | 2 | Nothing says what happens after the commit |

The detector found nothing specific to onboarding. Its two browser findings are false positives:
- the "hell" world's cream canvas;
- the height transition, which comes from `WaterTask.tsx:27`.

### Priority issues

1. **[P1] "Hold to commit" is below the fold on the deal.** On 75 Soft, with a later start and a long reason, it's fully off-screen.
   - **Fix:**
     - pin the button and its hint in a sticky footer, like the challenge step (`OnboardingSteps.tsx`, `ChallengeStep`);
     - make the duck smaller on `ready`;
     - drop the subtitle that repeats the start (`OnboardingSteps.tsx:254`).
2. **[P1] The duck celebrates before the signing, and nothing happens after it.**
   - **Why:**
     - `ready: 'triumphant'` (`OnboardingFlow.tsx:26`).
     - On success, the gate swaps straight to the app (`OnboardingFlow.tsx:75`).
     - The redesign spec §1 promised a triumphant duck and "I'm watching." after the commit, and that part was not built.
   - **Fix:**
     - `ready` shows "judging" or "watching";
     - after a successful commit, show the triumphant duck and "I'm watching, {name}." for about 1.2 s, static under reduce motion;
     - then hand over to the app.
3. **[P1] Starting at night is too easy.** `useStartDateChoice` defaults to `'today'` (`useStartDateChoice.ts:30`). The hint is styled like brand text (`OnboardingSteps.tsx:204`).
   - **Fix (needs the owner's call, see below):**
     - after 18:00, default to Tomorrow when there's no draft, or block Today;
     - give the hint a warning style and icon, linked to the choice;
     - show "Day 1: …" beside the Day 75 line.
4. **[P2] The challenge picker is dense, and its chips aren't consistent.** 75 Hard's second chip is water, while the others show the weekly break (`variantHighlights` in `content/variants.ts`). A restored Medium or Soft card can sit under the footer gradient.
   - **Fix:**
     - use the same 3 axes on every card (workouts / weekly allowance / jokers);
     - show the long summary only on the selected card, or leave it to the deal;
     - scroll the selected card into view.
   - **Also:** the medium tagline in code is "One workout. Eat healthy." (`variants.ts:24`), while the spec says "One workout, healthy eating." Align them.
5. **[P2] The hold path with VoiceOver on iOS is unverified.** `HoldButton` commits on a click with `detail === 0` (`HoldButton.tsx:60`), and iOS VoiceOver may send `detail: 1`. A finger drift cancels the hold (`onPointerLeave`, `:70`).
   - **Fix:**
     - test with VoiceOver on the phone;
     - give the button a clearer label;
     - show "Keep holding." (aria-live polite) on an early release.

### Smaller points

- **Accessibility:**
  - Name field: still `aria-label="Your name"` (`OnboardingSteps.tsx:76`); spec §6 said it would be labelled by the question.
  - Why chips: they use `aria-pressed` (`:160`) but behave as a single choice.
  - Announcements: the finish line and the late hint aren't live regions.
  - Progress bar: labelled "Welcome progress" (`OnboardingFlow.tsx:149`).
- **Look:**
  - Dark mode: the onboarding surface is cool slate, while the fields and canvas are warm.
  - The stakes line can orphan "1.": use a non-breaking space in "Day 1".
  - A long reason at `text-2xl font-display` becomes a 5-line block: scale it down past about 60 characters.
  - The date input is left-aligned in a centred flow.
- **States and copy:**
  - A plain "Loading…" flashes before the flow; use a still duck.
  - Returning mode shows "Starting…" while saving (`:243`).
  - InstallFirst has no primary action on iOS.

## Questions for the owner (asked on 2026-10-06, not answered yet)

1. Which first: the deal screen (issues 1 and 2), the night start (3), or the picker (4)?
2. After 18:00, should Today be the default with a clear warning, default to Tomorrow, or be blocked?
3. How much: the top 3 (P1), all 5 issues, or everything including the smaller points?

The critique also raised three provocative questions:
- Should the deal come first, so the name and reason become its signatures?
- Should the duck visibly disapprove of 75 Soft or 75 Medium?
- Should Today after 18:00 be blocked outright?

## How to start the next session

1. Check out `feat/onboarding-round-2` and read this note, CLAUDE.md, and the round 1 design.
2. Ask the owner the 3 questions above. Then write the short design (`2026-10-07-onboarding-round-2-design.md`, or the date work starts) and get it approved.
3. Build it, then run `npx tsc -b`, `npm run lint`, `npm run test` and `npm run build`. All four must pass.
4. Check the screens in the browser. The pane may be hidden, and then framer transitions stall. Jump to a step by seeding the draft and reloading:
   - `?db=<name>&now=21:10`, then
   - `localStorage.setItem('install-skipped','1')`, then
   - `localStorage.setItem('onboarding-draft:HardTrackerDB-<name>', JSON.stringify({step:'ready',name:'Daniel',variant:'hard',why:'…',startChoice:'tomorrow',pickedDate:''}))`, then reload.
5. Let the owner try it on their phone (`npm run dev:phone`, `https://<PC Wi-Fi IP>:5174/?db=onboarding-demo`), then merge the PR.
6. Re-run `/impeccable critique` on `src/screens/Onboarding/OnboardingFlow.tsx` to compare with 26/40.
