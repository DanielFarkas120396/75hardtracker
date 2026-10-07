import { describe, expect, it } from 'vitest'
import { formatDisplayDate } from '../../lib/dates'
import { RULESETS } from '../../logic/rulesets'
import { defaultStartChoice, finishLine, lateStartHint, startsInLine, startsWhen } from '../onboarding'

describe('startsWhen', () => {
  it('says today, tomorrow, or the date', () => {
    expect(startsWhen('2026-09-28', '2026-09-28')).toBe('today')
    expect(startsWhen('2026-09-29', '2026-09-28')).toBe('tomorrow')
    expect(startsWhen('2026-10-03', '2026-09-28')).toBe(`on ${formatDisplayDate('2026-10-03')}`)
  })
})

describe('start-date lines', () => {
  it('names Day 1 and Day 75', () => {
    expect(finishLine('2026-10-06')).toBe('Day 1: Tue 6 Oct · Day 75: Sat 19 Dec.')
  })

  it('defaults the start to tomorrow from 18:00', () => {
    expect(defaultStartChoice(17 * 60 + 59)).toBe('today')
    expect(defaultStartChoice(18 * 60)).toBe('tomorrow')
  })

  it('counts the days to a later start, but not for today or tomorrow', () => {
    expect(startsInLine('2026-10-06', '2026-10-06')).toBeNull()
    expect(startsInLine('2026-10-07', '2026-10-06')).toBeNull()
    expect(startsInLine('2026-10-09', '2026-10-06')).toBe('Starts in 3 days.')
    expect(startsInLine('2026-10-20', '2026-10-06')).toBe('Starts in 14 days.')
    expect(startsInLine('2026-10-21', '2026-10-06')).toBe("Starts in 15 days. That's a long wait.")
  })

  it("warns about starting today from 18:00, with the day's workouts", () => {
    expect(lateStartHint(17 * 60 + 59, RULESETS.hard)).toBeNull()
    expect(lateStartHint(18 * 60, RULESETS.hard)).toBe(
      "It's 18:00. Today means two workouts before midnight. Tomorrow might be smarter.",
    )
    expect(lateStartHint(22 * 60 + 30, RULESETS.soft)).toBe(
      "It's 22:30. Today means a workout before midnight. Tomorrow might be smarter.",
    )
  })
})
