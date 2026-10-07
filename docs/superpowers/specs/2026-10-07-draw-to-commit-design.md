# Draw to commit (design)

Status: **merged** into main on 2026-10-07 (PR #51), after the owner tried it on their phone. From that check: iOS Safari scrolled the page under the finger (touch-action on an SVG is not reliably honoured), so the pad's HTML frame holds the page still; and the recogniser accepts a fast thumb with a tiny first arm. The duck's animation around the signature is still to be designed.

This replaces the held button from [onboarding round 2](2026-10-07-onboarding-round-2-design.md) §2. Everything else on the deal stays: the card appears line by line, the signature comes after the whole card and fades in when you scroll down to it, the duck has its 1.2 s moment with "I'm watching, {name}." before the app takes over.

## The pad

- Under the deal card: the line **"Sign the deal: draw a checkmark."**, a white pad (192 px tall, the card's corners), then the main button **"I commit"**.
- You draw **one stroke** with your finger. The pad never scrolls the page while you draw (`touch-action: none`, pointer capture).
- When the finger lifts, the stroke is checked: a short arm down and to the right, a turn at the lowest point in the first 10–60 % of the stroke, then a longer arm up and to the right that ends higher than the start. At least 8 samples, 40 × 25 px. Loose on purpose: a thumb isn't a pen.
- **A checkmark** enables "I commit"; the line under the pad says "Signed." (announced politely).
- **Anything else** stays on the pad and the line says "Not quite a checkmark. Try again." The next stroke replaces it. An **×** in the pad's corner clears it.
- **"I commit"** spends the signature and signs the deal, as the hold did. If the save fails, the deal comes back with the pad blank: draw again.
- **Keyboard and VoiceOver:** the pad is a focusable button named by the line above it. Enter or Space draws the checkmark for you, so nobody is locked out.
- **Reduce motion:** nothing moves apart from the stroke following the finger.
- **No vibration**, as always.

## Code

- `src/lib/checkmark.ts`: `isCheckmark(points)`, pure, with unit tests.
- `src/components/ui/DrawCheckPad.tsx`: the pad, with tests for a drawn check, a refused line, ×, Enter, and disabled.
- `src/screens/Onboarding/OnboardingSteps.tsx` (`ReadyStep`): the pad and "I commit" where `HoldButton` was. `HoldButton` is deleted (nothing else used it).

## Open

- The duck's reaction while you draw and when the check lands.
- Whether a check drawn in one go should sign on its own, without the button. For now the button stays, so a scribble can't sign by accident.
