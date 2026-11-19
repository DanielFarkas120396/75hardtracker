import type { TrendWeight } from '@logic/measurements'
import { chartGeometry, closestDay, dayTicks, monotonePath, tickLabel } from '../chartGeometry'

const point = (day: number, kg: number): TrendWeight => ({ day, date: '2026-10-01', weight_kg: kg, trend: kg })

describe('the axes', () => {
  it('ticks "Start" for a weigh-in before Day 1, else "Day 1", then every 10 days', () => {
    expect(dayTicks(true, 11).map(tickLabel)).toEqual(['Start', '10'])
    expect(dayTicks(false, 25).map(tickLabel)).toEqual(['Day 1', '10', '20'])
  })

  it('puts the plot between the left margin and the scale, and the weights on the ticks', () => {
    const g = chartGeometry([point(1, 88), point(10, 87)], 10, 360)
    expect(g.plot).toEqual({ left: 16, right: 330, top: 8, bottom: 130 })
    expect(g.x(1)).toBe(16)
    expect(g.x(10)).toBe(330)
    expect(g.y(g.yTicks[0])).toBe(130)
    expect(g.y(g.yTicks[g.yTicks.length - 1])).toBe(8)
  })
})

describe('reading by finger', () => {
  const points = Array.from({ length: 10 }, (_, i) => point(i + 1, 88 - 0.1 * (i + 1)))
  it('takes the weigh-in closest by day, wherever the finger is', () => {
    expect(closestDay(points, 10, 360, 325)).toBe(10)
    expect(closestDay(points, 10, 360, 16)).toBe(1)
    expect(closestDay(points, 10, 360, 0)).toBe(1)
    expect(closestDay([point(2, 80), point(9, 79)], 10, 360, 200)).toBe(9)
  })
})

describe('the curve', () => {
  it('passes through every point and never overshoots a flat stretch', () => {
    const pts = [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]
    const d = monotonePath(pts)
    expect(d.startsWith('M0,10')).toBe(true)
    expect(d.endsWith('20,0')).toBe(true)
    // On the flat part the control points stay at y = 10 (a monotone curve doesn't bulge above it).
    const controls = d.slice(d.indexOf('C') + 1, d.indexOf('C', 1) > 0 ? d.indexOf('C', d.indexOf('C') + 1) : undefined).split(',').map(Number)
    expect(controls[1]).toBe(10)
    expect(controls[3]).toBe(10)
  })

  it('is a straight line between two points', () => {
    expect(monotonePath([{ x: 0, y: 0 }, { x: 30, y: 30 }])).toBe('M0,0C10,10,20,20,30,30')
  })
})
