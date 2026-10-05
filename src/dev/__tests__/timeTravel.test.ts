import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS } from '../../screens/Journey/worlds'
import { isTimeTravelling, TIME_TRAVEL_STOPS, timeTravelUrl } from '../timeTravel'

describe('time travel', () => {
  it('stops at the first day of every world, the last day and the victory', () => {
    const days = TIME_TRAVEL_STOPS.map((s) => s.day)
    for (const world of WORLDS) expect(days).toContain(world.firstDay)
    expect(days).toContain(CHALLENGE_LENGTH)
    expect(days.some((d) => d > CHALLENGE_LENGTH)).toBe(true)
  })

  it('travels in its own scratch database, never the real one', () => {
    expect(timeTravelUrl(40)).toBe('/?db=time-travel&travel=40')
    expect(timeTravelUrl(12, true)).toBe('/?db=time-travel&travel=12&late=1&now=09:00')
    expect(isTimeTravelling('?db=time-travel')).toBe(true)
    expect(isTimeTravelling('')).toBe(false)
    expect(isTimeTravelling('?db=day75')).toBe(false)
  })
})
