# Welcome flow and profile (design)

Status: **built** (PR #7, merged into main on 2026-09-28). In v2, a phone browser first sees the install screen, and the welcome screen can restore a backup: see [backups and install](2026-10-05-backups-install-design.md).

The owner approved this design on 2026-09-28, with four decisions:
- one question per screen;
- on the owner's phone, whose attempt is already running, the flow asks only for the name and the reason;
- the name and the reason come back on Today, in the duck's lines and at hard moments;
- merge once the work is reviewed.

## 1. Goal

A clear welcome flow on first launch, like most mobile apps. The player:
- picks a username;
- picks the challenge and its start date;
- says why they're doing it.

One day, a paywall could slot in before the last screen. After the flow, the name and the reason stay with the player through the app.

## 2. Who sees it

The flow shows whenever there is no usable profile (§3). There are two modes.

**New** — there are no attempts at all: a fresh install, or the app after "Reset everything".
- Steps: welcome → name → challenge → why → start → ready.
- "Let's go" saves the profile and creates attempt #1 with the chosen challenge and start date, in one transaction.

**Returning** — attempts exist but there's no profile: the owner's phone right after this update, or a backup restored without a profile.
- Steps: welcome → name → why → ready.
- "Let's go" saves the profile only. No attempt is created, changed or backfilled.

Once the flow is done it never shows again, unless the profile goes away ("Reset everything", or importing a backup that has none).

`onboardingSteps(mode)` returns the step list. A paywall step would go right before `'ready'`, without touching the other steps.

## 3. Data

- **Where it lives:** in the settings table, under the key `SETTING_KEYS.profile` (`'profile'`), as `{ name, why, onboardedAt }`.
  - `name`: trimmed, with inner whitespace collapsed; 1–20 characters.
  - `why`: cleaned the same way; 1–140 characters.
  - `onboardedAt`: the ISO datetime the flow was finished.
- **Reading it:** `parseProfile(value)` returns the cleaned profile only when the stored value is usable. Anything else counts as no profile, so the flow shows (returning when attempts exist).
- **Schema and backups:**
  - No Dexie version bump.
  - Settings rows are exported and imported as they are: import checks only the keys, as it does today.
  - "Reset everything" clears the table, so the new flow shows again.
- **`profileRepo`:**
  - `get()` → `Profile | undefined`.
  - `save({ name, why })` (Settings → Profile):
    - it cleans and validates the input;
    - it keeps `onboardedAt`, and sets it to now if it's missing;
    - it returns `{ ok: true } | { ok: false; reason: 'invalid' }`, and writes nothing when the input is invalid.
  - `completeOnboarding({ name, why }, firstAttempt?)` runs in one read-write transaction over settings and challenges:
    - it validates as `save` does;
    - when `firstAttempt` (`{ startDate, variant }`) is given and there are no challenges at all, it adds attempt #1 through `buildNextChallenge`;
    - it never touches existing challenges;
    - it then writes the profile, with `onboardedAt` set to now.

## 4. The gate

- `App` calls `useApplyTheme` and `useToday`, then renders `OnboardingGate`. The gate loads `{ profile, hasAttempts }` in one live query:
  - while loading, it shows `LoadingScreen`;
  - with no profile, it shows `OnboardingFlow` (a lazy, precached chunk), in `'returning'` mode when attempts exist and `'new'` mode otherwise;
  - with a profile, it wraps the main app in `ProfileContext.Provider`.
- The main app is the current `App` body, moved into `MainApp`.
- `useChallengeGate`, and with it the automatic bootstrap of attempt #1, only mounts inside the main app, and the bootstrap itself does nothing without a usable profile (checked in the same transaction). So it never races the flow — not even right after "Reset everything", while the main app is still mounted for a moment.
- `useProfile()` reads the context and returns `Profile | undefined`. It returns undefined in a screen's own tests, which provide no context. Every consumer then falls back to today's text.

## 5. The flow (`src/screens/Onboarding/`)

### Layout

- **Page:** full screen, in a phone-width column (`max-w-md`), on the surface colour like the sheets, so the challenge cards and the start picker look the same as in a sheet.
- **Top bar:**
  - a Back button (`‹`, labelled "Back") from the second screen on;
  - a progress bar (`role="progressbar"`, value "Step {n} of {total}").
- **Each step:** the duck (size 96, with a mood per step), then a heading that takes focus as the step appears (`GateHeading`), then the step's content, then the primary button.
  - The button sits right under the content, not pinned to the bottom, so it stays above the iPhone keyboard.
- **Motion:** steps slide in (x ±24 px plus a fade, 0.2 s). With reduce motion on, `MotionConfig` keeps only the fade.
- **Keyboard:** in the text steps, Enter moves on when the step is valid (`enterKeyHint="next"`). In the why field, Enter never inserts a new line.
- **Back** keeps everything entered so far.

### Steps and copy (English UI)

| Step | Duck | Heading | Content | Button |
|---|---|---|---|---|
| welcome | content | 75 days. 5 tasks. One duck with a knife. | "Workouts, diet, water, reading and a progress photo, every single day. I'll be watching." | Get started |
| name | watching | What should the duck call you? | Text field labelled "Your name" (placeholder "Your name", `maxLength` 20, `autoComplete="given-name"`); helper "Up to 20 characters." | Continue, disabled until the name is valid |
| challenge | tapping | Pick your challenge | "You can switch until the end of Day 1."; the `VariantPicker`, with 75 Hard selected | Continue |
| why | judging | Why are you doing this? | "I'll remind you when it gets hard."; a text area labelled "Your why" (placeholder "Because…", `maxLength` 140); five idea chips (`aria-pressed` when the field holds that idea) | Continue, disabled until the reason is valid |
| start | waiting | When do you start? | "Day 1 is the first day you log."; `StartDateChoice` (Today / Tomorrow / Pick a date), with the sheet's errors "Pick a start date." and "The start can't be in the past." | Continue, disabled while there's a date error |
| ready (new) | triumphant | Deal, {name}. | "{75 Hard} starts {today \| tomorrow \| on {date}}."; the reason, quoted “…”; "I'm watching." in bold | Let's go ("Starting…" while saving) |
| ready (returning) | triumphant | Welcome back, {name}. | "Your challenge is right where you left it."; the reason, quoted; "I'm watching." in bold | Let's go |

The five idea chips fill the field with their text, which stays editable:
- "Prove I can finish what I start"
- "Get in the best shape of my life"
- "Build real discipline"
- "Clear my head"
- "A fresh start"

On the ready step:
- In new mode, a date error from the start step (for instance, the day turned while the flow was open) shows again and disables "Let's go".
- If saving fails or returns invalid, it shows "Couldn't save that — try again." and enables the button again.
- On success, the profile appears and the gate swaps to the app.

### The start picker

`StartDateChoice` is the picker from `NewChallengeSheet`, extracted:
- `src/hooks/useStartDateChoice.ts` holds the state and the validation;
- `src/components/StartDateChoice.tsx` holds the control.

`NewChallengeSheet` then uses both, and renders and behaves exactly as before.

## 6. The name and the reason in the app

- **Today** (the task screen and `PreStartView`):
  - "Hey {name}" becomes the header's first line;
  - the reason shows as one muted, italic, quoted line “…” under the header, cut after two lines.
- **The duck says the name in three lines:**
  - start of the day: "New day, {name}. I'm watching." (today's line is "New day. I'm watching.");
  - a missed day (`DayFailedScreen`): "Again, {name}. From Day 1. I'm watching.";
  - after giving up (`GaveUpScreen`): "Fine, {name}. Pick something. I'm still watching."
- **"You said: “{why}”"** appears, in muted italic:
  - at step 2 of the give-up flow, between the tally and the duck line;
  - on `DayFailedScreen`, under the explanation;
  - on `JokerUsedScreen`, under "Your streak starts over. Your challenge doesn't."
- **Without a profile**, all of these keep today's text.

## 7. Settings → Profile

- **Placement:** a "Profile" section at the top of Settings, above Challenge.
- **Fields:**
  - "Name": a text field with `maxLength` 20 and the helper "Up to 20 characters.";
  - "Why you're doing this": a two-row text area with `maxLength` 140.

  Both are prefilled from the profile.
- **Saving:**
  - "Save" is enabled only when something changed (compared after cleaning) and both fields are valid. It reads "Saving…" while it saves.
  - After saving, "Saved." shows (`role="status"`) until the next edit.
  - A failure shows "Couldn't save that — try again."
- **Without a profile** (for example in isolated tests), the section doesn't render.

## 8. Dev scenarios and README

- **Default profile:** `replaceDatabase` also writes a profile (`{ name: 'Sam', why: 'Prove I can finish what I start.' }`), so every existing scenario still opens on the app.
- **New scenarios:**
  - `seedFreshInstall()`: an empty database, which opens on the new flow.
  - `seedReturningWithoutProfile()`: 75 Hard on Day 4, with Days 1–3 done and no profile, which opens on the returning flow.
- **README:**
  - a **Welcome** feature bullet;
  - the Settings bullet names Profile;
  - the two scenario rows, and a line saying that the other scenarios write a default profile.

## 9. Tests

- **Logic:**
  - cleaning and validating the name and the reason;
  - `parseProfile`;
  - `onboardingSteps` for both modes;
  - `startsWhen`.
- **Repository:**
  - `completeOnboarding`:
    - new mode creates attempt #1 and the profile;
    - it never adds an attempt when one exists;
    - returning mode leaves every attempt untouched;
    - invalid input writes nothing.
  - `save`.
- **Golden test:** finishing the returning flow leaves the owner's pre-variants attempt untouched.
- **UI:**
  - `OnboardingGate`: new mode, returning mode, and the app with its profile;
  - `OnboardingFlow`:
    - the full new flow, and the returning flow;
    - validation, and Back keeping what was entered;
    - the chips;
    - the date errors;
    - the save error;
    - focus moving to each heading;
  - `useStartDateChoice`;
  - `NewChallengeSheet`'s existing tests, which must still pass unchanged;
  - with a profile:
    - the Today greeting and reason line (tasks and pre-start);
    - the duck's name line;
    - the three "You said" lines;
    - the named lines on the missed-day and "You gave up" screens;
  - Settings → Profile: prefilled fields, validation and saving.

## 10. Delivery

- **One PR,** on branch `feat/onboarding`, built by subagent tasks with a review each, then a final review and a fix wave.
- **Merge:** once the work is reviewed and green; the owner approved this.
