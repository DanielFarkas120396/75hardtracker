import { CHALLENGE_LENGTH } from '@logic/constants'
import { dayNumberForDate } from '@logic/dates'
import { WORLD_COLORS } from '@logic/worldColors'
import type { Challenge } from '@schema'

it('runs the web app’s rules', () => {
  const challenge: Omit<Challenge, 'id'> = { startDate: '2026-01-01', attemptNumber: 1, status: 'active' }
  expect(CHALLENGE_LENGTH).toBe(75)
  expect(dayNumberForDate(challenge.startDate, '2026-01-10')).toBe(10)
  expect(WORLD_COLORS.hell.dark.canvas).toBe('#16110e')
})
