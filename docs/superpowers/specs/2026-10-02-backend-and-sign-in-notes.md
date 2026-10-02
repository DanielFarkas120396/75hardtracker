# Backend, sign-in and cloud backup — notes (for later)

Status: **decided for now** (2026-10-02). The app stays **local-only**. No backend and no sign-in.
Revisit when one of the triggers below happens.

## Decision

- **No Supabase (or any) backend for now.** The app is a single-user offline PWA. Everything, photos included, lives on the phone in IndexedDB (Dexie). It already has:
  - persistent storage requested from Safari (`src/lib/storage.ts`, shown in Settings),
  - export/import backups (`src/db/exportImport.ts`),
  - the Sunday-evening reminder to export a backup.
- **No Google/Apple sign-in for now.** An account is only useful when something is linked to it (data on a server, a purchase, other devices). Local-only means nothing to link: the app would behave exactly the same signed in.

## Why not now

- **Progress photos are very private.** Storing them on a server makes us responsible for protecting them and for privacy rules (GDPR). This is the biggest reason.
- **Accounts** mean sign-up, login, password resets and account deletion.
- **Sync** between offline changes and a server is one of the hardest parts of an app like this.
- **Running costs**: photo storage grows every day for every user.
- **Sign-in still needs a server.** Sign in with Apple needs a paid Apple Developer account (€99/year) plus a small server to verify sign-ins. Sign in with Google is free but also needs that server, otherwise anyone could fake being anyone.

## Known weak spots of local-only

- Losing or replacing the phone loses everything since the last backup. The weekly reminder limits this to about a week.
- Only one device: no checking on an iPad or computer.

## Triggers to revisit

1. **Paywall / charging money.** Onboarding already has a slot for a paywall before "ready" (`src/logic/onboarding.ts`). Checking who has paid needs something on a server. That doesn't have to be Supabase: RevenueCat, or Stripe with a few small server functions, is lighter.
2. **Several devices** requested.
3. **Backups feel like a chore**: see the next step below.
4. **Social features** (friends, shared challenges, leaderboards).

## First step when backups need to be automatic: backup to the user's own cloud

- **Google Drive (preferred first step):** the app asks for permission to save its backup file in a hidden app folder in the user's **own** Google Drive (the `drive.appdata` scope). It works from the PWA directly: **no server of ours** and no photos stored by us. The weekly "export a backup" could then run automatically.
- **iCloud:** possible through Apple's CloudKit JS for web apps, but it needs the paid Apple Developer account and is fiddlier to set up.
- This fixes the real weak spot (losing the phone) without accounts and without holding anyone's photos ourselves.

## If a backend does come later

- Start with an **optional, encrypted cloud backup**: the backup file is encrypted on the phone, then uploaded to the user's account. Full live sync only if really needed.
- **App Store rule:** if the app is ever published on the App Store and offers Google sign-in, it must also offer Sign in with Apple.
