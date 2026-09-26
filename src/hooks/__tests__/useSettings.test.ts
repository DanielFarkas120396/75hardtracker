import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/db'
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

  it('is not loaded on the first render, and becomes loaded once the stored value is read', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '21:45')
    const { result } = renderHook(() => useSettings())
    expect(result.current.bedtimeLoaded).toBe(false)
    await waitFor(() => expect(result.current.bedtimeLoaded).toBe(true))
  })

  it('treats a settings row with no value as loaded, falling back to 23:00', async () => {
    // An import can leave a row like this: validation only checks `key` (see exportImport.ts).
    await db.settings.put({ key: SETTING_KEYS.bedtime, value: undefined })
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtimeLoaded).toBe(true))
    expect(result.current.bedtime).toBe('23:00')
  })

  it('falls back to 23:00 for a stored value it cannot use', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '03:00')
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.bedtimeLoaded).toBe(true))
    expect(result.current.bedtime).toBe('23:00')
  })

  it('saves a bedtime in range and refuses one out of range', async () => {
    const { result } = renderHook(() => useSettings())
    await act(() => result.current.setBedtime('22:30'))
    await waitFor(() => expect(result.current.bedtime).toBe('22:30'))

    await act(() => result.current.setBedtime('17:00'))
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, null)).toBe('22:30')
  })
})
