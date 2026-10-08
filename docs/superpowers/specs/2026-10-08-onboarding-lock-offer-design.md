# Lock offer in onboarding (design)

Date: 2026-10-08 · Status: **approved** by the owner on 2026-10-08. Being built.

## Why

The [app lock](2026-10-05-face-id-lock-design.md) works (tested on the iPhone on 2026-10-08), but it sits in Settings → Privacy & data, where nobody looks. The owner's call: offer it once, in onboarding, as an optional screen. Only there: no nudge later, nothing for players who already finished onboarding.

## Where it goes

After the deal, not inside it. The flow builds up to signing and "I'm watching, {name}.", and a privacy question there would break that moment.

1. You sign the deal. The duck says "I'm watching, {name}." for 1.2 s, as now.
2. The profile and attempt #1 are saved, as now. The signature is never held back by the new screen.
3. **New:** the lock offer appears instead of the app.
4. "Set a PIN" or "Not now" opens the app.

The returning flow (name and reason only) ends the same way.

## The screen

- No progress bar and no Back: the deal is signed, there's nothing to go back to.
- The duck, calm (`content`).
- Title: **"Keep it private?"**
- Text: "Your photos, weight and notes stay on this phone. A PIN keeps them hidden from anyone holding it."
- **"Set a PIN"** (primary button).
- **"Not now"** (plain text button, still a full touch target).
- Small print: "You can turn it on later in Settings → Privacy & data."

**"Set a PIN"** shows the PIN pad on the same screen: the existing `NewPinFlow` (type it, type it again, too-easy PINs refused). A "Cancel" under the pad goes back to the question. Once the PIN is saved:

- If the phone can use Face ID (`isAppLockAvailable()`), a second question: **"Also unlock with Face ID?"**, with **"Turn on Face ID"** and **"Not now"**.
  - Face ID confirms: saved, the app opens.
  - Face ID cancelled or failed: "Face ID didn't confirm. Try again, or skip it for now." The two buttons stay.
- Otherwise (no Face ID, or the Wi-Fi test link): the app opens.

The app opens **unlocked**: the lock only asks next time the app opens, or after more than a minute away. `useAppLock` already does this for a lock turned on mid-session.

If saving the PIN fails: the usual save line (`SAVE_FAILED_LINE`), and the pad starts over.

## How it's wired

- `OnboardingGate` remembers, for this session, that it showed the welcome flow. When the profile then appears, it shows the lock offer before the app, unless the lock is already on.
- The offer is a new screen in `src/screens/Onboarding/`, built from the parts Settings uses: `NewPinFlow`, `appLockRepo.enable`, `appLockRepo.setFaceId`, `createLockCredential`.
- No change to `onboardingSteps`, the draft, or `profileRepo.completeOnboarding`.
- No Dexie change, no new setting. The lock stays device-only and out of backups, as now.

Side effects, on purpose:
- **iOS closes the app on the offer:** it reopens on the app, without the offer (the session memory is gone). That's fine: it's optional, and Settings still has it.
- **Restoring a backup from the welcome screen** also leads to the offer, since the profile appears during the flow. That's useful: the lock never travels in a backup, so a new phone starts without one.

## Tests

- After signing, the offer shows instead of the app; "Not now" opens the app, with the lock off.
- "Set a PIN", typed twice: the lock is on, and the app opens unlocked.
- With Face ID available (stubbed), the second question shows; confirming saves the credential; a failure shows the line and keeps the buttons.
- Without Face ID, no second question.
- A player who already has a profile never sees the offer.
- Existing onboarding tests that expect the app right after signing tap "Not now" first.

## Out of scope

- Any reminder or nudge after onboarding (the owner: "only in onboarding").
- Changes to the lock itself, or to Settings.
