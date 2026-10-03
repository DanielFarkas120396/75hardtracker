import { describe, expect, it } from 'vitest'
import { worldProgressLine } from '../worldLines'

describe('worldProgressLine', () => {
  it('counts the days left in the world, today included', () => {
    expect(worldProgressLine(4)).toBe('Hell · 7 days to escape')
    expect(worldProgressLine(20)).toBe('The Wasteland · 3 days to the next world')
    expect(worldProgressLine(70)).toBe('Heaven · 6 days to the top')
  })

  it("marks a world's last day, and the challenge's", () => {
    expect(worldProgressLine(10)).toBe('Hell · last day here')
    expect(worldProgressLine(75)).toBe('Heaven · the very last day')
  })
})
