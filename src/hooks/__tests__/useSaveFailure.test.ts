import { act, renderHook } from '@testing-library/react'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { useSaveFailure } from '../useSaveFailure'

function unhandledRejection(reason: unknown) {
  const event = new Event('unhandledrejection')
  Object.assign(event, { reason })
  act(() => {
    window.dispatchEvent(event)
  })
}

describe('useSaveFailure', () => {
  it('stays at zero until a write fails', () => {
    const { result } = renderHook(() => useSaveFailure())
    expect(result.current.failures).toBe(0)
  })

  it('counts each time the database refuses a write, until dismissed', () => {
    const { result } = renderHook(() => useSaveFailure())
    unhandledRejection(new Dexie.QuotaExceededError('full'))
    unhandledRejection(new Dexie.QuotaExceededError('full'))
    expect(result.current.failures).toBe(2)

    act(() => result.current.dismiss())
    expect(result.current.failures).toBe(0)
  })

  it('counts a full disk reported by the browser', () => {
    const { result } = renderHook(() => useSaveFailure())
    unhandledRejection(new DOMException('full', 'QuotaExceededError'))
    expect(result.current.failures).toBe(1)
  })

  it('ignores failures that have nothing to do with saving', () => {
    const { result } = renderHook(() => useSaveFailure())
    unhandledRejection(new Error('audio is locked'))
    expect(result.current.failures).toBe(0)
  })
})
