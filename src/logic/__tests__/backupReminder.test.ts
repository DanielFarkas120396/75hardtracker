import { describe, expect, it } from 'vitest'
import { lastReminderWindowStart, shouldRemindBackup, snoozeUntil } from '../backupReminder'

// 2026-09-27 is a Sunday.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute)
const iso = (date: Date) => date.toISOString()

describe('lastReminderWindowStart', () => {
  it('is today at 18:00 on Sunday evening', () => {
    expect(lastReminderWindowStart(at(27, 20))).toEqual(at(27, 18))
  })

  it('is the previous Sunday on Sunday before 18:00', () => {
    expect(lastReminderWindowStart(at(27, 17, 59))).toEqual(at(20, 18))
  })

  it('is the last Sunday on other days', () => {
    expect(lastReminderWindowStart(at(30, 9))).toEqual(at(27, 18))
  })
})

describe('shouldRemindBackup', () => {
  const none = { lastExportAt: null, snoozedUntil: null }

  it('stays quiet on Sunday before 18:00', () => {
    expect(shouldRemindBackup({ now: at(27, 17, 59), ...none })).toBe(false)
  })

  it('reminds on Sunday from 18:00 when there has never been a backup', () => {
    expect(shouldRemindBackup({ now: at(27, 18), ...none })).toBe(true)
  })

  it('stays quiet on a weekday when there has never been a backup', () => {
    expect(shouldRemindBackup({ now: at(30, 9), ...none })).toBe(false)
  })

  it('reminds on Sunday evening when the last backup is from earlier in the week', () => {
    expect(shouldRemindBackup({ now: at(27, 19), lastExportAt: iso(at(24, 12)), snoozedUntil: null })).toBe(true)
  })

  it('stays quiet once a backup was made during the Sunday window', () => {
    expect(shouldRemindBackup({ now: at(27, 21), lastExportAt: iso(at(27, 18, 30)), snoozedUntil: null })).toBe(false)
  })

  it('stays quiet in the days after a Sunday-evening backup', () => {
    expect(shouldRemindBackup({ now: at(30, 9), lastExportAt: iso(at(27, 19)), snoozedUntil: null })).toBe(false)
  })

  it('catches up on a weekday when the last backup is a week old or more', () => {
    expect(shouldRemindBackup({ now: at(30, 9), lastExportAt: iso(at(22, 8)), snoozedUntil: null })).toBe(true)
  })

  it('does not catch up while the last backup is under a week old', () => {
    expect(shouldRemindBackup({ now: at(30, 9), lastExportAt: iso(at(24, 12)), snoozedUntil: null })).toBe(false)
  })

  it('stays quiet while snoozed, and comes back after', () => {
    const snoozedUntil = iso(snoozeUntil(at(27, 19)))
    expect(shouldRemindBackup({ now: at(27, 23, 59), lastExportAt: null, snoozedUntil })).toBe(false)
    expect(shouldRemindBackup({ now: at(28, 9), lastExportAt: iso(at(10, 8)), snoozedUntil })).toBe(true)
  })

  it('treats an unreadable last-backup date as no backup', () => {
    expect(shouldRemindBackup({ now: at(27, 19), lastExportAt: 'nonsense', snoozedUntil: null })).toBe(true)
  })
})
