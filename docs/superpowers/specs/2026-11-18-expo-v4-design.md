# v4: native iPhone app (Expo) with cloud backup

Date: 2026-11-18 · Status: **agreed** with the owner on 2026-11-18. Not built yet.

## Why

The owner wants the app on the App Store for the public launch. The web app installs through Safari's "Add to Home Screen", which strangers find confusing, and it can't be found in the store. The owner also wants a backend, so a lost or replaced phone no longer loses an attempt.

This reverses the local-only decision of 2026-10-02 (`2026-10-02-backend-and-sign-in-notes.md`) in the lightest way that doc allowed: an optional, encrypted cloud backup.

## Decided by the owner

| Topic | Decision |
|---|---|
| Technology | Expo (React Native). Not Capacitor, not a web view around the site. |
| Store | The App Store, iPhone first. |
| Scope | Everything: every feature of the web app, rebuilt with native screens, plus cloud backup. |
| Timing | No deadline. The release date doesn't drive the plan. |
| Backend | Supabase, light: sign-in and an encrypted cloud backup. No live sync. |
| Privacy | The server never holds readable data or photos. Everything is encrypted on the phone first. |
| Backup key | Kept in iCloud Keychain, so a new iPhone on the same Apple ID restores with nothing to type. |
| Apple Developer account | Individual, in the owner's name. It stays the publishing account: the backup keys and Apple sign-ins are tied to it. |
| Testing the restore | The owner provides a second Apple device on the same Apple ID. |

## Calls made by Claude (correct any of them)

| Topic | Call | Reason |
|---|---|---|
| Sign-in | Optional. Only needed to turn on cloud backup. Sign in with Apple only. | Onboarding stays as it is. Apple requires its own sign-in as soon as there is any other. |
| Offline | The app works fully without the internet. All data stays on the phone. | Same promise as today. |
| Recovery key | Settings shows the backup key ("Show recovery key", behind Face ID) so it can be saved elsewhere. | If iCloud Keychain is switched off, the key doesn't travel to a new phone. |
| Moving from the web app | The new app imports a web app backup file, plain or password-protected, on the welcome screen and in Settings. | The owner's live attempt and every web user move over this way. |
| Look | The Ember look as is: both themes, six worlds, the same fonts, the harsh duck. | v4 changes the technology, not the design. |
| App lock | Kept: the PIN, with Face ID through the phone's own prompt. | "Everything" includes it. Native Face ID needs no real domain, unlike the web version. |
| Install screens | Dropped ("Add to Home Screen", in-app browser warnings). | The App Store installs the app. |
| Haptics | Light taps when a task completes and when the deal is signed. | The web rule "nothing vibrates" existed only because Safari can't. |
| Two backups meet | The app never overwrites a cloud backup silently. It asks: "Restore the cloud backup (Day 34, saved 12 Nov) or replace it with this phone (Day 2)?" | The one way an attempt could be lost. |
| Where it lives | Same repo, long-lived `v4` branch, the Expo app in `mobile/`. | The "big redesign" rule in `CLAUDE.md`. `main` keeps working. |
| Rules | `mobile/` imports `src/logic/` directly. No copy. | One set of challenge rules, one set of tests. |
| Bundle ID | Neutral: it doesn't contain the app's name. | It's fixed at the first build, before the name is. |
| Rename | "75 Hard" leaves `src/logic/` and `src/content/` on `main` before a test build goes to anyone but the owner. | `mobile/` imports that copy directly. |
| Web app | Stays local-only, with no sign-in. Its own launch isn't planned here. | Not asked for. |

## Scope

