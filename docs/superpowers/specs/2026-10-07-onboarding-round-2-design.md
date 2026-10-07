# Onboarding, round 2 (design)

Status: **approved** by the owner on 2026-10-07. **Built** on `feat/onboarding-round-2-build` (PR pending the owner's phone check).

This follows the [round 2 notes](2026-10-07-onboarding-round-2-notes.md) and a second critique run on the same day. Both scored the onboarding 26/40.

The owner's choices:
- the deal screen first;
- after 18:00 the start defaults to Tomorrow;
- no challenge is preselected;
- everything is in scope, the small points included.

The steps, the data and `profileRepo.completeOnboarding` stay the same. There is no Dexie change, and old drafts still load.

## 1. The deal

- **"Hold to commit" and its hint sit in a sticky footer,** like Continue on the challenge step. They stay in reach whatever the length of the reason.
- **Less text:**
  - the subtitle "75 Hard starts today." goes, since it repeated the card and used a second date format;
  - a reason over 60 characters is set one size smaller;
  - "Day 1" never breaks across lines.
- **Hint:** "Hold for 1 second to sign. I'm watching."
- **The duck judges until you sign.** Once the hold completes:
  - the duck turns triumphant and says "I'm watching, {name}." (announced to VoiceOver);
  - after 1.2 s the profile is saved and the app takes over;
  - with reduce motion on, it is the same pause with nothing moving;
  - if the save fails, the flow goes back to the deal with "Couldn't save that — try again."
- **Returning players** see "Saving…" while their answers are written.

## 2. The hold button

- **Letting go early** shows "Keep holding." (announced politely).
- **A finger that drifts** off the button no longer cancels the hold.
- **A click that no press started** commits at once: a keyboard, Switch Control or VoiceOver. This no longer depends on the click's `detail`, because iOS VoiceOver may report 1.

## 3. A draft that no longer fits

- **The flow reopens on the first step whose answer is missing or invalid,** never later than the saved step. That covers an empty name or reason, no challenge, or a start date now in the past.
- **On the deal,** a date problem comes with a "Change start date" button.

## 4. Starting at night

- **After 18:00, a new start defaults to Tomorrow:**
  - in the welcome flow, unless a draft says otherwise;
  - in "Start a new challenge".
- **Today stays one tap away.** When it is picked in the evening, the hint becomes a warning:
  - an icon, in the danger colour, inside a tinted box;
  - announced politely and linked to the choice.
- **The finish line shows both ends:** "Day 1: Thu 8 Oct · Day 75: Sun 21 Dec."
- **Layout:** the date field is centred.
- **A long wait:** a start more than 14 days away reads "Starts in 30 days. That's a long wait."

## 5. Picking the challenge

- **Nothing is preselected.** Continue waits for a tap: "Pick a challenge to continue."
- **The same three chips on every card:** workouts / the weekly allowance ("No days off", "Social night weekly", "Social + recovery weekly") / the jokers.
- **The full rule line shows on the selected card only.** For challenges with jokers, it starts with "A joker forgives one missed day."
- **Intro:** "Tap one. You can switch until the end of Day 1."
- **A card restored from a draft** scrolls into view.
- **Medium's tagline** is "One workout, healthy eating."

## 6. Why

- **When the field is empty:** "Write a reason or tap an idea to continue."
- **The ideas** are plain buttons that fill the field, not toggles.
- **The duck** watches instead of judging.

## 7. Small points

- **The name field** is labelled by the question.
- **The progress bar** is called "Setup progress".
- **Dark mode:** the onboarding and install pages use the warm canvas colour, not the cool surface.
- **Loading:** a still duck replaces the plain "Loading…" text.
- **Install first:**
  - it leads with "Set it up in the app, not in Safari. They don't share data.";
  - iOS gets an "I've added it" button that says to open the app from the Home Screen;
  - the skip reads "Continue in Safari (your data stays here)";
  - "Home Screen" is capitalised everywhere.

## Tests

- **`resumeStep`:** each invalid answer and a valid draft.
- **The draft:** a draft without a challenge round-trips, and an old draft still loads.
- **The start choice:** its default, and the draft beating it.
- **The hold:** early release, a click without a press, and a tap's own click not committing twice.
- **The flow:**
  - Continue waits for a challenge;
  - the signed pause and then the save;
  - a failed save going back;
  - a stale draft;
  - "Change start date";
  - Tomorrow by default at 21:10.
- **The chips:** the same three axes on every card.
- **Contrast:** the contrast test still passes.
