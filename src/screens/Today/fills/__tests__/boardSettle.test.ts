import { act, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setBoardBusy, useSettledCelebration } from '../boardSettle'

describe('useSettledCelebration', () => {
  afterEach(() => {
    act(() => setBoardBusy(false))
    vi.useRealTimers()
  })

  it('shows the celebration at once when the board is settled', () => {
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    expect(result.current).toBe('day 30')
  })

  it('waits for the last chip to land', () => {
    act(() => setBoardBusy(true))
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    expect(result.current).toBeNull()
    act(() => setBoardBusy(false))
    expect(result.current).toBe('day 30')
  })

  it('never shows, even for one commit, when the board turns busy in the same commit', () => {
    const shown: (string | null)[] = []
    const { rerender } = renderHook(
      ({ value }: { value: string | null }) => {
        // The board's effect, which runs before the celebration's, as a child's would.
        useEffect(() => setBoardBusy(value !== null), [value])
        shown.push(useSettledCelebration(value))
      },
      { initialProps: { value: null as string | null } },
    )
    rerender({ value: 'day 30' })
    expect(shown).not.toContain('day 30')
  })

  it('waits 4 s at most', () => {
    vi.useFakeTimers()
    act(() => setBoardBusy(true))
    const { result } = renderHook(() => useSettledCelebration('day 30'))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe('day 30')
  })
})
