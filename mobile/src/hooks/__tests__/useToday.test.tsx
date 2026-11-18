import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { useToday } from '../useToday'

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 0, 10, 23, 59, 50) })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('gives today’s date', async () => {
  const { result } = await renderHook(() => useToday())
  expect(result.current).toBe('2026-01-10')
})

it('moves to the next day at midnight, and again the midnight after', async () => {
  const { result } = await renderHook(() => useToday())
  await act(async () => {
    jest.advanceTimersByTime(11_000)
  })
  expect(result.current).toBe('2026-01-11')
  await act(async () => {
    jest.advanceTimersByTime(24 * 60 * 60 * 1000)
  })
  expect(result.current).toBe('2026-01-12')
})

it('catches up when the app comes back to the front on a later day', async () => {
  let onChange: (state: AppStateStatus) => void = () => {}
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onChange = listener
    return { remove: jest.fn() } as never
  })
  const { result } = await renderHook(() => useToday())
  // The phone slept through midnight: timers didn't run, the clock moved on.
  jest.setSystemTime(new Date(2026, 0, 13, 8, 0, 0))
  await act(async () => {
    onChange('active')
  })
  expect(result.current).toBe('2026-01-13')
})
