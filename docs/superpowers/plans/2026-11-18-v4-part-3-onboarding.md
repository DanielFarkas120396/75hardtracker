# v4 Part 3: Onboarding to Day 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new user opens the native app, meets the duck, goes through the web app's welcome flow (name, challenge, why, bedtime, start date), signs the deal with a drawn checkmark, and lands on Today with their attempt created.

**Architecture:** The flow's rules, copy, checkmark test and the duck's animation rig move under `src/logic/` on `main` (PR 108) and are imported as they are. The native side re-creates only what is drawn or touched: the duck in react-native-svg driven by the shared rig, the signature pad on React Native's touch responder, native date and time pickers, and the steps as React Native screens. The answers are kept in a draft row until the deal is signed, as the web keeps them in localStorage.

**Tech Stack:** as parts 1 and 2, plus react-native-svg, `@react-native-community/datetimepicker`, expo-haptics, Reanimated (already installed) for the step and card transitions.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (Scope: "Welcome, onboarding, the rules card, the drawn-checkmark deal, the four challenges"; Calls: "Install screens dropped", "Haptics", "Look"). The web flow is the reference: `src/screens/Onboarding/OnboardingFlow.tsx`, `OnboardingSteps.tsx`, and its designs `docs/superpowers/specs/2026-10-07-draw-to-commit-design.md` and the welcome-flow designs.

## Global Constraints

- Parts 1 and 2's constraints hold (worktree, `npm run check` before every commit and the commit only if it passes, the two aliases, `transaction()` for writes, `useToday()`, English copy).
- Same steps, same order, same wording as the web flow. Copy comes from `@logic/variantsCopy` and `@logic/onboardingCopy`; strings that live in the web components are typed again exactly.
- No preselected challenge. After 18:00 the start defaults to Tomorrow. Back keeps the answers. A double tap never skips a step.
- Dropped: Install-first screens and everything about Safari or the Home Screen. Not in this part: the lock offer (it comes with the app lock), the paywall slot.
- The challenge names still read "75 Hard", "75 Strong"… because they come from the shared copy. The rename happens once, on `main`, before a build goes to anyone but the owner.
- Text fields use a 17-point font. Touch targets are at least 48 points. "Reduce motion" removes the transitions and the duck holds his pose.
- A light haptic when the deal is signed.

## Review Focus

1. The app is closed in the middle of the flow: reopening returns to the same step with the answers kept; after signing, the draft is gone.
2. The date passes midnight while the flow is open on the deal: a start date now in the past is refused, with the web's "Change start date" way out.
3. Saving the deal fails: the web's save-failed line shows, the signature is cleared, nothing half-created remains.
4. A backup is restored from the welcome screen: the flow gives way to the app without signing.
5. VoiceOver: the signature pad can be completed without drawing (an accessibility action), and each step's title is announced.

---

### Task 1: Share the onboarding rules and copy (web side, PR 108)

Pure moves with re-exports, four web checks, merged into `v4`: `src/content/variants.ts` → `src/logic/variantsCopy.ts`; `src/content/onboarding.ts` → `src/logic/onboardingCopy.ts` (plus `SAVE_FAILED_LINE`); `src/lib/checkmark.ts` → `src/logic/checkmark.ts` (plus `TYPED_CHECK`); `src/components/mascot/rig.ts` → `src/logic/duckRig.ts`; the pure part of `useStartDateChoice` → `src/logic/startChoice.ts` (`resolveStartChoice`); the draft's type and parser → `src/logic/onboardingDraft.ts`; `STEP_MOODS`, `SIGNED_BEAT_MS` → `src/logic/onboarding.ts`.

### Task 2: The duck

