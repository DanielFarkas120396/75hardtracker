# v3 part 4: Welcome and onboarding

Date: 2026-10-07 · Design: `../specs/2026-10-07-ember-look-design.md` · Branch: `feat/v3-welcome` → `v3`.

The first screens in the Ember look. Most of it came free with the tokens; this part adds what the mockup showed.

## What changed

| File | Change |
|---|---|
| `src/screens/Onboarding/OnboardingFlow.tsx` | The duck sits on the sunrise glow (the world's colour) on every step. The wrapper is `isolate`, so the glow's negative z-index stays above the canvas. |
| `src/screens/Onboarding/OnboardingSteps.tsx`, `src/screens/RestartFlow/GateHeading.tsx` | The welcome headline in the large uppercase condensed size (`GateHeading size="lg"`). |
| `src/components/mascot/duckArt.tsx`, `src/styles/index.css`, `src/screens/Today/DuckHeader.tsx` | The duck is warmed through one `.duck` rule on its art, everywhere, instead of a filter on Today's button. |
| `src/screens/Today/TodayHero.tsx` | `isolate` on the hero, for the same stacking reason. |
| every screen | `font-extrabold` becomes `font-bold`: DM Sans loads 400 to 700, so 800 rendered as 700 already. |

## Checks

The four commands. Screenshots on the dev server: Welcome in dark (Hell, the amber glow) and in light.

## Left to part 5

Journey chrome, Gallery, Settings, Lock, Victory and the restart flow: a pass over the remaining screens for leftover candy tints and weights.
