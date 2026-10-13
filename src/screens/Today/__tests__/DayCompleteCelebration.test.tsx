import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { useState } from 'react'
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

// The stones and the duck are hidden from VoiceOver (the words say it), so these queries look past that.
const stone = (name: string) => screen.queryByRole('img', { name, hidden: true })

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

  it("lights today's stone in gold on the climb, between the days won and the ones ahead", async () => {
    const { container } = render(<DayCompleteCelebration celebration={day(12, 12)} onDismiss={vi.fn()} />)
    expect(stone('Day 12, today')).toBeInTheDocument()
    expect(container.querySelector('[data-won-ring]')).toBeNull()
    expect(await screen.findByRole('img', { name: 'Day 12, completed', hidden: true }, { timeout: STONE_LIGHTS_MS + 2000 })).toBeInTheDocument()
    expect(container.querySelector('[data-won-ring]')).not.toBeNull()
    expect(stone('Day 10, completed')).toBeInTheDocument()
    expect(stone('Day 14, not reached yet')).toBeInTheDocument()
  })

  it('reads only its words: no stones or duck, and the streak once', () => {
    render(<DayCompleteCelebration celebration={day(12, 12)} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('img', { name: /^Day 1[0-4],/ })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Streak: 12 days' })).toBeInTheDocument()
    expect(screen.getByText('day streak')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows a day behind the streak as forgiven with a joker', () => {
    render(<DayCompleteCelebration celebration={day(12, 1)} onDismiss={vi.fn()} />)
    expect(stone('Day 11, forgiven with a joker')).toBeInTheDocument()
  })

  it('stops at the ends of the climb', () => {
    render(<DayCompleteCelebration celebration={day(75, 75, { isFinalDay: true })} onDismiss={vi.fn()} />)
    expect(stone('Day 76, not reached yet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See your victory' })).toHaveFocus()
  })

  it('closes on Escape, and gives focus back to what had it', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Opener
          </button>
          <DayCompleteCelebration celebration={open ? day(12, 12) : null} onDismiss={() => setOpen(false)} />
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('button', { name: 'Nice!' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })
})