**Files:** `mobile/src/components/mascot/DuckArt.tsx` (the web's paths and colours in react-native-svg, each animated layer taking its transform and opacity as props), `Mascot.tsx` (`<Mascot mood size reaction decorative />`: one `requestAnimationFrame` loop stepping `createRig` from `@logic/duckRig`, holding the pose under reduce motion), tests.

Tests: the accessible label per mood; `decorative` hides it; a frame changes the drawn pose; under reduce motion a frame does not; a new mood reaches the rig; the loop stops on unmount.

ponytail: each frame re-renders the SVG through React state. If the phone shows dropped frames, write the transforms natively instead. The duck's eyes don't follow touches yet (the web's `useTouchGaze`): that comes with Today.

### Task 3: Profile, draft and the gate

- `mobile/src/db/repositories/profileRepo.ts`: `get(): Promise<Profile | undefined>`, `completeOnboarding(input: { name: string; why: string }, firstAttempt?: { startDate: string; variant: ChallengeVariant }): Promise<{ ok: true } | { ok: false; reason: 'invalid' }>`, with the web's behaviour (one transaction: attempt #1 only when there are no challenges; the cleaned profile with `onboardedAt`).
- `mobile/src/onboarding/draftStore.ts`: `loadDraft()`, `saveDraft(draft)`, `clearDraft()` on the settings row `onboardingDraft` (this phone's own; never in a backup), parsed with `@logic/onboardingDraft`.
- `mobile/src/onboarding/OnboardingGate.tsx`, used by the root layout inside `AppGate`: no profile and no attempts → the flow in `new` mode; no profile but attempts → `returning`; a profile → the tabs.

Tests: the web's `completeOnboarding` cases; draft round trip and a broken draft read as none; the gate's three outcomes, and the swap to the tabs when a profile appears.

### Task 4: The signature pad

`mobile/src/components/ui/DrawCheckPad.tsx`: the web pad's size, statuses and lines ("Signed.", "Not quite a checkmark. Try again."), one stroke drawn as a polyline, judged by `isCheckmark` from `@logic/checkmark`. It takes the touch responder and refuses to hand it to the scroll view while drawing. The × clears a failed stroke. An accessibility action draws `TYPED_CHECK`.

Tests: a checkmark-shaped stroke reports `true` and shows "Signed."; a flat line reports `false` and shows the retry line; a new stroke reports `false` at once; the × clears; the accessibility action signs; `disabled` ignores touches.

### Task 5: The flow's pieces

`TextField` (17 points, the web's field look), `VariantPicker` (four cards from `VARIANTS`, chips from `variantHighlights`, the selected card's summary), `StartDateChoice` (Today / Tomorrow / Pick a date with the native date picker, `resolveStartChoice` for the date and its error), `BedtimeField` (native time picker, 18:00 to 23:59), `ProgressBar`, the top bar with Back.

Tests: each piece's behaviour as in the web tests that cover it (no preselection and the hint; the chips; the 60-day and past-date refusals; the bedtime bounds).

### Task 6: The flow

`mobile/src/onboarding/OnboardingFlow.tsx` and `steps/*.tsx`: welcome (with "Already have a backup? Restore it", reusing the import flow), name, challenge, why (ideas, counter from 100), bedtime (saved on each valid change), start (the 18:00 default, the late-start hint), and the deal (the card with its dates, rules, stakes and reason; the pad; "I commit"; the signed beat with the triumphant duck and the haptic; then `completeOnboarding`). Returning mode: welcome, name, why, "Welcome back". Step changes fade and slide; the deal's lines arrive one after the other.

Tests, ported from `src/screens/Onboarding/__tests__/OnboardingFlow.test.tsx`: the full new walk creates attempt #1 with the chosen challenge and date; returning mode; name validation; double tap; Back keeps answers; ideas and counter; date refusals; a stale date on the deal; a failed save; no preselection; draft resume; morning and evening defaults; plus the five Review Focus cases.

### Task 7: On the phone, then the review

- [ ] The owner walks through the flow in Expo Go and lands on Today. Check the duck's motion, the pad under the thumb, the pickers, dark and light.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first.

## Done when

- A fresh install shows the welcome screen, and signing the deal shows Today with "Day 1 of 75" (or the start day, when the attempt starts later).
- `npm run check` passes in `mobile/`, and PR 108's four checks pass.
