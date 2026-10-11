import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DayCompleteCelebration } from '../DayCompleteCelebration'

vi.mock('../../../lib/confetti', () => ({ celebrate: vi.fn() }))
vi.mock('../../../hooks/useSound', () => ({ useSound: () => vi.fn() }))

describe('DayCompleteCelebration', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('puts focus on its one button when it opens, so VoiceOver lands on the overlay', () => {
    render(<DayCompleteCelebration celebration={{ dayNumber: 12, streak: 12, isFinalDay: false, late: false }} onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Day 12 complete!' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nice!' })).toHaveFocus()
  })
})
