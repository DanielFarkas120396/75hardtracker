# Face ID lock: design

Date: 2026-10-05 · Status: approved in conversation. It goes into `v2`. Not yet tested on an iPhone; that needs a real domain (see Testing).

## Why

Body photos, weight and notes are private, and anyone holding an unlocked phone can open the app (from the app review, 2026-10-05).

## Decisions

| Topic | Decision |
|---|---|
| When it asks | When the app opens, and when you come back after **more than 1 minute** in another app. |
| What it hides | **The whole app.** It's also covered while in the background, so the app switcher's snapshot doesn't show it. |
| Way out | **"Can't unlock?"** turns the lock off after a confirmation, and leaves a **tripwire notice** on Today ("turned off on … with Can't unlock?") until dismissed. |

## How it works

- **WebAuthn with the phone's platform authenticator** (`src/lib/appLock.ts`):
  - Turning the lock on creates a passkey ("75 Hard") with user verification required.
  - Unlocking asks for it, and checks the authenticator data's user-verified flag.
  - There's no server: the phone's verified answer is the check.
- **Honest limits:**
  - It's a privacy curtain, not encryption.
  - It needs a secure page on a real domain or localhost, never an IP address, so it can't run over the `https://192.168…` Wi-Fi dev link.
- **Settings:** Privacy & data → Face ID lock. Turning it on and turning it off both ask for Face ID. Where it isn't available, the switch is replaced by an explanation.
- **Storage:**
  - `appLock` ({ credentialId, enabledAt }) and `appLockBypassedAt` in the settings table, through `appLockRepo`.
  - Both are device settings (`DEVICE_SETTING_KEYS`): left out of exports, and kept as they are on import, since a passkey only works on its own phone.
- **App:**
  - `useAppLock` at the root: loading, locked or open, plus the 1-minute relock, and `data-covered` on <html> while in the background.
  - While locked, the app stays mounted (you come back where you were) but hidden and inert, under `LockScreen`.
  - `LockScreen` asks once on its own, then from its button.

## Testing

- **Unit tests:** the relock timing, base64url, the user-verified flag, `verifyOwner` (verified, unverified, cancelled).
- **Hook tests:**
  - locked at open
  - unlocking
  - relock after more than 1 min but not after a quick switch, with the cover
  - no lock-out when turning it on
  - the bypass
- **Screen tests:** the lock screen, the Settings explanation, and the backup keeping the lock off exports and imports.
- **Browser:** the lock screen, the bypass path and the notice.
- **iPhone (to do):** on a Vercel preview (a real domain), as an installed app: turning it on, unlocking with Face ID, the relock after 1 min, and the app switcher.
