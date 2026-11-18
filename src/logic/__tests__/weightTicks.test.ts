import { describe, expect, it } from 'vitest'
import { weightTicks } from '../measurements'

describe('weightTicks', () => {
  it('spaces the kg scale evenly on a round step', () => {
    expect(weightTicks([85.6, 88.4])).toEqual([84, 86, 88, 90])
    expect(weightTicks([80, 80.2])).toEqual([79, 80, 81, 82])
    expect(weightTicks([70, 85])).toEqual([60, 70, 80, 90])
  })
})
