import { act, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Card } from '../ui/Card'

const vibrate = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/useHaptics', () => ({ useHaptics: () => vibrate }))

const waterCard = (complete: boolean) => (
  <Card complete={complete} cheer="Fully hydrated!">
    Water
  </Card>
)

describe('Card completion celebration', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    vibrate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays quiet when it mounts already complete', () => {
    render(waterCard(true))
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('cheers and buzzes when it switches to complete, then clears the cheer', async () => {
    // Only the hide timer is faked; Framer's frame loop needs real frames to finish the exit.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { rerender } = render(waterCard(false))
    rerender(waterCard(true))

    expect(screen.getByRole('status')).toHaveTextContent('Fully hydrated!')
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(20)

    act(() => vi.advanceTimersByTime(3000))
    vi.useRealTimers()
    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
  })

  it('drops the cheer and badge at once when the task is undone', async () => {
    const { rerender } = render(waterCard(false))
    rerender(waterCard(true))
    rerender(waterCard(false))

    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })
})
