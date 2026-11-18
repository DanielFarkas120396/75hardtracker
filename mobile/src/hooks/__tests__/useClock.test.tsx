import { act, renderHook } from '@testing-library/react-native'
import { useClock } from '../useClock'

afterEach(() => {
  jest.useRealTimers()
})

it('gives the date and the time of day together, and moves them together at midnight', async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date(2026, 2, 10, 23, 59, 40))
  const seen: { today: string; nowMin: number }[] = []
  const view = await renderHook(() => {
    const clock = useClock()
    seen.push(clock)
    return clock
  })
  expect(view.result.current).toEqual({ today: '2026-03-10', nowMin: 23 * 60 + 59 })

  await act(async () => {
    jest.advanceTimersByTime(25_000)
  })
  expect(view.result.current).toEqual({ today: '2026-03-11', nowMin: 0 })
  // Never the new date with yesterday's last minute: that would read as "past noon, yesterday unfinished".
  expect(seen).not.toContainEqual({ today: '2026-03-11', nowMin: 23 * 60 + 59 })

  // The half-minute tick carries the minutes on.
  await act(async () => {
    jest.advanceTimersByTime(70_000)
  })
  expect(view.result.current).toEqual({ today: '2026-03-11', nowMin: 1 })
})
