# 75 Hard Companion: working rules

A local-first PWA for the 75 Hard challenge (React 19, Vite, TypeScript, Tailwind v4, Dexie, framer-motion, Vitest). The README describes the features and the project structure; the designs are in `docs/superpowers/specs/`.

## Branches

- `main` is **v1**, the app that works today. The tag `v1` marks it. Never merge into `main` unless the owner asks.
- `v2` is the long-lived redesign branch. Each feature gets its own branch from `v2` and a PR with `--base v2`.
- Vercel deployments are paused by the owner: there are no preview links. Don't wait for Vercel checks.

## Before every commit or merge

All four must pass:

```bash
npx tsc -b
npm run lint
npm run test
npm run build
```

Vitest fails a run on any unhandled error, even when every test passes.

## Target device

- An iPhone, as an installed Home Screen app in Safari. Touch only: nothing may depend on hover, and nothing may vibrate (Safari has no Vibration API).
- Text fields use at least a 16 px font, so iOS doesn't zoom in.
- Honour "reduce motion".
- Text meets WCAG contrast (4.5:1) in light and dark, in every world (there's a test).

## Data

- Everything lives on the device (IndexedDB through Dexie). No backend, no accounts: see `docs/superpowers/specs/2026-10-02-backend-and-sign-in-notes.md`.
- The owner has a live attempt on their phone. Avoid Dexie version bumps; add optional, unindexed fields instead. Old rows (no `variant`) must keep working.
- Persistence goes through `src/db/repositories/`. Challenge rules are pure functions in `src/logic/`.
- Device-only settings (`DEVICE_SETTING_KEYS`: the app lock) never go into backups.

## Trying it

| Command | What for |
|---|---|
| `npm run dev` | http://localhost:5173, on the computer |
| `npm run dev:phone` | https://<PC Wi-Fi IP>:5174 (self-signed), on the phone. HTTPS is needed for the in-app camera. Accept the certificate warning once. |

- `?db=<name>` opens a scratch database (dev only); `src/dev/scenarios.ts` seeds it.
- `?now=HH:mm` freezes the clock (dev only).
- Time travel: Settings → Developer → Time travel, or `/?db=time-travel&travel=<day>` (76 = victory; `&late=1&now=09:00` leaves yesterday unfinished).
- Face ID (WebAuthn) needs a real domain, never an IP address, so it can't be tried over the Wi-Fi link.

## Writing

- UI copy is English. The owner writes in French or English; answer short and simple.
- A feature starts with a short design agreed with the owner, saved in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Keep its status line current when things change.
- Update the README's features when a feature ships.

## Tests

- Database tests use `freshDatabase` and `addChallenge` from `src/db/__tests__/fixtures.ts`. Tests that store Blobs run under `// @vitest-environment node`.
- UI tests set `MotionGlobalConfig.skipAnimations = true`.
- jsdom has no `matchMedia`: stub it.
- Vitest empties CSS, even through `?raw`: tests that read `index.css` or `index.html` use `fs`, with `/// <reference types="node" />`.
