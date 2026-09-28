import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addDaysISO } from '../../lib/dates'
import { useStartDateChoice } from '../useStartDateChoice'

const today = '2026-09-28'

describe('useStartDateChoice', () => {
  it('starts today by default', () => {
    const { result } = renderHook(() => useStartDateChoice(today))
    expect(result.current).toMatchObject({ choice: 'today', startDate: today, dateError: null })
  })

  it('starts tomorrow, or on a picked date', () => {
    const { result } = renderHook(() => useStartDateChoice(today))

    act(() => result.current.setChoice('tomorrow'))
    expect(result.current.startDate).toBe(addDaysISO(today, 1))

    act(() => {
      result.current.setChoice('pick')
      result.current.setPickedDate('2026-10-05')
    })
    expect(result.current).toMatchObject({ startDate: '2026-10-05', dateError: null })
  })

  it('refuses a picked date in the past, or none at all', () => {
    const { result } = renderHook(() => useStartDateChoice(today))

    act(() => {
      result.current.setChoice('pick')
      result.current.setPickedDate('2026-09-27')
    })
    expect(result.current.dateError).toBe("The start can't be in the past.")

    act(() => result.current.setPickedDate(''))
    expect(result.current.dateError).toBe('Pick a start date.')
  })
})
