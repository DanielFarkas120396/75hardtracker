import { describe, expect, it } from 'vitest'
import { formatDisplayDate } from '../../lib/dates'
import { startsWhen } from '../onboarding'

describe('startsWhen', () => {
  it('says today, tomorrow, or the date', () => {
    expect(startsWhen('2026-09-28', '2026-09-28')).toBe('today')
    expect(startsWhen('2026-09-29', '2026-09-28')).toBe('tomorrow')
    expect(startsWhen('2026-10-03', '2026-09-28')).toBe(`on ${formatDisplayDate('2026-10-03')}`)
  })
})
