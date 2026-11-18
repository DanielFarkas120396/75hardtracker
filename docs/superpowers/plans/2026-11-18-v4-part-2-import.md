# v4 Part 2: Import a Web App Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the native app, the owner picks a backup file exported by the web app (plain or password-protected) and their whole attempt appears: days, workouts, books, weigh-ins, photos, badges, settings.

**Architecture:** The web app's backup rules (format check, the "days the backup can't know about" question, the repair of old data) move under `src/logic/` on `main`, and the native app imports them. The phone decrypts a protected backup with expo-crypto (AES-GCM) and a JavaScript PBKDF2. Photos and covers become files in the app's documents folder. Everything lands in one database transaction, and the photo folder is swapped only after it succeeds.

**Tech Stack:** as part 1, plus expo-document-picker, expo-file-system, expo-crypto, `@noble/hashes`.

**Spec:** `docs/superpowers/specs/2026-11-18-expo-v4-design.md` ("Moving from the web app", "Web backup import", "What would make this a failure").

## Global Constraints

- All of part 1's constraints hold (the `v4` worktree, `npm run check` in `mobile/`, the two aliases, `npx expo install`, English copy, no "75 Hard" in copy the app adds).
- Task 1 changes web code: it goes on the open branch `refactor/shared-rules` (PR 108), as pure moves with re-exports, with the four web checks. Then that branch is merged into `v4` with a merge commit.
- Every database write goes through `transaction()`. A task never calls `transaction()` or a repository write inside itself.
- Never read the clock while rendering: use `useToday()`.
- An import that fails for any reason leaves the phone's data and photos exactly as they were.
- The gap question from the web app (`findBackupGap`, PR 91) is asked before importing, with the web app's wording.
- Must work in Expo Go: no native code of our own in this part.

## Review Focus

