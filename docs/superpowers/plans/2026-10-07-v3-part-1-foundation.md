# v3 part 1: Ember foundation

Date: 2026-10-07 · Design: `../specs/2026-10-07-ember-look-design.md` · Branch: `feat/v3-foundation` → `v3`.

The skin under every screen, so parts 2–5 only touch layout: tokens, fonts, buttons, cards, nav.

## What changed

| File | Change |
|---|---|
| `package.json` | `@fontsource/dm-sans` and `@fontsource/barlow-condensed` replace Nunito and Lilita One. |
| `vite.config.ts` | Precache the new latin woff2 files. |
| `src/styles/index.css` | Ember tokens: warm near-black canvas and surface, cream ink, muted brand palette, muted world palettes (light and dark), DM Sans as `--font-rounded` (the token keeps its name), Barlow Condensed as `--font-display`, cards at 20 px. |
| `src/lib/worldColors.ts` | The same world palettes and the dark surface, for the contrast test and the theme-colour meta. |
| `index.html` | The no-flash script's canvases and the theme-color metas. |
| `src/components/ui/Button.tsx`, `HoldButton.tsx`, `Stepper.tsx`, `src/screens/Today/LateDay.tsx` | Flat pills: no "press down" edge, a slight scale on tap. |
| `src/components/ui/BottomNav.tsx` | Labels at semibold. The pill colours follow the tokens. |
| `.claude/launch.json` | `dev-v3` on port 5185, for previews from the v3 worktree. |

## Palettes

Generated and checked by a throwaway script (every ink ≥ 4.5:1 on surface, canvas and soft; on-world ≥ 4.5:1 on world; danger ink on canvas and soft). `worldColors.test.ts` and `brandColors.test.ts` keep the three copies in sync and re-check the ratios.

## Checks

`npx tsc -b`, `npm run lint`, `npm run test` (931 tests), `npm run build` (the service worker precaches the six latin font files). Screenshots on the dev server: Welcome, Today and Stats in dark; Stats in light.

## Left to the next parts

- Today's hero (the sunrise band, the tick arc, the duck) and the tile tones in `taskTones.ts`: part 2.
- The Workouts stack gradient (tokens muted here, layout untouched): part 3.
- The quote in Fraunces italic: part 2.
- Journey chrome, Gallery, Settings: part 5.
