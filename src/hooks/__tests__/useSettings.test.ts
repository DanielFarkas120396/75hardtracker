import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import { useSettings } from '../useSettings'

describe('useSettings: bedtime', () => {
  beforeEach(freshDatabase)

  it('loads a saved bedtime', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '21:45')
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtime).toBe('21:45'))
  })

  it('falls back to 23:00 for a stored value it cannot use', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '03:00')
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtime).toBe('23:00'))
  })

  it('saves a bedtime in range and refuses one out of range', async () => {
    const { result } = renderHook(() => useSettings())
    await act(() => result.current.setBedtime('22:30'))
    await waitFor(() => expect(result.current.bedtime).toBe('22:30'))

    await act(() => result.current.setBedtime('17:00'))
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, null)).toBe('22:30')
  })
})
