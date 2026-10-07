import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHEER_VISIBLE_MS, TaskSheet, type TaskSheetContent } from '../TaskSheet'

function water(complete: boolean, closesWhenDone = true): TaskSheetContent {
  return {
    task: 'water',
    ruleLine: 'Goal: 3.8 L a day.',
    complete,
    cheer: 'Fully hydrated! 💧',
    closesWhenDone,
    body: <button type="button">+ 250 ml</button>,
  }
}

describe('TaskSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    // Only the close timer is faked; Framer's frame loop needs real frames.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the task, its rule and its controls, and closes from its button', () => {
    const onClose = vi.fn()
    render(<TaskSheet content={water(false)} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Water' })).toBeInTheDocument()
    expect(screen.getByText('Goal: 3.8 L a day.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 250 ml' })).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cheers but stays open when there is still something to add once done', () => {
    const onClose = vi.fn()
    const { rerender } = render(<TaskSheet content={water(false, false)} onClose={onClose} />)
    rerender(<TaskSheet content={water(true, false)} onClose={onClose} />)

    expect(screen.getByRole('status')).toHaveTextContent('Fully hydrated! 💧')
    act(() => vi.advanceTimersByTime(CHEER_VISIBLE_MS * 2))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cheers and closes itself when the task completes inside it', () => {
    const onClose = vi.fn()
    const { rerender } = render(<TaskSheet content={water(false)} onClose={onClose} />)
    rerender(<TaskSheet content={water(true)} onClose={onClose} />)

    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Fully hydrated! 💧')
    expect(onClose).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(CHEER_VISIBLE_MS))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens quietly on a task already done, and stays open', () => {
    const onClose = vi.fn()
    render(<TaskSheet content={water(true)} onClose={onClose} />)

    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    act(() => vi.advanceTimersByTime(CHEER_VISIBLE_MS * 2))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('drops the tick and the cheer, and stays open, when the task is undone again', () => {
    const onClose = vi.fn()
    const { rerender } = render(<TaskSheet content={water(false)} onClose={onClose} />)
    rerender(<TaskSheet content={water(true)} onClose={onClose} />)
    rerender(<TaskSheet content={water(false)} onClose={onClose} />)

    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(CHEER_VISIBLE_MS * 2))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps showing the last task while it slides away', async () => {
    const { rerender } = render(<TaskSheet content={water(false)} onClose={() => {}} />)
    rerender(<TaskSheet content={null} onClose={() => {}} />)
    // Nothing throws on the way out, and the sheet is gone once the exit finishes.
    vi.useRealTimers()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
