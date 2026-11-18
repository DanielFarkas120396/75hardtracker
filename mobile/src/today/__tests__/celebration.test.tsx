import type { ChallengeGate } from '@logic/challengeGate'
import { SETTING_KEYS } from '@logic/settingKeys'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo } from 'react-native'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { useDayCompleteCelebration, type DayCelebration } from '../../hooks/useDayCompleteCelebration'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { setBoardBusy, setBoardPaused, useSettledCelebration } from '../boardSettle'
import { DayCompleteCelebration } from '../DayCompleteCelebration'
import { Providers } from './support'

const mockPlay = jest.fn()
jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true, null]), isLoaded: jest.fn(() => true) }))
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(async () => {}), NotificationFeedbackType: { Success: 'success' } }))
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn(async () => {}) }),
  setAudioModeAsync: jest.fn(async () => {}),
}))
jest.mock('../../components/mascot/Mascot', () => ({ Mascot: () => null }))

/** A running attempt on Day `today`, with these days complete (the day before each counts as a streak). */
function gate(today: number, done: number[], late: number | null = null, challengeId = 1): ChallengeGate {
  const days = [...new Set([...done, today, ...(late === null ? [] : [late])])]
  return {
    kind: 'active',
    challenge: { id: challengeId },
    todayDayNumber: today,
    lateDayNumber: late,
    dayEntries: days.map((dayNumber) => ({ dayNumber, completed: done.includes(dayNumber) })),
    daySummaries: days.map((dayNumber) => ({ dayNumber, completed: done.includes(dayNumber) })),
  } as unknown as ChallengeGate
}

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  mockPlay.mockClear()
  setBoardBusy(false)
  setBoardPaused(false)
  await freshDatabase()
})

const flags = globalThis as { __SKIP_ANIMATIONS__?: boolean }

