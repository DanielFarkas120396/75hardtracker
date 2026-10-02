# Next steps — roadmap notes

Status: **proposal** (2026-10-02). Nothing started. Built from [FEEDBACK.md](../../../FEEDBACK.md), the README and the decisions so far (local-only: see [backend and sign-in notes](2026-10-02-backend-and-sign-in-notes.md); duck animations on hold: see [duck animation notes](2026-10-02-duck-animations-notes.md)).

## Suggested order

1. Design pass, starting with the Journey map
2. Progress photo comparison and the share card
3. Face ID lock and the backup warning
4. Time-travel dev mode
5. Paywall, then duck animations once there are Higgsfield credits

## 1. Design: the top open point

From FEEDBACK.md (2026-09-28): the look is "too basic, improve quickly".

- **One overall design pass:** a clear visual identity (colours, card style, typography, small illustrations) so the app feels finished, not like a template.
- **Journey map:** a nicer design with a proper background (FEEDBACK.md, 2026-09-28), e.g. a landscape the path winds through, with milestones along the way.
- Do this **before** the duck animations: they'll look better in a polished app, and the design choices will guide their style.

## 2. Features with the most value (no backend needed)

- **Progress photo comparison:** day 1 next to today with a slider, or a short time-lapse of all photos. Photos are the most motivating part of 75 Hard; today the Gallery is just a list.
- **Share card:** an image like "Day 32 / 75 🔥" with the duck, shared through the phone's share sheet (Web Share API). Made on the phone; nothing leaves it unless the user shares it. Free advertising for the app.
- **Day 75 recap:** a "Wrapped"-style summary: total workouts, litres of water, pages read, before/after photos.
- **Time-travel mode** (FEEDBACK.md, 2026-09-28): dev scenarios (`src/dev/scenarios.ts`) and `?now=` already exist for developers, but there's no in-app way to skip ahead a day. Add it to a hidden dev menu.

## 3. Reminders: a known limit

A real push notification on iPhone ("you haven't logged water") needs a server to send it; a web app can't schedule one on its own. With the local-only decision, the duck's in-app pressure is the reminder system for now. Don't promise notifications without revisiting the backend decision.

## 4. Security and privacy

Data never leaves the phone, so the risks are on the phone itself.

- **Optional Face ID lock** when opening the app (possible in a web app via WebAuthn). Body photos are private.
- **Backup file warning:** the exported backup contains every photo, unprotected. Add a clear warning, or an optional password that encrypts the file.
- **Imported backups:** make sure a damaged or tampered file can't break the app. Some cleaning already exists (`src/db/normalize.ts`, `src/db/exportImport.ts`); review it.
- **Security headers on Vercel:** standard browser protections (Content-Security-Policy and similar). Cheap and quick.

## 5. Before charging money

- The **paywall** slot in onboarding (`src/logic/onboarding.ts`). Checking payments needs a small server: this is the main trigger in the backend notes. Decide the model first: one-time purchase or subscription, and what stays free.

## Already done from FEEDBACK.md

- Change the challenge in Settings (Settings → Challenge).
- Choose a start date in onboarding, and change it until it has passed.
- In-app camera for progress photos (PR #9).
