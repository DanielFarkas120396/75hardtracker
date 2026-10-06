# Onboarding redesign (design)

Status: **approved** by the owner on 2026-10-06 (hold to commit; all four challenges stay visible). **Built** (PR #39, merged into main on 2026-10-06; the owner tried it on their phone first). While building: the idea dropped from the why step is "Get in the best shape of my life" (the longest), and the duck is smaller (64) on the challenge step and the deal, so their buttons stay in reach.

This is a follow-up to the [welcome flow](2026-09-28-welcome-flow-design.md). It comes from the Impeccable critique of 2026-10-06, which scored 26/40. The steps, the data and `profileRepo.completeOnboarding` stay the same. The owner chose: a stricter, higher-stakes tone; the commitment moment first; every finding in scope.

## 1. The deal (ready step, new mode)

The last screen becomes a contract you sign, not just another step.

- **Heading:** "Deal, {name}."
- **A contract card** (world-soft fill, world edge):
  - the variant's name, at display size;
  - the rules, one short line each: workouts, diet, water, reading, photo (from `content/variants.ts`);
  - the stakes, in the world's ink colour: "Miss a day: back to Day 1." For variants with jokers: "{n} joker(s): a missed day that's forgiven. Then back to Day 1.";
  - the dates: "Day 1 Tue 6 Oct → Day 75 Sat 19 Dec", plus "Starts in 3 days" when the start is later than tomorrow;
  - "Your reason", as a label, with the reason under it at display size.
- **"Hold to commit":** a held button. A fill runs across it for 1 second; letting go early cancels it. Activation from a keyboard or VoiceOver (a click with no press) commits at once. With reduce motion on, the fill is still shown, but as steps, with no easing. There is no vibration.
- **After the commit:** the duck turns triumphant, the line "I'm watching." appears, and then the app takes over, as it does today.
- **Returning mode** keeps a simple "Welcome back" screen: the reason card and a plain "Let's go".

## 2. Start date

- **Copy:** "Day 1 is the date you pick. Every task is due by midnight."
- **Live finish line** under the choice: "Day 75 is Sat 19 Dec."
- **Late-evening hint:** after 18:00, with "Today" chosen: "It's {HH:mm}. Today means {two workouts / a workout} before midnight. Tomorrow might be smarter." It's a hint, not a block.
- **"Pick a date" starts on tomorrow.** The latest allowed date is today + 60, with the error "Start within the next 60 days."
- **The error is linked to the date field** (`aria-invalid`, `aria-describedby`).
- `useStartDateChoice` and `StartDateChoice` are shared with Settings and the new-challenge sheet, so they get the same rules.

## 3. Keeping progress

The draft (step, name, variant, reason, start choice and picked date) is saved to `localStorage` on each change, under a key per database name. Reads and writes are wrapped in try/catch. The draft is cleared when the flow finishes. If iOS closes the app, you come back on the same step. No Dexie change.

## 4. Challenge picker

- **Each card:** the name, one line of identity, and 2–3 small chips for what sets it apart. The full rule line stays, smaller, under them.
  - 75 Hard: "The original. No mercy."
  - 75 Strong: "Hard, with one social night a week."
  - 75 Medium: "One workout, healthy eating."
  - 75 Soft: "A gentler start, with a recovery day."
- All four challenges stay visible, side by side (the owner's choice).
- **The "Continue" button stays visible:** it goes in a sticky footer on this step.

## 5. Why

- 4 chips ("Get in the best shape of my life" goes).
- The chips show only while the field is empty or holds one of them, so a tap never wipes your own words.
- A counter ("120/140") shows from 100 characters.

## 6. Look and accessibility

- **Text fields and canvas tiles** get a 1 px border (`ink/15`), so they read as fields.
- **Disabled buttons** get a proper style (a muted fill, muted text) instead of 50% opacity. This is in `Button`, so it applies app-wide.
- **The progress bar** uses the world colour, like the main button. It starts empty on Welcome and is full on the deal. It animates with `scaleX` instead of width.
- **Full-width surface:** the onboarding and install pages use the surface colour across the whole width, so dark mode has no cool column on a warm canvas.
- **Back** becomes the `chevron` icon.
- The install screen's heading matches the steps (`text-2xl`).
- **Name step:** the field is labelled by the question. The hint reads "Type a name to continue. Up to 20 characters."
- The step order stays: welcome → name → challenge → why → start → deal.

## 7. Tests

Unit tests:
- the draft round-trips and is cleared;
- the date limits;
- the late-evening hint (`?now`-style clock injection);
- chips never overwrite custom text;
- the hold commits only after 1 s, and a keyboard click commits;
- the contract card shows the rules and dates for each variant.

The existing flow tests are updated, and the contrast test still passes.
