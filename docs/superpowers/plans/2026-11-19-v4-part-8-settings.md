# v4 Part 8: Settings, badges, toasts, app lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Settings tab on the phone is the web's: a grouped list like iPhone Settings ("You": Profile, Badges; "Challenge": Challenge, Rules, Books, Attempt history; "App": Appearance, Sound, Companion; "Privacy & data": App lock, Backup & storage; "Developer" in dev builds; "Danger zone": Give up this challenge, Reset everything), each row opening its page with a back button. Badges unlock as on the web and show in ONE toast stack at the top, with "Couldn't save that" in front. The app lock (a 6-digit PIN, Face ID as the shortcut) closes the app at launch and after more than a minute away, covers it in the app switcher, and is offered once after the deal.

**Architecture:** Every rule is already shared except the PIN's: `@logic/badges`, `@logic/attempts`, `@logic/books`, `@logic/profile`, `@logic/startDate`, `@logic/menace`, `@logic/theme`, `@logic/variantsCopy`, `@logic/microcopy`. PR 108 gets one more pure move: `src/logic/appLock.ts` (PIN length, too-simple PINs, the waits after wrong PINs, `shouldRelock`, `formatCountdown`, the stored shapes); the web's `lib/pin.ts`, `lib/appLock.ts` and `useCountdown` re-export it. On the phone the PIN is hashed with `@noble/hashes` (PBKDF2-SHA-256, as the web, with an iteration count sized for Hermes and stored with each PIN). Face ID is `expo-local-authentication` (`authenticateAsync`), with nothing stored: the phone's answer is the whole check, as the web's passkey was. The toasts are one small store (badges queued by the tabs' layout, save failures counted by `transaction()`), drawn by `ToastStack` at the root. The lock screen and the cover are plain views over the root, and every `Modal` (Sheet, the gallery's Overlay, the day card, the import) hides while the app is locked, so nothing native sits above the lock.

