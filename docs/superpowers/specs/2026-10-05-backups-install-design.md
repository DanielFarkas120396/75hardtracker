# Backups and install first (design)

Date: 2026-10-05 · Status: **built** (PR #25, merged into `v2`). Approved in conversation; written down afterwards.

## Why

From the app review (2026-10-05). The audience for now is 1–5 friends and family, so a server, accounts and push notifications aren't worth it ([backend notes](2026-10-02-backend-and-sign-in-notes.md)). What matters more at this size:
- **Losing data.** Everything lives only on the phone, and the backup was hard to find.
- **A wrong install.** On iPhone, a Home Screen app has its own storage, apart from Safari's. A friend who sets up in Safari and installs afterwards finds an empty app.
- **The backup file** holds every progress photo, unprotected.

## Decisions

| Topic | Decision |
|---|---|
| Install | **Install first**: a phone browser is asked to install before the welcome flow. |
| Backup password | **Optional.** Without one, the file stays plain JSON, as before. |
| Restore | Also from the welcome screen (a new phone, or right after installing). |

## Install first (`src/screens/Onboarding/InstallFirst.tsx`)

- Shown before `OnboardingFlow`, only in a phone browser that isn't the installed app (`shouldOfferInstallFirst`, in `src/lib/installPrompt.ts`). Never in the installed app, and never on a computer.
- **iPhone:** "Add 75 Hard to your Home Screen", with the 3 steps: the Share button, "Add to Home Screen", then open it from the Home Screen.
- **Android:** one Install button (the browser's install prompt).
- **"Continue in the browser anyway"** skips it, remembered in localStorage (`75hard-install-skipped`).

## Restore

- The welcome screen has **"Already have a backup? Restore it"**.
- Settings → Backup & storage has **Save a backup** and **Restore a backup**.
- Restoring replaces what’s on the device, after a confirmation when there’s data to lose (none on the welcome screen).
- `src/db/backupReading.ts` reads a chosen file: a plain backup (validated), a protected one, or neither (with an error).

## Protected backups (`src/lib/backupCrypto.ts`)

- **Saving** (Settings, or the Sunday reminder) opens `BackupExportSheet`: an optional password, typed twice, at least 6 characters. The sheet advises saving the file to iCloud Drive, and warns that a forgotten password can't be recovered.
- **With a password,** the backup JSON is encrypted with AES-256-GCM, under a key from PBKDF2-SHA-256 (a random salt, 310,000 rounds). The file (`…-protected.json`) is `{ format: '75hard-encrypted-backup', version: 1, kdf, cipher, data }`.
- **Restoring** a protected file asks for its password. A wrong password and an altered file both fail the same way: "Wrong password, or the file was changed." (AES-GCM checks the file's integrity.)
- The file is shared through the phone's share sheet.
- The app lock's settings never go into a backup (`DEVICE_SETTING_KEYS`).

## Testing

- **Unit:** encryption round trip, a wrong password, an altered file, telling protected files from plain ones.
- **Database:** reading plain, protected and invalid files; opening a protected one with its password only.
- **UI:**
  - the install screen (only in a phone browser, the iPhone steps, skipping remembered, never in the installed app);
  - the backup sheet (`BackupExportSheet.test.tsx`): a plain backup, a password too short or typed differently, an encrypted file only its password opens, the second tap for the share sheet, a cancelled share recording nothing, a failure, Cancel forgetting the password;
  - restoring (`BackupRestore.test.tsx`): the confirmation and its Cancel, replacing, no confirmation on the welcome screen, a protected file and a wrong password, a file that isn't a backup, a failed restore keeping the data.
- **In the browser:** the backup sheet.
- **On a phone (to do):** the install screen only appears in a real phone browser. Open the Wi-Fi link in Safari, in a private tab.
