import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOLD_MS, HoldButton } from '../HoldButton'

const button = () => screen.getByRole('button', { name: 'Hold to commit' })

describe('HoldButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits once the press has lasted long enough, and its trailing click does nothing more', () => {
    const onCommit = vi.fn()
    render(<HoldButton onCommit={onCommit}>Hold to commit</HoldButton>)

    fireEvent.pointerDown(button(), { button: 0 })
    act(() => vi.advanceTimersByTime(HOLD_MS - 1))
    expect(onCommit).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    fireEvent.pointerUp(button())
    fireEvent.click(button(), { detail: 1 })
    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('does nothing on a tap or an early release, and says to keep holding', () => {
    const onCommit = vi.fn()
    render(
      <HoldButton onCommit={onCommit} hint="Hold for 1 second to sign.">
        Hold to commit
      </HoldButton>,
    )

    fireEvent.pointerDown(button(), { button: 0 })
    act(() => vi.advanceTimersByTime(HOLD_MS / 2))
    fireEvent.pointerUp(button())
    fireEvent.click(button(), { detail: 1 })
    act(() => vi.advanceTimersByTime(HOLD_MS))

    expect(onCommit).not.toHaveBeenCalled()
    expect(button()).toHaveAccessibleDescription('Keep holding.')

    fireEvent.pointerDown(button(), { button: 0 }) // the next press clears it
    expect(button()).toHaveAccessibleDescription('Hold for 1 second to sign.')
  })

  it('keeps holding when the finger drifts off the button', () => {
    const onCommit = vi.fn()
    render(<HoldButton onCommit={onCommit}>Hold to commit</HoldButton>)

    fireEvent.pointerDown(button(), { button: 0 })
    fireEvent.pointerLeave(button())
    act(() => vi.advanceTimersByTime(HOLD_MS))

    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('commits at once from a keyboard or assistive tech: a click no press started, whatever its detail', () => {
    const onCommit = vi.fn()
    render(<HoldButton onCommit={onCommit}>Hold to commit</HoldButton>)

    fireEvent.click(button(), { detail: 0 })
    fireEvent.click(button(), { detail: 1 }) // iOS VoiceOver may report 1

    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('does nothing while disabled, and describes itself with the hint', () => {
    const onCommit = vi.fn()
    render(
      <HoldButton onCommit={onCommit} disabled hint="Press and hold to sign.">
        Hold to commit
      </HoldButton>,
    )

    expect(button()).toHaveAccessibleDescription('Press and hold to sign.')
    fireEvent.click(button(), { detail: 0 })
    expect(onCommit).not.toHaveBeenCalled()
  })
})
