import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { fillPalette } from '../palette'
import { createSprint, sprintFront } from '../sprint'

describe('sprint fill', () => {
  it('starts off the left edge, crosses in proportion and ends off the right edge', () => {
    expect(sprintFront(0, 173)).toBeLessThan(-16)
    expect(sprintFront(0.5, 173)).toBeCloseTo(173 / 2)
    expect(sprintFront(1, 173)).toBeGreaterThan(173 + 16)
  })

  it('leaves at full speed on the tap and settles in the chosen 0.7 s', () => {
    const sprint = createSprint(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    sprint.setLevel(0.5, false)
    sprint.step(1 / 60, true)
    expect(sprint.shown()).toBeGreaterThan(0.03)
    for (let i = 0; i < 42; i++) sprint.step(1 / 60, true)
    expect(sprint.settled()).toBe(true)
    sprint.dispose()
  })
})