**Tech Stack:** as part 7, plus `expo-local-authentication` (installed with `npx expo install`, config plugin `faceIDPermission`).

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` (build step 8). Web code: `src/screens/Settings/`, `src/screens/Lock/LockScreen.tsx`, `src/screens/Onboarding/LockOffer.tsx`, `src/components/{PinPad,NewPinFlow,ToastStack,LockBypassBanner}.tsx`, `src/hooks/{useAppLock,useLockSetup,useBadgeUnlocks,useBadges,useSaveFailure,useAttemptSummaries}.ts`, `src/db/badgeEvaluation.ts`, `src/db/repositories/{appLockRepo,badgeRepo}.ts`, the `changeStartDate` / `changeVariant` of `challengeRepo` and `bookRepo.remove`.

## What differs from the web, on purpose (said plainly to the owner)

- **No "Install the app" row**: the App Store installs it (the spec drops it).
- **Backup & storage holds "Import a web app backup" only.** Saving a backup comes with the cloud backup (part 9); a file export would be replaced by it.
- **Face ID asks the phone, with no passkey.** `expo-local-authentication` gives a yes or no; nothing to store. It can't be tried in Expo Go (the docs: "not supported in Expo Go"): it needs the development build, which waits on the Apple Developer account. In Expo Go the switch shows only if the phone reports Face ID, and the prompt may fall back to the passcode.
- **Every confirmation is a sheet** (the web's centred dialogs: "Erase everything?", "Delete this book?", "Switch to Strong?", "Move the start date?", "Turn the lock off?"), one Modal at a time: a form and its "Delete?" swap inside the same sheet.
- **An attempt's days and photos open as a page in Settings** (the web opens a dialog), so its photo can open the lightbox without a second Modal.
- **Toasts sit under an open sheet** (an RN view can't sit above a native Modal); badges wait while the day-complete peak or an ending screen is up, as on the web.
- **The app-switcher cover is a view over the app**: a sheet left open while the app goes away is hidden only once the app locks.

## Global Constraints

- Parts 1 to 7's constraints hold (`v4` worktree, `npm run check` before every commit chained with `&&`, `@logic/*` and `@schema` only, `transaction()` for writes through the repositories, no clock or ref read while rendering, tests outside `app/`, ONE `Modal` at a time, 48-point targets, reduce motion, English copy, `useGate()`, a covering screen closes what is open). Text fields 16 pt or more.
- The lock's settings (`DEVICE_SETTING_KEYS`) never leave the phone; the import already keeps them as they are.
- Same wording as the web, among others: the group and row names above, "Settings" (back), "Saved.", "Up to 30 characters.", "Why you're doing this", "🖥️ System" "☀️ Light" "🌙 Dark", "Sound effects", "Bedtime", "Pick a time between 18:00 and 23:59.", "Badges (3/12)", "Books", "No books added yet.", "+ Add book", "Edit book" / "Add a book", "Total pages", "On page", "Delete this book?", "Attempt #2 · On Day 12", "Tap an attempt to see its days and photos.", "Nothing to show until Day 1.", "No photos in this attempt.", "Every day", "Missing a day", "When a day ends", "Reminders", the Challenge page's lines ("⏳ You can change your challenge and start date until…", "🔒 Strong — locked for this attempt.", "Today or later.", the four rejections), "Erase everything?", "Badge unlocked: First workout", "Couldn't save that", "Try again. If it keeps happening, your phone may be full.", "Turn on the app lock", "Choose a 6-digit PIN", "Type it again", "Too easy to guess. Try another one.", "Those didn't match. Start again.", "Also unlock with Face ID", "Change PIN", "Turn off the app lock", "Enter your PIN", "Wrong PIN. 4 tries left before a wait.", "Too many wrong PINs. Try again in 0:30.", "Forgot PIN?", "Can't unlock?", "Turn the lock off?", "Turn off and open", "Keep it private?", "Set a PIN", "Not now", the bypass notice. The lock screen's title says "Companion is locked" (no "75 Hard" in the native app's copy: the rename rule).

## Review Focus

1. Settings list: groups, values ("PIN + Face ID", "Bedtime 22:30", "Dark", the variant, the book count), a row opens its page, "Settings" goes back; leaving the tab and coming back shows the list; Developer only in dev; Danger zone's footer changes with whether giving up is allowed.
2. Profile, Appearance, Sound, Companion, Rules: save and validation as on the web; the bedtime refuses times outside 18:00–23:59.
3. Challenge: the variant and start date editable until the end of Day 1, asked first when logs exist, locked after; Books: add, edit, delete (the current book cleared), in one sheet; Attempt history: the list, a page per attempt with its day rows and photos, a photo opens the lightbox.
4. Badges: earned ones unlock once (never twice for two quick reads), a toast each, queued; none while the peak, a missed-day, joker or gave-up screen is up, nor under the lock; the Badges page counts them.
5. Toasts: one stack, the front one times out (quicker with a queue), a tap sends it away, two peek behind; a failed write shows "Couldn't save that" in front.
6. The lock: off by default; turned on with a PIN typed twice (too simple refused); it locks at launch and after more than 60 s in the background, not on turning it on; wrong PINs count across launches with the web's waits; Face ID is asked once on its own when on; "Forgot PIN?" sets a new one after Face ID; "Can't unlock?" turns it off and leaves the notice on Today; Change PIN and turning it off ask the current PIN; sheets hide while locked and come back after; the cover shows while the app is inactive.
7. The offer after the deal: "Keep it private?", "Set a PIN", Face ID next where the phone has it, "Not now"; shown once.
8. Light and dark, VoiceOver names, 48-point keys.

---

### Task 1: The PIN's rules stand alone (PR 108)

In the `refactor/shared-rules` worktree: `src/logic/appLock.ts` with the pure parts of `lib/pin.ts`, `lib/appLock.ts` (`RELOCK_AFTER_MS`, `shouldRelock`) and `formatCountdown`, plus `StoredPin`, `AppLockConfig`, `PinFailures`; the web files re-export. Web checks, commit, push, merge into `v4`.

### Task 2: The Settings list and the simple pages

`mobile/src/settings/` (`SettingsScreen`, `rows.tsx` with `SettingsGroup` / `SettingsRow` / `SettingsPage`, `ProfilePage`, `RulesPage`, `AppearancePage`, `SoundPage`, `CompanionPage`, `BackupPage`, the Danger zone with `GiveUpFlow` and "Erase everything?"), the route reading `useGate()`; the developer buttons move into "Developer". Tests: Review Focus 1, 2.

### Task 3: Challenge, Books, Attempt history

`challengeRepo.changeStartDate` / `changeVariant`, `bookRepo.remove`, `settings/ChallengePage`, `BooksPage`, `HistoryPage` (+ `useAttemptSummaries`). Tests: Review Focus 3.

### Task 4: Badges and the toast stack

`badgeRepo`, `badges/evaluation.ts`, `useBadgeUnlocks` in the tabs' layout, `toasts/store.ts`, `toasts/ToastStack.tsx` at the root, the save-failure count in `transaction()`, `BadgesPage`. Tests: Review Focus 4, 5.

### Task 5: The app lock

`appLockRepo`, `lock/pin.ts` (noble PBKDF2), `lock/faceId.ts`, `lock/useAppLock.ts` (AppState), `lock/LockScreen`, `PinPad`, `NewPinFlow`, `CheckPinPad`, `settings/AppLockPage`, `LockBypassBanner` on Today, `lock/curtain.ts` read by every Modal, `onboarding/LockOffer` after the deal; `app.json` plugin. Tests: Review Focus 6, 7.

### Task 6: Check, review

- [ ] `npm run check`, commit, push.
- [ ] One independent review on a frozen snapshot; fix Critical and Important with a failing test first; Minor in the ledger `.superpowers/sdd/2026-11-19-v4-part-8-settings/progress.md`.

## Done when

- `npm run check` passes in `mobile/`; the Review Focus cases hold in tests.
- The spec's build-order line for part 8, the memory file and a hand-over note say where things stand.
