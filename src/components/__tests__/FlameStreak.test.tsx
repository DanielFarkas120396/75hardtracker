import { render, screen, waitFor } from '@testing-library/react'
import { MotionConfig } from 'framer-motion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FlameStreak } from '../FlameStreak'

// The Lottie player needs a real browser, so a stand-in records what it's asked to do.
const { flame, loadAnimation } = vi.hoisted(() => {
  const flame = { play: vi.fn(), goToAndStop: vi.fn(), destroy: vi.fn() }
  return { flame, loadAnimation: vi.fn(() => flame) }
})
vi.mock('lottie-web/build/player/lottie_light', () => ({ default: { loadAnimation } }))

describe('FlameStreak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('names the streak for screen readers and shows the emoji until the flame loads', () => {
    render(<FlameStreak streak={12} />)
    expect(screen.getByRole('img', { name: 'Streak: 12 days' })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('says "day" for a streak of one', () => {
    render(<FlameStreak streak={1} />)
    expect(screen.getByRole('img', { name: 'Streak: 1 day' })).toBeInTheDocument()
  })

  it('loads the fire animation and plays it while the streak is alive', async () => {
    render(<FlameStreak streak={12} />)
    await waitFor(() => expect(flame.play).toHaveBeenCalled())
    expect(loadAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: expect.objectContaining({ nm: 'emoji_u1F525' }),
      }),
    )
    expect(flame.goToAndStop).not.toHaveBeenCalled()
    expect(screen.queryByText('🔥')).not.toBeInTheDocument()
  })

  it('holds a still, greyed-out flame when there is no streak', async () => {
    render(<FlameStreak streak={0} />)
    await waitFor(() => expect(flame.goToAndStop).toHaveBeenCalled())
    expect(flame.play).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'Streak: 0 days' }).querySelector('.grayscale')).not.toBeNull()
  })

  it('holds still under reduced motion', async () => {
    render(
      <MotionConfig reducedMotion="always">
        <FlameStreak streak={12} />
      </MotionConfig>,
    )
    await waitFor(() => expect(flame.goToAndStop).toHaveBeenCalled())
    expect(flame.play).not.toHaveBeenCalled()
  })

  it('goes out when the streak drops to 0, and burns again when it restarts', async () => {
    const { rerender } = render(<FlameStreak streak={12} />)
    await waitFor(() => expect(flame.play).toHaveBeenCalledTimes(1))

    rerender(<FlameStreak streak={0} />)
    expect(flame.goToAndStop).toHaveBeenCalledTimes(1)

    rerender(<FlameStreak streak={1} />)
    expect(flame.play).toHaveBeenCalledTimes(2)
  })

  it('destroys the animation when it unmounts', async () => {
    const { unmount } = render(<FlameStreak streak={12} />)
    await waitFor(() => expect(loadAnimation).toHaveBeenCalled())
    unmount()
    expect(flame.destroy).toHaveBeenCalled()
  })

  it('never builds the animation when it unmounts before the player has loaded', async () => {
    const { unmount } = render(<FlameStreak streak={12} />)
    unmount()
    // Let the pending dynamic imports settle.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(loadAnimation).not.toHaveBeenCalled()
  })
})
