import { dayInView, railDay, sectionFill, type RowPlace } from '../railMaths'

// Day 12 (today) at the top, then 11, then a cover (a gap), then 10: newest first, as the logbook lays them out.
const rows: RowPlace[] = [
  { day: 12, top: 300, height: 100 },
  { day: 11, top: 408, height: 100 },
  { day: 10, top: 650, height: 100 },
]

describe('dayInView', () => {
  it('is the day reached above the first row (the top of the page)', () => {
    expect(dayInView(rows, 100, 12)).toBe(12)
  })

  it('empties a day as the line goes down through its row', () => {
    expect(dayInView(rows, 300, 12)).toBe(12)
    expect(dayInView(rows, 350, 12)).toBe(11.5)
    expect(dayInView(rows, 433, 12)).toBe(10.75)
  })

  it('rests on the day below between two rows, over a cover', () => {
    expect(dayInView(rows, 404, 12)).toBe(11)
    expect(dayInView(rows, 600, 12)).toBe(10)
  })

  it('is nothing past the last row, and the day reached before any row is measured', () => {
    expect(dayInView(rows, 900, 12)).toBe(0)
    expect(dayInView([], 400, 12)).toBe(12)
  })
})

describe('sectionFill', () => {
  it("fills a world's section with the days of it reached", () => {
    expect(sectionFill(12, 11, 22)).toBeCloseTo(2 / 12)
    expect(sectionFill(10, 11, 22)).toBe(0)
    expect(sectionFill(30, 11, 22)).toBe(1)
    expect(sectionFill(10.5, 1, 10)).toBe(1)
  })
})

describe('railDay', () => {
  // A 844-point window under a 47-point status bar: the line is 332.8 points down the page at the top.
  it('reads the line 45% down the screen, under the status bar, as the page scrolls', () => {
    expect(railDay(rows, -100, 844, 47, 12)).toBe(12)
    expect(railDay(rows, 0, 844, 47, 12)).toBeCloseTo(11.672)
    expect(railDay(rows, 125.2, 844, 47, 12)).toBeCloseTo(10.5)
    expect(railDay(rows, 2000, 844, 47, 12)).toBe(0)
  })

  it('never shows past the day reached', () => {
    expect(railDay([{ day: 76, top: 300, height: 100 }], 17.2, 844, 47, 75)).toBe(75)
  })
})
