// How an attempt ends, as the app shows it: Today picks the screen from the gate (the web's App.tsx), Settings has
// the way to give up. The seven cases of the plan's Review Focus (docs/superpowers/plans/2026-11-18-v4-part-4d-endings.md).
import { addDaysISO } from '@logic/dates'
import type { ChallengeVariant } from '@logic/rulesets'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo, Text } from 'react-native'
import { addChallenge, addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useGate } from '../../hooks/useChallengeGate'
import { useClock } from '../../hooks/useClock'
import { useNowMinutes } from '../../hooks/useNowMinutes'
import { useTabBarHidden } from '../../hooks/useTabBar'
import { useToday } from '../../hooks/useToday'
import { Providers, TODAY } from '../../today/__tests__/support'
import { ScreenFocusContext } from '../../today/TaskBoard'
import { Today } from '../../today/TodayScreen'
import { GiveUpSetting } from '../GiveUpFlow'

const mockPlay = jest.fn()
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn(async () => {}) }),
  setAudioModeAsync: jest.fn(async () => {}),
}))
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { CameraView: View, useCameraPermissions: () => [{ granted: true }, jest.fn(), jest.fn()] }
})
// The phone's own pickers are native views: a plain view stands in.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))
jest.mock('../../today/MenaceAtmosphere', () => ({ MenaceAtmosphere: () => null }))
jest.mock('../../hooks/useClock', () => ({ useClock: jest.fn() }))
jest.mock('../../hooks/useNowMinutes', () => ({ useNowMinutes: jest.fn() }))
jest.mock('../../hooks/useToday', () => ({ useToday: jest.fn() }))
jest.mock('../../today/photo', () => ({ prepareShot: jest.fn() }))
// The duck redraws every frame (he has his own tests): here a line of text says which mood he is in.
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood }: { mood: string }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}`}</Line>
  },
}))
// Pictures go to a folder on this computer.
jest.mock('../../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../../files/__tests__/nodeStore')>('../../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'endings-'))) }
})

const MORNING = 10 * 60
const AFTERNOON = 13 * 60
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility)

/** Sets the date and the time of day everywhere the app reads them. */
function setClock(today: string, nowMin: number) {
  jest.mocked(useClock).mockReturnValue({ today, nowMin })
  jest.mocked(useToday).mockReturnValue(today)
  jest.mocked(useNowMinutes).mockReturnValue(nowMin)
}

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  announce.mockClear()
  mockPlay.mockClear()
  setClock(TODAY, AFTERNOON)
  await freshDatabase()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

/** What the tabs' layout reads: whether something on screen wants the tab bar out of the way (it then brings Today forward). */
function TabBar() {
  return <Text>{useTabBarHidden() ? 'tab bar: hidden' : 'tab bar: shown'}</Text>
}
const app = () => (
  <>
    <Today />
    <TabBar />
  </>
)
const show = () => render(app(), { wrapper: Providers })
const tabBar = () => screen.getByText(/^tab bar: /).props.children
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }))
const attempts = () => challengeRepo.getAll()
const stored = async (id: number) => (await challengeRepo.getById(id))!

/** A player with a profile and an attempt whose Day `day` is today, its first `perfect` days done. */
async function attempt(day: number, variant: ChallengeVariant = 'hard', perfect = 0): Promise<number> {
  const startDate = addDaysISO(TODAY, 1 - day)
  const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant })
  if (perfect > 0) await addPerfectDays(challengeId, startDate, 1, perfect)
  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  return challengeId
}

describe('a missed day with no joker left', () => {
  it('opens on what the day lacked, never on Today, and restarts from Day 1 with the same challenge', async () => {
    const createsToday = jest.spyOn(dayEntryRepo, 'getOrCreate')
    const challengeId = await attempt(3, 'strong', 1)
    await show()

    expect(await screen.findByRole('header', { name: "Day 2 wasn't completed" })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith("Day 2 wasn't completed")
    expect(screen.getByText('75 Strong is all-or-nothing on every task, every day. This attempt (#1) ends here — but every photo and stat you logged is saved for good.')).toBeOnTheScreen()
    expect(await screen.findAllByText(/^✕ /)).toHaveLength(5)
    expect(screen.getByText('You said: “A fresh start”')).toBeOnTheScreen()
    expect(screen.getByText("Again, Daniel. From Day 1. I'm watching.")).toBeOnTheScreen()
    // Today never showed behind it: it would have opened today's entry.
    expect(screen.queryByLabelText(/^Day 3, /)).toBeNull()
    expect(createsToday).not.toHaveBeenCalled()
    // It takes the whole app: the tab bar steps aside (and the layout brings Today forward).
    expect(tabBar()).toBe('tab bar: hidden')

    await press('Restart from Day 1')
    expect(await screen.findByLabelText('Day 1, 75 Strong #2')).toBeOnTheScreen()
    expect(tabBar()).toBe('tab bar: shown')
    expect(await attempts()).toMatchObject([
      { id: challengeId, status: 'failed', variant: 'strong' },
      { attemptNumber: 2, status: 'active', variant: 'strong', startDate: TODAY },
    ])
    // The old attempt keeps its days.
    expect(await dayEntryRepo.getAllForChallenge(challengeId)).toHaveLength(1)
  })

  it('waits until noon: yesterday can still be finished in the morning', async () => {
    setClock(TODAY, MORNING)
    await attempt(2)
    const view = await show()
    expect(await screen.findByText("Day 1 isn't finished")).toBeOnTheScreen()

    setClock(TODAY, AFTERNOON)
    await view.rerender(app())
    expect(await screen.findByRole('header', { name: "Day 1 wasn't completed" })).toBeOnTheScreen()
    expect(screen.queryByText("Day 1 isn't finished")).toBeNull()
  })
})

describe('a missed day with a joker', () => {
  it('announces the joker once, never Today behind it, and Keep going returns to Today for good', async () => {
    const createsToday = jest.spyOn(dayEntryRepo, 'getOrCreate')
    const challengeId = await attempt(3, 'medium', 1)
    const view = await show()

    expect(await screen.findByRole('header', { name: "Day 2 wasn't completed" })).toBeOnTheScreen()
    expect(await screen.findAllByText(/^✕ /)).toHaveLength(5)
    expect(screen.getByText('Joker used. 0 left.')).toBeOnTheScreen()
    expect(screen.getByText("Your streak starts over. Your challenge doesn't.")).toBeOnTheScreen()
    // The last joker.
    expect(screen.getByText("That was your last joker. Next time, it's Day 1.")).toBeOnTheScreen()
    expect(screen.queryByLabelText(/^Day 3, /)).toBeNull()
    expect(createsToday).not.toHaveBeenCalled()
    expect(tabBar()).toBe('tab bar: hidden')

    // A second tap changes nothing: the button is locked while it saves (two calls at once are the repository's test).
    await press('Keep going')
    const again = screen.queryByRole('button', { name: /^Keep/ })
    if (again) await fireEvent.press(again)
    expect(await screen.findByLabelText('Day 3, 75 Medium #1')).toBeOnTheScreen()
    expect(tabBar()).toBe('tab bar: shown')
    expect(await stored(challengeId)).toMatchObject({ status: 'active', jokersAcknowledged: 1 })
    expect(await attempts()).toHaveLength(1)

    // Opening the app again that day: Today, not the joker.
    await view.unmount()
    await show()
    expect(await screen.findByLabelText('Day 3, 75 Medium #1')).toBeOnTheScreen()
    expect(screen.queryByText(/wasn't completed/)).toBeNull()
  })

  it('names two missed days together', async () => {
    await attempt(4, 'soft', 1)
    await show()

    expect(await screen.findByRole('header', { name: "Days 2 and 3 weren't completed" })).toBeOnTheScreen()
    expect(screen.getByText('2 jokers used. 1 left.')).toBeOnTheScreen()
    expect(screen.getByText("I'll let that one go. Once.")).toBeOnTheScreen()
    expect(screen.getByText('Day 2')).toBeOnTheScreen()
    expect(screen.getByText('Day 3')).toBeOnTheScreen()
    expect(await screen.findAllByText(/^✕ /)).toHaveLength(10)
  })

  it('keeps the day-complete peak back while the joker is announced: no peak over bad news', async () => {
    // Day 2 before noon: Day 1 is still open, and today lacks only its pages.
    setClock(TODAY, MORNING)
    const challengeId = await attempt(2, 'medium')
    await addPerfectDays(challengeId, TODAY, 2, 2)
    const entry = (await dayEntryRepo.getByChallengeAndDayNumber(challengeId, 2))!
    await dayEntryRepo.adjustPages(entry.id, -10)
    const view = await show()
    await press('Add 10 pages')
    expect(await screen.findByLabelText('Day 2 done.', {}, { timeout: 4000 })).toBeOnTheScreen()

    // Noon passes with the peak still up: Day 1 is missed, a joker pays for it.
    setClock(TODAY, AFTERNOON)
    await view.rerender(app())
    expect(await screen.findByRole('header', { name: "Day 1 wasn't completed" })).toBeOnTheScreen()
    expect(screen.queryByLabelText('Day 2 done.')).toBeNull()

    await press('Keep going')
    expect(await screen.findByLabelText('Day 2 done.')).toBeOnTheScreen()
  })
})

describe('giving up', () => {
  const settings = () =>
    render(
      <>
        <Today />
        <GiveUpSetting />
        <TabBar />
      </>,
      { wrapper: Providers },
    )
  const row = () => screen.queryByRole('button', { name: 'Give up this challenge' })

  it('takes four confirmations in Settings, then Today is "You gave up" until a new attempt starts', async () => {
    const challengeId = await attempt(12, 'hard', 11)
    await settings()
    await press('Give up this challenge')

    // Each step's first button leaves.
    expect(await screen.findByRole('header', { name: 'Give up 75 Hard?' })).toBeOnTheScreen()
    await press('Keep going')
    await waitFor(() => expect(screen.queryByText('Give up 75 Hard?')).toBeNull())
    expect((await stored(challengeId)).status).toBe('active')

    // It starts again at step 1.
    await press('Give up this challenge')
    expect(await screen.findByRole('header', { name: 'Give up 75 Hard?' })).toBeOnTheScreen()
    await press('Give up')
    expect(await screen.findByText('🔥 11-day streak · 11 perfect days')).toBeOnTheScreen()
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    await press("I'm sure")
    expect(button('Give up, locked for a few seconds')).toBeDisabled()
    for (let second = 0; second < 5; second++) await act(async () => void jest.advanceTimersByTime(1000))
    jest.useRealTimers()
    await press('Give up')
    await fireEvent.changeText(screen.getByLabelText('Type GIVE UP to confirm'), ' give up')
    await press('Give up for good')

    expect(await screen.findByRole('header', { name: 'You gave up on Day 12' })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('You gave up on Day 12')
    // Given up from the Settings tab: this is what brings Today, and this screen, to the front.
    expect(tabBar()).toBe('tab bar: hidden')
    expect(screen.getByText('75 Hard, attempt #1. It stays in your history.')).toBeOnTheScreen()
    expect(await stored(challengeId)).toMatchObject({ status: 'abandoned', abandonedOn: TODAY })
    // The flow has closed by itself, and there is nothing left to give up.
    await waitFor(() => expect(screen.queryByText('Type GIVE UP to confirm.')).toBeNull())
    expect(row()).toBeNull()

    await press('Start a new challenge')
    expect(await screen.findByRole('radio', { name: /^75 Hard/ })).toBeChecked()
    await fireEvent.press(screen.getByRole('radio', { name: 'Today' }))
    await press('Start')
    expect(await screen.findByLabelText('Day 1, 75 Hard #2')).toBeOnTheScreen()
    expect(tabBar()).toBe('tab bar: shown')
    // The new attempt can be given up in turn, and the flow doesn't open by itself.
    await waitFor(() => expect(row()).not.toBeNull())
    expect(screen.queryByText(/^Give up 75 Hard\?$/)).toBeNull()
    // The old attempt's days stay: eleven done, and the day it was given up on.
    expect(await dayEntryRepo.getAllForChallenge(challengeId)).toHaveLength(12)
  })

  it('is offered only from Day 1 to Day 75 of a running attempt', async () => {
    const challengeId = await attempt(0)
    const view = await settings()
    await screen.findByText('Day 1 starts tomorrow')
    expect(row()).toBeNull()
    await view.unmount()

    await challengeRepo.giveUp(challengeId, TODAY)
    await freshDatabase()
    await attempt(3, 'hard', 1)
    await settings()
    // A missed day: the restart screen, and no way to give up instead.
    await screen.findByRole('header', { name: "Day 2 wasn't completed" })
    expect(row()).toBeNull()
  })
})

describe('all 75 days done', () => {
  /** Day 75, with everything done but today's pages. */
  async function lastDay() {
    const challengeId = await attempt(75, 'hard', 75)
    const entry = (await dayEntryRepo.getByChallengeAndDayNumber(challengeId, 75))!
    await dayEntryRepo.adjustPages(entry.id, -10)
    return challengeId
  }

  it('ends on the peak, then Victory with the attempt’s numbers, and saves the attempt as completed', async () => {
    const challengeId = await lastDay()
    await show()
    await press('Add 10 pages')

    expect(await screen.findByText('That was the last one. All 75 days, every task, every day.', {}, { timeout: 4000 })).toBeOnTheScreen()
    await waitFor(async () => expect((await stored(challengeId)).status).toBe('completed'))
    // Victory waits under the peak: its own chime hasn't rung yet.
    expect(mockPlay).toHaveBeenCalledTimes(1)

    await press('See your victory')
    expect(await screen.findByRole('header', { name: '75 Hard complete! 🏆' })).toBeOnTheScreen()
    expect(screen.getByText('Attempt #1')).toBeOnTheScreen()
    expect(screen.getByText("75 days. Two workouts, the diet, the water, the reading and the photo — every single day. That's done now, and it's yours.")).toBeOnTheScreen()
    expect(await screen.findByLabelText('Perfect days: 75')).toBeOnTheScreen()
    expect(screen.getByLabelText('Pages read: 750')).toBeOnTheScreen()
    expect(screen.getByLabelText('Streak: 🔥 75')).toBeOnTheScreen()
    expect(screen.queryByText('Jokers used')).toBeNull()
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(2))
    expect(button('Start a new challenge')).toBeOnTheScreen()
  })

  it('opens on Victory at once the next day, and starts the next attempt from there', async () => {
    const createsToday = jest.spyOn(dayEntryRepo, 'getOrCreate')
    const challengeId = await attempt(76, 'medium', 75)
    await challengeRepo.markCompleted(challengeId)
    await show()

    expect(await screen.findByRole('header', { name: '75 Medium complete! 🏆' })).toBeOnTheScreen()
    expect(screen.getByLabelText('Jokers used: 0/1')).toBeOnTheScreen()
    // Victory stays inside the Today tab: the other tabs are still there.
    expect(tabBar()).toBe('tab bar: shown')
    expect(createsToday).not.toHaveBeenCalled()

    await press('Start a new challenge')
    expect(await screen.findByRole('radio', { name: /^75 Medium/ })).toBeChecked()
    await press('Start')
    expect(await screen.findByLabelText('Day 1, 75 Medium #2')).toBeOnTheScreen()
    expect((await stored(challengeId)).status).toBe('completed')
  })
})

describe('an attempt found finished while another tab is in front', () => {
  it('keeps Victory’s chime for when Today is seen (a backup restored from Settings, say)', async () => {
    // An older attempt first: this file's other victories have had their celebration this session (same ids).
    await addChallenge({ startDate: addDaysISO(TODAY, -300), attemptNumber: 0, status: 'failed' })
    const challengeId = await attempt(76, 'hard', 75)
    await challengeRepo.markCompleted(challengeId)
    const tab = (focused: boolean) => (
      <ScreenFocusContext.Provider value={focused}>
        <Today />
      </ScreenFocusContext.Provider>
    )
    const view = await render(tab(false), { wrapper: Providers })
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })
    await act(async () => {})
    expect(mockPlay).not.toHaveBeenCalled()

    await view.rerender(tab(true))
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1))
  })
})

describe('an attempt given up earlier', () => {
  it('opens on "You gave up" at once', async () => {
    const createsToday = jest.spyOn(dayEntryRepo, 'getOrCreate')
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    await addChallenge({ startDate: addDaysISO(TODAY, -5), attemptNumber: 1, status: 'abandoned', abandonedOn: addDaysISO(TODAY, -2) })
    await show()

    expect(await screen.findByRole('header', { name: 'You gave up on Day 4' })).toBeOnTheScreen()
    expect(screen.getByText("Fine, Daniel. Pick something. I'm still watching.")).toBeOnTheScreen()
    expect(tabBar()).toBe('tab bar: hidden')
    expect(createsToday).not.toHaveBeenCalled()
  })
})

describe('the gate', () => {
  it('saves an attempt whose 75 days are done as completed, and no other', async () => {
    const done = await attempt(76, 'hard', 75)
    const first = await renderHook(() => useGate(), { wrapper: Providers })
    await waitFor(() => expect(first.result.current?.kind).toBe('completed'))
    await waitFor(async () => expect((await stored(done)).status).toBe('completed'))
    await first.unmount()

    await freshDatabase()
    const running = await attempt(12, 'hard', 11)
    const second = await renderHook(() => useGate(), { wrapper: Providers })
    await waitFor(() => expect(second.result.current?.kind).toBe('active'))
    expect((await stored(running)).status).toBe('active')
  })
})
