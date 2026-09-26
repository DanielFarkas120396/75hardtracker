import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 25, 21, 14, 50))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('returns the minutes since local midnight', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe(21 * 60 + 14)
  })

  it('keeps ticking while the app stays open', () => {
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current).toBe(21 * 60 + 15)
  })

  it('re-checks the time when the app becomes visible again', () => {
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 25, 23, 5))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(23 * 60 + 5)
  })

  it('can be frozen with ?now= in development', () => {
    window.history.replaceState(null, '', '/?now=22:30')
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe(22 * 60 + 30)
  })
})
