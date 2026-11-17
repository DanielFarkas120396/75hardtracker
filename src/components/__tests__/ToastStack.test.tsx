import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastStack, type Toast } from '../ToastStack'

const toast = (id: string, extra: Partial<Toast> = {}): Toast => ({ id, title: `Toast ${id}`, detail: `About ${id}.`, durationMs: 4500, ...extra })

describe('ToastStack', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the first toast in front and two more peeking out behind, as empty edges', () => {
    const { container } = render(<ToastStack toasts={[toast('a'), toast('b'), toast('c'), toast('d')]} onDismiss={() => {}} />)

    expect(screen.getByRole('button', { name: /Toast a/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(container.querySelectorAll('button')).toHaveLength(3)
    expect(screen.queryByText(/Toast b/)).not.toBeInTheDocument()
  })

  it('counts down the front toast only, quicker while others wait', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<ToastStack toasts={[toast('a'), toast('b')]} onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('a')

    rerender(<ToastStack toasts={[toast('b')]} onDismiss={onDismiss} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onDismiss).not.toHaveBeenCalledWith('b')
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onDismiss).toHaveBeenCalledWith('b')
  })

  it('restarts the front toast when it fires again', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<ToastStack toasts={[toast('e', { durationMs: 6000, stamp: 1 })]} onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    rerender(<ToastStack toasts={[toast('e', { durationMs: 6000, stamp: 2 })]} onDismiss={onDismiss} />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onDismiss).toHaveBeenCalledWith('e')
  })

  it('sends the front toast away on a tap', () => {
    const onDismiss = vi.fn()
    render(<ToastStack toasts={[toast('a'), toast('b')]} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /Toast a/ }))

    expect(onDismiss).toHaveBeenCalledWith('a')
  })

  it('announces an error at once', () => {
    render(<ToastStack toasts={[toast('err', { title: "Couldn't save that", error: true })]} onDismiss={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save that")
  })
})
