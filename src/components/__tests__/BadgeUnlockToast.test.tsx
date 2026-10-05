import { act, render, screen } from '@testing-library/react'
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

  it('shows at most two badges at a time, in queue order', () => {
    render(<BadgeUnlockToast badges={[badge('a'), badge('b'), badge('c')]} onDismiss={() => {}} />)

    expect(screen.getByText('Badge unlocked: Badge a')).toBeInTheDocument()
    expect(screen.getByText('Badge unlocked: Badge b')).toBeInTheDocument()
    expect(screen.queryByText('Badge unlocked: Badge c')).not.toBeInTheDocument()
  })

  it('dismisses each toast after a few seconds, and the next one takes its place', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<BadgeUnlockToast badges={[badge('a'), badge('b'), badge('c')]} onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(onDismiss).toHaveBeenCalledWith('a')
    expect(onDismiss).toHaveBeenCalledWith('b')
    expect(onDismiss).not.toHaveBeenCalledWith('c')

    rerender(<BadgeUnlockToast badges={[badge('c')]} onDismiss={onDismiss} />)
    expect(screen.getByText('Badge unlocked: Badge c')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(onDismiss).toHaveBeenCalledWith('c')
  })
})