afterEach(() => {
  flags.__SKIP_ANIMATIONS__ = true
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('when a day is complete', () => {
  it('celebrates the moment today flips to complete, never a day that was already done when the app opened', async () => {
    const hook = await renderHook(({ g }: { g: ChallengeGate | undefined }) => useDayCompleteCelebration(g), { initialProps: { g: undefined as ChallengeGate | undefined } })
    await hook.rerender({ g: gate(4, [3, 4]) })
    expect(hook.result.current.celebration).toBeNull()

    const fresh = await renderHook(({ g }: { g: ChallengeGate }) => useDayCompleteCelebration(g), { initialProps: { g: gate(4, [2, 3]) } })
    expect(fresh.result.current.celebration).toBeNull()
    await fresh.rerender({ g: gate(4, [2, 3, 4]) })
    expect(fresh.result.current.celebration).toEqual({ dayNumber: 4, streak: 3, isFinalDay: false, late: false })
  })

  it('celebrates a day once: unticking and re-ticking a task doesn’t bring it back', async () => {
    const hook = await renderHook(({ g }: { g: ChallengeGate }) => useDayCompleteCelebration(g), { initialProps: { g: gate(4, []) } })
    await hook.rerender({ g: gate(4, [4]) })
    expect(hook.result.current.celebration?.dayNumber).toBe(4)
    await act(async () => hook.result.current.dismiss())
    expect(hook.result.current.celebration).toBeNull()
    await hook.rerender({ g: gate(4, []) })
    await hook.rerender({ g: gate(4, [4]) })
    expect(hook.result.current.celebration).toBeNull()
  })

  it('drops a celebration whose day is undone while it still waits for the last chip', async () => {
    const hook = await renderHook(({ g }: { g: ChallengeGate }) => useDayCompleteCelebration(g), { initialProps: { g: gate(4, []) } })
    await hook.rerender({ g: gate(4, [4]) })
    await hook.rerender({ g: gate(4, []) })
    expect(hook.result.current.celebration).toBeNull()
    // Never seen, so finishing again does celebrate.
    await hook.rerender({ g: gate(4, [4]) })
    expect(hook.result.current.celebration?.dayNumber).toBe(4)
  })

  it('says a day finished the morning after is late, and knows the last day', async () => {
    const late = await renderHook(({ g }: { g: ChallengeGate }) => useDayCompleteCelebration(g), { initialProps: { g: gate(5, [3], 4) } })
    await late.rerender({ g: gate(5, [3, 4], 4) })
    expect(late.result.current.celebration).toEqual({ dayNumber: 4, streak: 2, isFinalDay: false, late: true })

    const last = await renderHook(({ g }: { g: ChallengeGate }) => useDayCompleteCelebration(g), { initialProps: { g: gate(75, [74]) } })
    await last.rerender({ g: gate(75, [74, 75]) })
    expect(last.result.current.celebration).toMatchObject({ dayNumber: 75, isFinalDay: true })
  })

  it('waits for the board’s last chip to land, five seconds at most', async () => {
    jest.useFakeTimers()
    const day: DayCelebration = { dayNumber: 4, streak: 1, isFinalDay: false, late: false }
    await act(async () => setBoardBusy(true))
    const hook = await renderHook(({ value }: { value: DayCelebration | null }) => useSettledCelebration(value), { initialProps: { value: null as DayCelebration | null } })
    await hook.rerender({ value: day })
    expect(hook.result.current).toBeNull()
    await act(async () => void jest.advanceTimersByTime(2000))
    expect(hook.result.current).toBeNull()
    await act(async () => setBoardBusy(false))
    expect(hook.result.current).toBe(day)

    // A board that never settles doesn't hold the day's end back for ever.
    const other: DayCelebration = { ...day, dayNumber: 5 }
    await act(async () => setBoardBusy(true))
    await hook.rerender({ value: other })
    await act(async () => void jest.advanceTimersByTime(4999))
    expect(hook.result.current).toBeNull()
    await act(async () => void jest.advanceTimersByTime(1))
    expect(hook.result.current).toBe(other)
  })
})

describe('a day finished inside a sheet that stays open', () => {
  it('keeps the peak back for as long as the sheet covers the board: it would play unseen under it', async () => {
    jest.useFakeTimers()
    const day: DayCelebration = { dayNumber: 4, streak: 1, isFinalDay: false, late: false }
    // The second workout reaches 45 minutes in the workouts sheet, which stays open for the feel.
    await act(async () => {
      setBoardPaused(true)
      setBoardBusy(true)
    })
    const hook = await renderHook(({ value }: { value: DayCelebration | null }) => useSettledCelebration(value), { initialProps: { value: null as DayCelebration | null } })
    await hook.rerender({ value: day })
    await act(async () => void jest.advanceTimersByTime(60_000))
    expect(hook.result.current).toBeNull()

    // The sheet closes: the chip lands, and the peak follows.
    await act(async () => setBoardPaused(false))
    expect(hook.result.current).toBeNull()
    await act(async () => setBoardBusy(false))
    expect(hook.result.current).toBe(day)
  })

  it('gives the board its five seconds once the sheet has closed', async () => {
    jest.useFakeTimers()
    const day: DayCelebration = { dayNumber: 4, streak: 1, isFinalDay: false, late: false }
    await act(async () => {
      setBoardPaused(true)
      setBoardBusy(true)
    })
    const hook = await renderHook(({ value }: { value: DayCelebration | null }) => useSettledCelebration(value), { initialProps: { value: null as DayCelebration | null } })
    await hook.rerender({ value: day })
    await act(async () => void jest.advanceTimersByTime(8000))
    await act(async () => setBoardPaused(false))
    await act(async () => void jest.advanceTimersByTime(4999))
    expect(hook.result.current).toBeNull()
    await act(async () => void jest.advanceTimersByTime(1))
    expect(hook.result.current).toBe(day)
  })
})

describe('the day-complete peak', () => {
  const show = (celebration: DayCelebration, onDismiss = jest.fn()) => render(<DayCompleteCelebration celebration={celebration} onDismiss={onDismiss} />, { wrapper: Providers })
  const stone = (day: number) => screen.queryByTestId(`stone-${day}`, { includeHiddenElements: true })?.props.accessibilityLabel

  it('says the day is done, how many are left, and the streak once it is worth saying', async () => {
    const onDismiss = jest.fn()
    await show({ dayNumber: 12, streak: 3, isFinalDay: false, late: false }, onDismiss)
    expect(await screen.findByLabelText('Day 12 done.')).toBeOnTheScreen()
    expect(screen.getByText('One more stone. 63 to go.')).toBeOnTheScreen()
    expect(screen.getByLabelText('3 day streak')).toBeOnTheScreen()
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1))
    await fireEvent.press(screen.getByRole('button', { name: 'Nice!' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has its own words for a late day and for the last one, and no streak line at 1', async () => {
    const late = await show({ dayNumber: 4, streak: 1, isFinalDay: false, late: true })
    expect(await screen.findByText('Logged just in time. The streak lives. Now go get today.')).toBeOnTheScreen()
    expect(screen.queryByText('day streak')).toBeNull()
    await late.unmount()
    await show({ dayNumber: 75, streak: 75, isFinalDay: true, late: false })
    expect(await screen.findByText('That was the last one. All 75 days, every task, every day.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'See your victory' })).toBeOnTheScreen()
  })

  it('lights today’s stone in gold on the climb, between the days won and the ones ahead', async () => {
    flags.__SKIP_ANIMATIONS__ = false
    jest.useFakeTimers()
    await show({ dayNumber: 12, streak: 2, isFinalDay: false, late: false })
    await act(async () => {})
    expect(stone(12)).toBe('Day 12, today')
    expect(screen.queryByTestId('won-ring', { includeHiddenElements: true })).toBeNull()
    await act(async () => void jest.advanceTimersByTime(900))
    expect(stone(12)).toBe('Day 12, completed')
    expect(screen.getByTestId('won-ring', { includeHiddenElements: true })).toBeOnTheScreen()
    // The streak covers yesterday; the day before was forgiven with a joker; the days ahead are locked.
    expect(stone(11)).toBe('Day 11, completed')
    expect(stone(10)).toBe('Day 10, forgiven with a joker')
    expect(stone(13)).toBe('Day 13, not reached yet')
    expect(stone(14)).toBe('Day 14, not reached yet')
  })

  it('reads only its words: the stones are for the eyes', async () => {
    await show({ dayNumber: 12, streak: 12, isFinalDay: false, late: false })
    await screen.findByLabelText('Day 12 done.')
    for (const day of [10, 11, 12, 13, 14]) {
      expect(screen.queryByTestId(`stone-${day}`)).toBeNull()
      expect(screen.getByTestId(`stone-${day}`, { includeHiddenElements: true })).toBeOnTheScreen()
    }
    expect(screen.getByLabelText('12 day streak')).toBeOnTheScreen()
  })

  it('stops at the ends of the climb', async () => {
    const first = await show({ dayNumber: 1, streak: 1, isFinalDay: false, late: false })
    await screen.findByLabelText('Day 1 done.')
    expect(stone(0)).toBeUndefined()
    expect(stone(3)).toBe('Day 3, not reached yet')
    await first.unmount()
    await show({ dayNumber: 75, streak: 3, isFinalDay: true, late: false })
    await screen.findByLabelText('Day 75 done.')
    expect(stone(76)).toBeUndefined()
    expect(stone(73)).toBe('Day 73, completed')
  })

  it('opens on its end state under reduce motion: the stone won, its ring on, long after the app learned the setting', async () => {
    // Animations are on, as on a phone: only Reduce Motion holds them back.
    flags.__SKIP_ANIMATIONS__ = false
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    const Host = ({ celebration }: { celebration: DayCelebration | null }) => {
      // The app's root asks the phone at launch (AppGate).
      useReduceMotion()
      return <DayCompleteCelebration celebration={celebration} onDismiss={jest.fn()} />
    }
    const view = await render(<Host celebration={null} />, { wrapper: Providers })
    await act(async () => {})
    await view.rerender(<Host celebration={{ dayNumber: 12, streak: 2, isFinalDay: false, late: false }} />)
    await act(async () => {})
    expect(stone(12)).toBe('Day 12, completed')
    expect(screen.getByTestId('won-ring', { includeHiddenElements: true })).toBeOnTheScreen()
  })

  it('shows the end state at once under reduce motion, and stays quiet when sounds are off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
    // The overlay's host is there long before a day is won, as on Today.
    const view = await render(<DayCompleteCelebration celebration={null} onDismiss={jest.fn()} />, { wrapper: Providers })
    await act(async () => {})
    await view.rerender(<DayCompleteCelebration celebration={{ dayNumber: 12, streak: 2, isFinalDay: false, late: false }} onDismiss={jest.fn()} />)
    await waitFor(() => expect(stone(12)).toBe('Day 12, completed'))
    expect(mockPlay).not.toHaveBeenCalled()
  })
})
