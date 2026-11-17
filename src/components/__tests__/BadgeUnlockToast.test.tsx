import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BadgeDefinition } from '../../logic/badges'
import { BadgeUnlockToast } from '../BadgeUnlockToast'

function badge(id: string): BadgeDefinition {
  return { id, category: 'first', name: `Badge ${id}`, description: `Earned ${id}.` }
}

describe('BadgeUnlockToast', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stacks the badges: the first in front, two more peeking out behind', () => {
    const { container } = render(<BadgeUnlockToast badges={[badge('a'), badge('b'), badge('c'), badge('d')]} onDismiss={() => {}} />)

    expect(screen.getByRole('button', { name: /Badge unlocked: Badge a/ })).toBeInTheDocument()
    // The cards behind are empty edges, hidden from assistive tech: three cards in all, one readable.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(container.querySelectorAll('button')).toHaveLength(3)
    expect(screen.queryByText(/Badge b/)).not.toBeInTheDocument()
  })

  it('counts down the front toast only, quicker while others wait', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<BadgeUnlockToast badges={[badge('a'), badge('b')]} onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('a')

    rerender(<BadgeUnlockToast badges={[badge('b')]} onDismiss={onDismiss} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onDismiss).not.toHaveBeenCalledWith('b')
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onDismiss).toHaveBeenCalledWith('b')
  })

  it('sends the front toast away on a tap', () => {
    const onDismiss = vi.fn()
    render(<BadgeUnlockToast badges={[badge('a'), badge('b')]} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /Badge a/ }))

    expect(onDismiss).toHaveBeenCalledWith('a')
  })
})
