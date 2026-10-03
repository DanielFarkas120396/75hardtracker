import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const foldingCard = (complete: boolean) => (
  <Card complete={complete} cheer="Fully hydrated!" title="Water" icon="water" summary="3.8 L">
    <button type="button">+ 250 ml</button>
  </Card>
)

describe('Card folding', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an unfinished task open, with its title', () => {
    render(foldingCard(false))
    expect(screen.getByRole('heading', { name: 'Water' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 250 ml' })).toBeInTheDocument()
  })

  it('folds a done task into one line that opens again on tap', () => {
    render(foldingCard(true))
    const header = screen.getByRole('button', { name: /Water/ })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(header).toHaveTextContent('3.8 L')
    expect(screen.queryByRole('button', { name: '+ 250 ml' })).not.toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '+ 250 ml' })).toBeInTheDocument()
  })

  it('folds a task just done only after its cheer, and opens it again when undone', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { rerender } = render(foldingCard(false))
    rerender(foldingCard(true))
    expect(screen.getByRole('button', { name: '+ 250 ml' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('button', { name: '+ 250 ml' })).not.toBeInTheDocument()

    rerender(foldingCard(false))
    expect(screen.getByRole('button', { name: '+ 250 ml' })).toBeInTheDocument()
  })
})