1. A backup from an old web version with duplicate day entries or two active attempts imports cleanly (`normalizeRecords` runs first). → Task 5 test.
2. The import fails halfway (a photo can't be written, or an insert fails): the old rows and the old photo files are all still there. → Task 5 tests.
3. A wrong password, or a file that was altered, says "Wrong password, or the file was changed." and imports nothing. → Task 6 and 7 tests.
4. A file that isn't a backup (a photo, random JSON, a newer backup version) shows the web app's message and imports nothing. → Task 7 test.
5. The user cancels the file picker, or closes the password or gap question: nothing changes, and the flow can start again. → Task 7 test.

---

### Task 1: Share the backup rules (web side, on PR 108's branch)

**Files (moves, each old path re-exports the same names):**
- `src/db/types.ts` → the record types move to `src/logic/records.ts`
- `src/db/mappers.ts` → `src/logic/mappers.ts`
- `src/db/normalize.ts` → `src/logic/normalize.ts`
- From `src/db/exportImport.ts` to `src/logic/backupFormat.ts`: `EXPORT_VERSION`, `ExportedPhoto`, `ExportedBook`, `ExportPayload`, `BackupGap`, `findBackupGap`, `withGapRestored`, `ExportValidation`, `validateExportPayload`
- `src/lib/backupCrypto.ts` → `src/logic/backupCrypto.ts` (it only needs the global `crypto`)
- From `src/db/backupReading.ts` to `src/logic/backupReading.ts`: `BackupFileContents`, `readBackupText`; `openProtectedBackup` gains an optional third parameter `decrypt = decryptBackup`
- Modify: `src/logic/__tests__/boundary.test.ts` (the "data types" case now checks that `src/db/types.ts` only re-exports from `../logic/records`)

**Interfaces produced (from `@logic/`):** `records` (all record types), `mappers.toDayTaskData`, `normalize.normalizeRecords`, `backupFormat.*` as listed, `backupCrypto.{encryptBackup, decryptBackup, isEncryptedBackup, EncryptedBackup, BACKUP_KDF_ITERATIONS}`, `backupReading.{readBackupText, openProtectedBackup}`.

- [ ] Step 1: Run `npx vitest run src/logic/__tests__/boundary.test.ts` after moving one file by hand to see it fail on a `../db/` import, then finish the moves until it passes.
- [ ] Step 2: Run the four web checks. Expected: pass, same test count (1176).
- [ ] Step 3: Commit on `refactor/shared-rules`, push, update PR 108's description. Merge the branch into `v4` (`git merge --no-ff`).
- [ ] Step 4: In `mobile/`, point `@schema` at `../src/logic/records.ts` (tsconfig, Jest), run `npm run check`.

### Task 2: Harden the write queue and the seed button

**Files:** `mobile/src/db/open.ts`, `mobile/src/db/__tests__/open.test.ts`, `mobile/src/app/(tabs)/settings.tsx`, `mobile/src/__tests__/shell.test.tsx`

- `transaction()` notifies listeners in a `finally`, each in its own try/catch (a thrown listener is logged with `console.error`, never rethrown).
- In `__DEV__`, a transaction that has waited 5 s to start logs: "A write has waited 5 s for another write. A transaction task must not call transaction() or a repository write."
- "Seed Day 12" asks first (`Alert.alert('Erase everything?', 'This replaces all data on this phone with a test attempt.', [Cancel, Erase])`).

Tests: a listener that throws doesn't fail the write and doesn't stop the next listener; listeners are told after a failed transaction too; the 5 s warning fires for a nested call (fake timers) and not for a normal one; the seed button does nothing until "Erase" is pressed.

### Task 3: Rows for every table

**Files:** `mobile/src/db/rows.ts`, `mobile/src/db/__tests__/rows.test.ts`

For `dayEntries`, `workouts`, `books`, `measurements`, `photos`, `badges`: a `<name>FromRow(row)` and a `<name>ToParams(record)` with an `INSERT_<NAME>` that includes `id` (imports keep the web app's ids, so photo and book references stay valid). `INSERT_CHALLENGE_WITH_ID` likewise. Booleans are 0/1 (`restDay: true` ↔ 1, absent ↔ NULL), `plans`, `planEstimates`, `bodyMeasurements_cm` are JSON, `mood` and `feel` are stored as given.

Tests: each table round-trips a full record and a minimal one with `toStrictEqual` (optional fields absent, not `null`; `dietFollowed: false` stays `false`).

### Task 4: Picture files

**Files:** `mobile/src/files/store.ts` (interface + the expo-file-system implementation), `mobile/src/files/pictures.ts`, `mobile/src/files/__tests__/nodeStore.ts`, `mobile/src/files/__tests__/pictures.test.ts`

- `interface FileStore { writeBytes(path: string, bytes: Uint8Array): Promise<void>; exists(path: string): boolean; deleteFolder(name: string): void; renameFolder(from: string, to: string): void; uri(path: string): string }`. Paths are relative to the app's documents folder. `expoStore` implements it with `File`, `Directory` and `Paths.document`; tests use `nodeStore(tempDir)`.
- `pictures.ts`: `extensionFor(mimeType: string): string` (`image/jpeg` → `jpg`, `image/png` → `png`, `image/webp` → `webp`, `image/heic` → `heic`, anything else → `img`); `stagePictures(store, items: { folder: 'photos' | 'covers'; id: number; base64: string; mimeType: string }[]): Promise<Map<string, string>>` writes each to `incoming/<folder>/<id>.<ext>` and returns `"<folder>/<id>"` → file name; `commitStaged(store)` replaces `photos/` and `covers/` with the staged folders (old ones are renamed to `outgoing/…` first and deleted last); `discardStaged(store)` removes `incoming/`; `pictureUri(store, folder, file)`.

Tests (real files in a temp folder): staged files hold the decoded bytes; commit swaps and removes the old pictures; discard leaves the current pictures untouched; a second import after a commit works.

### Task 5: The import itself

**Files:** `mobile/src/backup/importBackup.ts`, `mobile/src/backup/__tests__/importBackup.test.ts`, `mobile/src/backup/__tests__/sampleBackup.ts`

`importBackup(payload: ExportPayload, store: FileStore, today: string): Promise<void>`:
1. `stagePictures` for every photo and book cover (before the database is touched).
2. `normalizeRecords` on challenges, day entries, workouts and badges.
3. One `transaction`: delete every row of the eight tables; insert everything with its id; settings are the backup's, minus `DEVICE_SETTING_KEYS` and `lastExportAt`, plus `lastExportAt = payload.exportedAt`, plus this phone's own device settings kept as they were.
4. `commitStaged`. If any step before it throws, `discardStaged` and rethrow.

Tests: a sample backup (two attempts, days with workouts, a book with a cover, weigh-ins, three photos, a badge, settings) imports and reads back equal through SQL and the mappers; a backup with duplicate day entries and two active attempts imports (one active attempt, one entry per day); the phone's `appLock` setting survives and the backup's doesn't replace it; `lastExportAt` equals `exportedAt`; when a picture can't be written, and when an insert fails (a photo row with a duplicate id), the previous rows and picture files are unchanged.

### Task 6: Opening a protected backup on the phone

**Files:** `mobile/src/backup/decrypt.ts`, `mobile/src/backup/__tests__/decrypt.test.ts`

`decryptOnPhone(file: EncryptedBackup, password: string): Promise<string | null>`: the key comes from `pbkdf2Async` (`@noble/hashes`, SHA-256, the file's salt and iteration count, 32 bytes), the plaintext from expo-crypto (`AESEncryptionKey.import`, `AESSealedData.fromParts(iv, data, 16)`, `aesDecryptAsync`). `null` when the password is wrong or the file was changed, as on the web. It is passed to `openProtectedBackup(file, password, decryptOnPhone)`.

Tests: a backup made by the web's own `encryptBackup` (from `@logic/backupCrypto`, 1 000 iterations to stay fast) opens with the right password and gives `null` with a wrong one and with one changed byte. expo-crypto's AES is native, so the test replaces it with Node's AES-GCM (`jest.mock('expo-crypto')`); the key derivation is the real one, and is also compared with Node's `pbkdf2Sync`.

ponytail: JavaScript PBKDF2 at 310 000 rounds may take several seconds on the phone. Task 8 measures it. If it is too slow, the upgrade is a native crypto library, which needs a development build.

### Task 7: The import flow in Settings

**Files:** `mobile/src/backup/ImportBackup.tsx`, `mobile/src/backup/pickBackupFile.ts`, `mobile/src/backup/__tests__/ImportBackup.test.tsx`, `mobile/src/app/(tabs)/settings.tsx`

- `pickBackupFile(): Promise<string | null>`: expo-document-picker (`type: ['application/json', 'public.json', '*/*']`, `copyToCacheDirectory: true`), then the file's text; `null` when cancelled.
- `<ImportBackup />`: a button "Import a web app backup", then the web flow of `src/components/BackupRestore.tsx`, with its wording: an error line for a file that can't be read; "This backup is protected" with "Its password", "Open" / "Opening…" and "Wrong password, or the file was changed."; "Replace all data?" with "Replace data" when the phone already has an attempt; the gap question ("This backup stops at Day N", "Days A to B aren't in it. Did you do them?", "Yes, I did them" / "No, count them as missed", and the stakes line); "Restoring…" while it runs; then "Backup imported." or "Restoring failed. Your existing data was not changed.".
- Shown on the Settings placeholder for everyone (not only in development).

Tests (the picker replaced by a function returning text): the five Review Focus cases above that belong here, plus: a plain backup imports and Today then shows its day; "Yes, I did them" adds the gap days to `restoredDays`; "No" doesn't.

### Task 8: On the phone, then the review

- [ ] The owner exports a backup from the web app on the iPhone (Settings → Backup), plain and password-protected, and imports each in Expo Go. Expected: Today shows the real day. Note how long "Opening…" takes.
- [ ] One independent review of the part's diff; fix Critical and Important findings with a failing test first.

## Done when

- PR 108 holds both pure-move commits and its four checks pass.
- `npm run check` passes in `mobile/`.
- The owner's real backup is in the native app, or what blocked it is written down.