Everything the web app does today (see the README's features), on native screens:

- Welcome, onboarding, the rules card, the drawn-checkmark deal, the four challenges (Hard, Strong, Medium, Soft).
- Today: the gauge hero, the duck, the five tiles with their fills, the camera sheet (65% high, never full-screen), reading with the current book, workouts, water, diet, notes at 5/5, the weigh-in, the day-complete peak.
- "Plan my evening": the plan sheet, the duck's menace and the bedtime clock.
- Everything the rules need: social nights, Soft's recovery day, the joker screen, switching challenge on Day 1.
- Late logging, a failed day and the restart flow, give up, Victory.
- Journey: the logbook in world chapters, with day cards.
- Gallery, with Compare and the time-lapse.
- Stats: workouts, water and books, weight.
- Badges and the toast stack.
- Share card (when it exists on `main`; if not, it's designed for v4 directly).
- App lock.
- Settings: every section of today's, minus Install.

New in v4:

- Sign in with Apple, cloud backup, restore, delete account.
- Import a web app backup.
- Haptics.

## Build order

Each step ends in something that runs on the phone. The plan details them.

1. Foundation: the Expo project, the Swift keychain module proven on two devices, SQLite and the repositories, the shared rules, themes and fonts, EAS builds. **Built** (2026-11-18), except the keychain's build and two-device check.
2. Import a web app backup. **Coded** (2026-11-18). The owner set its phone test aside: they want to use the app from Day 1 first.
3. Onboarding and the deal, up to Day 1 (moved ahead of Today on 2026-11-18, at the owner's request: "I want the app to work from day 1 with the onboarding"). **Coded and reviewed** (2026-11-18); the owner's walk-through on the phone is pending.
4. Today, in three parts:
   - 4a. A whole day can be logged: the hero, the five tiles with their sheets, the camera sheet, the weigh-in, the countdown before Day 1. **Coded** (2026-11-18), with the web's thin bar on the tiles in place of the fills.
   - 4b. The evening and yesterday: "Plan my evening", the menace's atmosphere, the duck's bubble and pokes, social nights, the late-day card, sounds. **Coded** (2026-11-18); the knife's sound is a rendered file nobody has heard yet.
   - 4c. The show: the five fills, the tile shrinking into its chip, the gauge's wave, the day-complete peak. **Coded and reviewed** (2026-11-18), in three plans (4c-1 the fills, 4c-2 the board and the gauge, 4c-3 the peak). The book and the iris are drawn by a shader each: pictures beside the web's in `2026-11-18-v4-fills-preview/`. Nothing of it has been judged on the phone yet.
   - 4d. Failure and restart, the joker screen, give up, Victory. **Coded and reviewed** (2026-11-18). "Give up this challenge" sits on the placeholder Settings tab until part 8; developer buttons there open each ending. The owner's walk-through on the phone is pending.
5. Journey. **Coded and reviewed** (2026-11-19): the logbook in world chapters, the day card, the altitude rail, one gate for the app; plan `docs/superpowers/plans/2026-11-18-v4-part-5-journey.md`. Nothing of it has been seen on the phone yet.
6. Gallery and Compare. **Coded and reviewed** (2026-11-19): the grid, the lightbox, Compare's slider and time-lapse, "Take today's photo" opening Today's camera; plan `docs/superpowers/plans/2026-11-19-v4-part-6-gallery.md`. Not seen on the phone yet.
7. Stats. **Coded and reviewed** (2026-11-19): weight with its chart and weigh-ins, the training totals, the bottle and the shelf, the workout cards; plan `docs/superpowers/plans/2026-11-19-v4-part-7-stats.md`. Not seen on the phone yet.
8. Settings, badges, toasts, app lock. **Coded and reviewed** (2026-11-19): the grouped Settings list and its pages, badges with one toast stack, the PIN lock with Face ID (expo-local-authentication), offered once after the deal; plan `docs/superpowers/plans/2026-11-19-v4-part-8-settings.md`. Face ID needs the development build (not in Expo Go). Not seen on the phone yet.
9. Share card.

Cloud and the App Store always come last: any step added later goes before them (owner, 2026-11-20).

10. Cloud: sign-in, backup, restore, delete account.
11. App Store: listing, privacy labels, review.

## Not in scope

- Live sync, or two phones used at the same time on one account. The last backup wins, after the app asked.
- Daily reminders. A good first addition after release (local notifications, no server needed).
- Paywall (RevenueCat, see the 2026-10-02 notes).
- Android. The backup key there needs its own store, or the existing password method.
- Retiring the web app. Decide after v4 is in the store.
- Social features, analytics, crash reports.

## What would make this a failure

- Readable photos or data on the server.
- The app needing an account or a connection to be used.
- The owner's live attempt lost in the move.
- `main` or the web app broken by v4 work.
- A restore that silently ends an attempt (the `restoredDays` question from PR #91 must carry over).

## Cloud backup

**Server (Supabase, EU region).**

- Auth: Sign in with Apple. No other provider, no email and password.
- Storage: one private bucket. Each user can read and write only their own folder (`<user id>/`). No database tables of our own.
- Per user: `data.enc` (everything except photos, overwritten at each backup, with the previous copy kept as `data.prev.enc`) and `photos/<photo id>.enc` (one object per progress photo or book cover, uploaded once, since photos never change).
- Delete account: a server function removes the user's folder and the auth user, and revokes the Apple sign-in, which Apple requires. The app's local data stays unless the user also erases it.

**Why not one big file.** The existing backup file holds every photo as base64 in one JSON: 30 to 50 MB by Day 75. Uploading that every day is slow and wasteful, and it doesn't fit comfortably in a phone's memory. Splitting it means a normal day uploads a few kilobytes plus one photo.

**Encryption.**

- A random 256-bit key, made on the phone the first time backup is turned on.
- AES-256-GCM, as in `src/lib/backupCrypto.ts`, without the password step.
- The key is stored in the keychain with iCloud sync on. Expo's secure storage can't do this, so it needs a small Swift module (Expo Modules API).
- A wrong or missing key shows as a failed decryption. The app then asks for the recovery key.

**When it runs.** After a change, when the app goes to the background or comes back, on any connection. It never blocks the app and never shows an error in the way. Settings shows "Last backup: today 21:04" or what went wrong.

**When two backups meet.** Each backup records which phone made it and the attempt's day. If backup is turned on while the account already holds a backup, or the cloud's last backup came from another phone, automatic backup pauses and the app asks which one to keep (see the calls above). `data.prev.enc` is a silent fallback, used only when `data.enc` can't be read.

**Restore.** On the welcome screen: "I already have an account" → Sign in with Apple → the key is found (or the recovery key is asked for) → download → restore, with the same gap question as today.

**Cost.** One attempt is about 30 to 50 MB. The free tier (1 GB) holds about 25 users and pauses after a week without activity. Use it while building and move to Pro (about $25 a month, 100 GB) before the store release.

## How it's built

- **Expo**: the current stable SDK (56 when this was written), TypeScript, the New Architecture. A development build is needed from the start, because of the Swift module: Expo Go isn't enough.
- **Builds**: EAS Build in the cloud (the owner works on Windows), TestFlight for the phone.
- **Data**: SQLite on the phone, with the same tables and fields as the Dexie schema (`src/db/types.ts`). Photos and covers are files in the app's documents folder, not rows. Repositories keep the names and shapes of `src/db/repositories/`, so the hooks port over with little change.
- **Rules**: `src/logic/` is used as is. Two links to web code get cut first, in a small PR on `main`: `climb.ts` imports `screens/Journey/worlds`, and several files import `lib/dates`. Both move under `src/logic/` (or a shared folder).
- **Web backup import**: `ExportPayload` version 1 (`src/db/exportImport.ts`) and the encrypted wrapper (`src/lib/backupCrypto.ts`) are the contract. The normalising and gap rules (`src/db/normalize.ts`, `findBackupGap`) are reused.
- **Drawing and motion**: the tile fills (three.js painters in `src/screens/Today/fills/`), the gauge, the embers, the charts and the drawn checkmark are redrawn for native. The duck is SVG art with a rig (`src/components/mascot/`), so it ports closely. "Reduce motion" is honoured.
- **Sound**: today's sounds are synthesised with WebAudio. Native needs either an audio library that can synthesise, or the same sounds rendered to files.
- **Themes**: the colour tokens in `src/index.css` become one theme file. The contrast test (4.5:1 in every world, light and dark) is ported.
- **App lock**: the PIN logic (`src/lib/pin.ts`) carries over. Face ID uses the phone's local authentication, not WebAuthn.
- **Dev tools**: the scenarios (`src/dev/scenarios.ts`) and time travel are ported to a dev-only menu.

## Left to the builder

- Navigation library and screen structure, the SQL layer (plain SQL or an ORM), live-query approach.
- Animation, drawing and chart libraries (Reanimated and Skia are the expected choice).
- How `mobile/` resolves `src/logic/` (Metro watch folders or a workspace package).
- Test setup for `mobile/` and its "before every commit" checks. The logic tests keep running in Vitest.
- Backup scheduling details, retry, and how the sign-in session is stored.

## Risks

- **App Store review**: in-app account deletion, privacy labels, a health note, and no "75 Hard" in the name or copy (trademark, see the public-launch notes).
- **Fills**: the three.js painters are the hardest port. If one can't match on native, show the owner a preview before settling.
- **Expo SDK 56** lists a memory regression with Reanimated on Hermes V1. Check the state of it before choosing versions.
- **iCloud Keychain off**: covered by the recovery key, but only if the user saved it. Say so plainly when backup is turned on.
- **Two code bases for a while**: features added to the web app on `main` during the build must be added to `mobile/` too. Keep web changes small until v4 ships.

## Needed from the owner

1. An individual Apple Developer account ($99 a year). Needed for the first build on a phone, not only for the store.
2. The new app name, before the store listing.
3. A Supabase project in the EU region (needed at step 9).
4. A privacy policy and terms page (already on the public-launch list).
5. A second Apple device on the same Apple ID, to prove that a new phone restores with nothing to type.

## Sources

- [SecureStore iCloud Keychain does not sync (Expo forums)](https://forums.expo.dev/t/securestore-icloud-keychain-does-not-sync/44884)
- [Apple Platform Security: keychain syncing](https://support.apple.com/guide/security/sec0a319b35f/web)
- [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56)
