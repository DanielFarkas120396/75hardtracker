import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it } from 'vitest'
import { JourneyPath } from '../JourneyPath'

/** The vertical position of a day's stone, read from its transform. */
function stoneY(dayNumber: number): number {
  const transform = screen.getByRole('img', { name: new RegExp(`^Day ${dayNumber},`) }).getAttribute('transform') ?? ''
  return Number(/translate\([\d.-]+ ([\d.-]+)\)/.exec(transform)?.[1])
}

describe('JourneyPath', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('labels every day with its state', () => {
    render(<JourneyPath completedDayNumbers={new Set([1, 2, 4])} missedDayNumbers={new Set([3])} todayDayNumber={5} />)

    expect(screen.getAllByRole('img', { name: /^Day \d+,/ })).toHaveLength(75)
    expect(screen.getByRole('img', { name: 'Day 1, completed' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 3, forgiven with a joker' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 5, today' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 6, not reached yet' })).toBeInTheDocument()
  })

  it('climbs from Day 1 at the bottom to Day 75 at the top', () => {
    render(<JourneyPath completedDayNumbers={new Set()} missedDayNumbers={new Set()} todayDayNumber={1} />)

    expect(stoneY(1)).toBeGreaterThan(stoneY(2))
    expect(stoneY(2)).toBeGreaterThan(stoneY(75))
  })

  it('puts up a sign at the start of each world', () => {
    const { container } = render(
      <JourneyPath completedDayNumbers={new Set()} missedDayNumbers={new Set()} todayDayNumber={1} />,
    )

    for (const name of ['Hell', 'The Wasteland', 'The Dark Forest', 'The Meadows', 'The Mountains', 'Heaven']) {
      expect(container).toHaveTextContent(name)
    }
  })
})
