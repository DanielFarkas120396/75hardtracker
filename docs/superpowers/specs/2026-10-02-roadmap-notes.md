# Roadmap notes

Status: **updated 2026-10-05.** First written on 2026-10-02 from [FEEDBACK.md](../../../FEEDBACK.md), the README and the decisions so far (local-only: see [backend and sign-in notes](2026-10-02-backend-and-sign-in-notes.md); duck animations on hold: see [duck animation notes](2026-10-02-duck-animations-notes.md)).

The audience for now is **1–5 friends and family**. At that size, a server, accounts, push notifications and the paywall aren't worth it yet.

## Done

| Item | Where |
|---|---|
| Journey map: the climb from hell to heaven | main, PR #14 ([design](2026-10-02-journey-map-design.md)) |
| Design pass: "your world everywhere" (Today, Stats, Gallery, Settings) | v2, PRs #15–#19 ([design](2026-10-03-app-look-design.md)) |
| Time-travel dev mode | v2, PR #20 (Settings → Developer, in the dev server only) |
| HTTPS phone testing, for the in-app camera | v2, PR #21 (`npm run dev:phone`) |
| Late logging: yesterday open until noon | v2, PR #22 ([design](2026-10-05-late-logging-design.md)) |
| App lock: PIN and Face ID | v2, PRs #23–#24 ([design](2026-10-05-face-id-lock-design.md)) |
| Install first, restore on welcome, password-protected backups | v2, PR #25 ([design](2026-10-05-backups-install-design.md)) |

`main` is still v1 (tag `v1`). Merging `v2` into `main` is the owner's call.

## Next, in order

1. **Share v2 with friends and family** and collect their feedback. That needs v2 in `main` and Vercel turned back on (both the owner's call). Then test Face ID on an iPhone.
2. **Progress photo comparison:** Day 1 next to today with a slider, or a short time-lapse. Photos are the most motivating part of 75 Hard.
3. **Share card:** an image like "Day 32 / 75 🔥" with the duck, shared through the phone's share sheet (Web Share API). Made on the phone; nothing leaves it unless the user shares it.
4. **Day 75 recap:** a "Wrapped"-style summary: total workouts, litres of water, pages read, before/after photos.
5. **Duck animations**, once there are Higgsfield credits.
6. **Paywall**, only if the app grows beyond friends and family.

## Still open from the review

- **Security headers on Vercel** (Content-Security-Policy and similar): cheap, to do when Vercel is back.
- **Imported backups:** import already validates and cleans files (`src/db/exportImport.ts`, `src/db/normalize.ts`), and a protected file can't be altered without failing. A deliberately broken file hasn't been tried by hand.
- **Component tests** for the backup sheet and the restore buttons.

## Known limit: reminders

A real push notification on iPhone ("you haven't logged water") needs a server to send it; a web app can't schedule one on its own. With the local-only decision, the duck's in-app pressure is the reminder system. Don't promise notifications without revisiting the backend decision.

## Before charging money

The **paywall** slot in onboarding (`src/logic/onboarding.ts`). Checking payments needs a small server: the main trigger in the backend notes. Decide the model first: a one-time purchase or a subscription, and what stays free.
