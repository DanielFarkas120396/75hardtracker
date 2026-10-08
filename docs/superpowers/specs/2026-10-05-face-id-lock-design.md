# App lock: PIN and Face ID (design)

Date: 2026-10-05 · Status: **built** (PRs #23 and #24, merged into `v2`). Off by default. Tested on the owner's iPhone with Face ID on 2026-10-08, on the production domain (75hardtracker-one.vercel.app): every step passed.

It started as a Face ID lock (PR #23). The owner then asked for a banking-app style PIN (PR #24): the PIN is now the lock's base, and Face ID the optional shortcut. This document describes the result.

## Why

Body photos, weight and notes are private, and anyone holding an unlocked phone can open the app (from the app review, 2026-10-05). For 1–5 friends and family it's optional, not essential: it stays off unless turned on.

## Decisions

| Topic | Decision |
|---|---|
| Base | A **6-digit PIN**, chosen when the lock is turned on. Too-simple PINs (111111, 123456) are refused. |
| Face ID | **Optional shortcut** ("Also unlock with Face ID"). When on, the lock screen asks for Face ID once on its own; the PIN pad is the backup. Without Face ID, the lock works with the PIN alone, including over the Wi-Fi test link. |
| When it asks | When the app opens, and when you come back after **more than 1 minute** in another app. |
| What it hides | **The whole app.** It's also covered while in the background, so the app switcher's snapshot doesn't show it. |
| Wrong PINs | **5 free tries,** then waits of 30 s, 1 min, 5 min, 15 min and 1 h, with a countdown. The wait is stored, so a relaunch doesn't reset it, and it applies in Settings too. |
| Forgot PIN | **"Forgot PIN?"** sets a new PIN after Face ID (when Face ID is on). |
| Last way out | **"Can't unlock?"** turns the lock off after a confirmation, and leaves a **tripwire notice** on Today ("turned off on … with Can't unlock?") until dismissed. |

## Honest limits

- It's a privacy curtain, not encryption: the data itself isn't encrypted on the phone.
- Face ID (WebAuthn) needs a secure page on a real domain or localhost, never an IP address, so it can't run over the `https://192.168…` Wi-Fi dev link.

## How it works

- **PIN** (`src/lib/pin.ts`): kept only as a PBKDF2-SHA-256 fingerprint (a random salt, 210,000 rounds), never as typed. `waitAfterFailures` gives the wait for a number of wrong tries.
- **Face ID** (`src/lib/appLock.ts`): WebAuthn with the phone's platform authenticator.
  - Turning it on creates a passkey ("75 Hard") with user verification required.
  - Unlocking asks for it, and checks the authenticator data's user-verified flag.
  - There's no server: the phone's verified answer is the check.
- **Storage** (`appLockRepo`, in the settings table):
  - `appLock`: the PIN fingerprint, the passkey id when Face ID is on, and when it was turned on;
  - `appLockFailures`: the wrong-PIN count and the wait;
  - `appLockBypassedAt`: when "Can't unlock?" was used.
  - All three are device settings (`DEVICE_SETTING_KEYS`): left out of exports and kept as they are on import, since a passkey only works on its own phone.
- **App:**
  - `useAppLock` at the root: loading, locked or open, the 1-minute relock, and `data-covered` on `<html>` while in the background.
  - While locked, the app stays mounted (you come back where you were) but hidden and inert, under `LockScreen`.
  - `LockScreen` is a PIN pad with a Face ID key. It asks for Face ID once on its own (once only, even under React's double effects in development).

## Settings → Privacy & data → App lock

- **Turn on:** choose the PIN, typed twice.
- **Also unlock with Face ID:** asks for Face ID to turn it on. Where Face ID isn't available, an explanation replaces the switch.
- **Change PIN:** the current PIN, then the new one twice.
- **Turn off:** asks for the PIN.

## Testing

- **Unit:** PIN format, too-simple PINs, hashing and salting, the waits; the relock timing, base64url, the user-verified flag, `verifyOwner` (verified, unverified, cancelled).
- **Hook:** locked at open, PIN unlock, Face ID unlock, the wait surviving a relaunch, Face ID clearing the count, Forgot PIN, relock after more than 1 min but not after a quick switch (with the cover), no lock-out when turning it on, the bypass.
- **Screens:** the lock screen, Settings (turn on, change, turn off, the Face ID explanation), and backups keeping the lock out of exports and imports.
- **In the browser:** turning it on, the lock at reopening, a wrong PIN then the right one, the bypass and its notice.
- **iPhone (to do):** on a real domain (a Vercel preview or production; Vercel is back on since 2026-10-08), as an installed app: turning Face ID on, unlocking with it, the relock after 1 min, and the app switcher.
