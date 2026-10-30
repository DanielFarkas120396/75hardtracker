# Restoring an older backup

Date: 2026-10-30 · Status: **built**, agreed with the owner on 2026-10-30. Step 2 of the MVP order from the ship review.

## Why

A backup is saved once a week at best, so the one you restore is usually a few days old. Today, those days count as missed.

Example: you are on Day 40 of 75 Hard, you lose your phone, and you restore a backup from Day 33. The app opens on "Restart from Day 1", with no other button. Your attempt ends because the backup was old, not because you skipped a day. Settings promises the opposite: a backup means "a lost phone doesn't cost you your progress".

## What it does

If the backup stops before today, the app asks one question before it restores:

> **This backup stops at Day 33**
> Today is Day 40. Days 33 to 39 aren't in it. Did you do them?
>
> [Yes, I did them] [No, count them as missed]
>
> Their tasks, photos and notes aren't in the backup either way.
> Under "No", the challenge's own stakes line: "Miss a day: back to Day 1."

- **Yes:** the restore runs, and those days count as done. Day 40 stays Day 40, and the streak carries on.
- **No:** the restore runs, and the normal rules apply. Hard and Strong restart. Medium and Soft spend their jokers.

Closing the question cancels the restore and changes nothing.

### When it asks

Only when all of these hold:

- The newest attempt in the backup is still active.
- At least one day from the backup's date up to yesterday isn't complete.

Today is never in the list, because it's still open. Days missed before the backup was made stay missed: the question only covers days the backup couldn't know about. Days past 75 aren't listed.

In Settings, "Replace all data?" still comes first. On the welcome screen on a new phone, this question is the only one.

### On the Journey

These days show as done, with no photo. The day card says "Not in your backup". Stats totals count only what was logged, so they don't grow.

## Choices

- **Ask, don't forgive silently.** The review suggested forgiving the gap with a message. Asking is stricter: a free pardon would let anyone wipe a real miss by restoring an old file. This way they'd have to say they did the days. The app already trusts you this way every time you tick a task.
- **No limit on how often.** Limiting it would need a server to enforce. The question is the check.

## Build notes

- Add one optional, unindexed field: `Challenge.restoredDays?: number[]`. No Dexie version bump. Old rows keep working. It travels in backups with the rest of the challenge, and a test checks that `normalizeChallenges` keeps it.
- Set the field on the payload before `importAll`, so it lands in the same transaction as the restore.
- One pure function in `src/logic/` finds the days from the backup's `exportedAt` date, the challenge's start date and today.
- One helper turns entries plus `restoredDays` into the day summaries the rules read. `resolveGate`, the streak, badges and attempt history all go through it, so nothing else needs to know about restored days.
- The question lives in `BackupRestore`, so Settings and the welcome screen share it. No new gate screen.

## Left out

- Nothing tries to recover the lost days' data.
- No changes to backups for older attempts, or attempts that have ended.
- No automatic backups. iPhone web apps can't save a file without a tap.
