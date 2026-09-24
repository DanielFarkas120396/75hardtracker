import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToday } from '../useToday'

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 24, 23, 59, 30))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns today's local date", () => {
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-09-24')
  })

  it('rolls over at local midnight while the app stays open', () => {
    const { result } = renderHook(() => useToday())
    act(() => {
      vi.advanceTimersByTime(29_000)
    })
    expect(result.current).toBe('2026-09-24')

    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current).toBe('2026-09-25')
  })

  it('keeps rolling over on following nights', () => {
    const { result } = renderHook(() => useToday())
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 31_000)
    })
    expect(result.current).toBe('2026-09-26')
  })

  it('re-checks the date when the app becomes visible again', () => {
    const { result } = renderHook(() => useToday())
    act(() => {
      // The phone slept through two midnights without the timer firing.
      vi.setSystemTime(new Date(2026, 8, 27, 8, 0))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-09-27')
  })

  it('re-checks the date when the window regains focus', () => {
    const { result } = renderHook(() => useToday())
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 25, 7, 0))
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe('2026-09-25')
  })
})
