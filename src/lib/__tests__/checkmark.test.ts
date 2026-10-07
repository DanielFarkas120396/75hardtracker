import { describe, expect, it } from 'vitest'
import { isCheckmark, type Point } from '../checkmark'

/** Straight segments through the given corners, sampled every few pixels, like a slow finger. */
function stroke(...corners: [number, number][]): Point[] {
  const points: Point[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    const [x0, y0] = corners[i]
    const [x1, y1] = corners[i + 1]
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4))
    for (let s = 0; s < steps; s++) points.push({ x: x0 + ((x1 - x0) * s) / steps, y: y0 + ((y1 - y0) * s) / steps })
  }
  points.push({ x: corners[corners.length - 1][0], y: corners[corners.length - 1][1] })
  return points
}

describe('isCheckmark', () => {
  it('accepts a checkmark: short arm down, long arm up to the right', () => {
    expect(isCheckmark(stroke([40, 100], [80, 150], [180, 40]))).toBe(true)
  })

  it('accepts a wobbly one, with a near-vertical first arm', () => {
    expect(isCheckmark(stroke([60, 90], [58, 140], [70, 150], [160, 60]))).toBe(true)
  })

  it('refuses a tap, a flick and a tiny mark', () => {
    expect(isCheckmark([{ x: 50, y: 50 }])).toBe(false)
    expect(isCheckmark(stroke([50, 50], [55, 55]))).toBe(false)
    expect(isCheckmark(stroke([50, 50], [60, 62], [75, 45]))).toBe(false)
  })

  it('refuses a straight line, a V, a mirrored check and a check drawn backwards', () => {
    expect(isCheckmark(stroke([40, 150], [180, 40]))).toBe(false)
    expect(isCheckmark(stroke([40, 40], [110, 150], [180, 40]))).toBe(false) // both arms equal: ends level with the start
    expect(isCheckmark(stroke([180, 100], [140, 150], [40, 40]))).toBe(false) // leftwards
    expect(isCheckmark(stroke([180, 40], [80, 150], [40, 100]))).toBe(false) // from the long arm's tip
  })

  it('refuses a stroke that turns too late: a wide L', () => {
    expect(isCheckmark(stroke([40, 40], [40, 150], [180, 150], [180, 140]))).toBe(false)
  })
})
