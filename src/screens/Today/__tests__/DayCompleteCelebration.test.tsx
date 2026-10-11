import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DayCompleteCelebration, STONE_LIGHTS_MS } from '../DayCompleteCelebration'

vi.mock('../../../hooks/useSound', () => ({ useSound: () => vi.fn() }))

const day = (dayNumber: number, streak: number, more: { isFinalDay?: boolean; late?: boolean } = {}) => ({
  dayNumber,
  streak,
  isFinalDay: false,
  late: false,
  ...more,
})

describe('DayCompleteCelebration', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('puts focus on its one button when it opens, so VoiceOver lands on the overlay', () => {
    render(<DayCompleteCelebration celebration={day(12, 12)} onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Day 12 done.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nice!' })).toHaveFocus()
    expect(screen.getByText('One more stone. 63 to go.')).toBeInTheDocument()
  })

  it("lights today's stone on the climb, between the days won and the ones ahead", async () => {
    render(<DayCompleteCelebration celebration={day(12, 12)} onDismiss={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Day 12, today' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Day 12, completed' }, { timeout: STONE_LIGHTS_MS + 2000 })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 10, completed' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 14, not reached yet' })).toBeInTheDocument()
  })

  it('shows a day behind the streak as forgiven with a joker', () => {
    render(<DayCompleteCelebration celebration={day(12, 1)} onDismiss={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Day 11, forgiven with a joker' })).toBeInTheDocument()
  })

  it('stops at the ends of the climb', () => {
    render(<DayCompleteCelebration celebration={day(75, 75, { isFinalDay: true })} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('img', { name: /^Day 76/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See your victory' })).toHaveFocus()
  })
})
