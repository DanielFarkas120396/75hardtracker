import { useLiveQuery } from 'dexie-react-hooks'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'
import { shouldRemindBackup, snoozeUntil } from '../logic/backupReminder'
import { useNow } from './useNow'

/** Whether the weekly "export a backup" reminder is due (Sunday evening), and how to snooze it. */
export function useBackupReminder() {
  // Re-evaluated as the clock ticks, so the reminder appears while the app is open.
  useNow()
  const lastExportAt = useLiveQuery(() => settingsRepo.get<string | null>(SETTING_KEYS.lastExportAt, null), [])
  const snoozedUntil = useLiveQuery(() => settingsRepo.get<string | null>(SETTING_KEYS.backupReminderSnoozedUntil, null), [])

  // Wait for both stored values: before they load, "no backup yet" would flash the reminder.
  const visible =
    lastExportAt !== undefined &&
    snoozedUntil !== undefined &&
    shouldRemindBackup({ now: new Date(), lastExportAt, snoozedUntil })

  return {
    visible,
    snooze: () => settingsRepo.set(SETTING_KEYS.backupReminderSnoozedUntil, snoozeUntil(new Date()).toISOString()),
  }
}
