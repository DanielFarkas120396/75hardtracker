/** @jest-environment node */
import { BARS, changeFrom, crownFill, gaugeFrame, litBars, restFrame } from '../gaugeMotion'

const lit = (frame: { bars: { lit: number }[] }) => frame.bars.filter((bar) => bar.lit === 1).length

describe('the gauge’s timeline', () => {
  it('at rest lights the right share of its 41 bars, and keeps the crown short of full before 5/5', () => {
    expect(litBars(3, 5)).toBe(25)
    const three = restFrame(3, 5)
    expect(lit(three)).toBe(25)
    expect(three.crown).toBeCloseTo(0.42)
    expect(three.count).toBe(3)
    const won = restFrame(5, 5)
    expect(lit(won)).toBe(BARS)
    expect(won.crown).toBe(1)
    expect(crownFill(0.99)).toBeLessThan(1)
  })

  it('ticks the number once per task, from where it was, and ends on the day as it is', () => {
    const change = changeFrom(restFrame(0, 5), 3, 5)
    expect(gaugeFrame(change, 0).count).toBe(1)
    expect(gaugeFrame(change, 340).count).toBe(1)
    expect(gaugeFrame(change, 360).count).toBe(2)
    expect(gaugeFrame(change, 720).count).toBe(3)
    const end = gaugeFrame(change, 5000)
    expect(end.done).toBe(true)
    expect(end.count).toBe(3)
    expect(lit(end)).toBe(25)
    expect(end.sweep).toBeNull()
    expect(end.bars.every((bar) => bar.dash === 18 && bar.width === 3)).toBe(true)
  })

  it('sends one wave along the bars: the first swells first, and the grey ones ahead take a softer swell', () => {
    const change = changeFrom(restFrame(1, 5), 2, 5)
    const early = gaugeFrame(change, 250)
    expect(early.bars[0].dash).toBeGreaterThan(18)
    expect(early.bars[15].dash).toBe(18)
    // Bar 12 is new: still grey as the wave sets off, lit once it has passed.
    expect(early.bars[12].lit).toBeLessThan(1)
    const later = gaugeFrame(change, 1100)
    expect(later.bars[12].lit).toBeGreaterThan(0.5)
    const tail = gaugeFrame(change, 1300)
    const swollen = tail.bars.slice(16).filter((bar) => bar.dash > 18)
    expect(swollen.length).toBeGreaterThan(0)
    expect(Math.max(...swollen.map((bar) => bar.dash))).toBeLessThan(26)
    expect(tail.stars).toHaveLength(0)
  })

  it('at 5/5 fills the crown, pops it, and sends twelve stars up', () => {
    const change = changeFrom(restFrame(4, 5), 5, 5)
    expect(gaugeFrame(change, 600).crown).toBeLessThan(0.71)
    const pop = gaugeFrame(change, 700 + 280)
    expect(pop.crown).toBe(1)
    expect(pop.crownScale).toBeGreaterThan(1.2)
    const stars = gaugeFrame(change, 700 + 400).stars
    expect(stars).toHaveLength(12)
    // A fan of 220 degrees around straight up: most rise, the outermost two on each side lean down.
    expect(stars.filter((star) => star.y < 124).length).toBeGreaterThanOrEqual(8)
    const end = gaugeFrame(change, 4000)
    expect(end.done).toBe(true)
    expect(end.stars).toHaveLength(0)
    expect(end.crownScale).toBe(1)
  })

  it('steps down from the far end, dimming the bars it leaves', () => {
    const change = changeFrom(restFrame(3, 5), 2, 5)
    const start = gaugeFrame(change, 0)
    expect(start.count).toBe(2)
    expect(start.number.scale).toBeLessThanOrEqual(1)
    const end = gaugeFrame(change, 3000)
    expect(lit(end)).toBe(16)
    expect(end.done).toBe(true)
  })

  it('carries a change cut short on from what was on screen', () => {
    const first = changeFrom(restFrame(0, 5), 5, 5)
    const mid = gaugeFrame(first, 300)
    const second = changeFrom(mid, 1, 5)
    const start = gaugeFrame(second, 0)
    expect(start.p).toBeCloseTo(mid.p)
    start.bars.forEach((bar, i) => expect(bar.lit).toBeCloseTo(mid.bars[i].lit))
    expect(gaugeFrame(second, 4000).count).toBe(1)
  })
})
