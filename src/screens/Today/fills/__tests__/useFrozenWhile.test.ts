import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFrozenWhile } from '../useFrozenWhile'

describe('useFrozenWhile', () => {
  it('keeps the value from before the freeze, and follows again after', () => {
    const { result, rerender } = renderHook(({ frozen, value }) => useFrozenWhile(frozen, value), { initialProps: { frozen: false, value: 1 } })
    expect(result.current).toBe(1)
    rerender({ frozen: true, value: 2 })
    expect(result.current).toBe(1)
    rerender({ frozen: true, value: 3 })
    expect(result.current).toBe(1)
    rerender({ frozen: false, value: 3 })
    expect(result.current).toBe(3)
  })
})
