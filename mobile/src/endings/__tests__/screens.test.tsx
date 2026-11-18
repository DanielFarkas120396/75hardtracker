// How an attempt ends, screen by screen: the web's DayFailedScreen, JokerUsedScreen, GaveUpScreen, NewChallengeSheet,
// VictoryScreen and GiveUpFlow tests (src/screens/RestartFlow, Victory, Settings), with their names.
import { addDaysISO, todayISO } from '@logic/dates'
import type { ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo } from 'react-native'
import { addChallenge, addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { challengeRepo, type GiveUpResult } from '../../db/repositories/challengeRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import type { Challenge } from '../../db/types'
import { useNowMinutes } from '../../hooks/useNowMinutes'
import { Providers } from '../../today/__tests__/support'
import { GiveUpFlow } from '../GiveUpFlow'
import { NewChallengeForm, VictoryScreen } from '../NewChallenge'
import { DayFailedScreen, GaveUpScreen, JokerUsedScreen } from '../screens'

const mockPlay = jest.fn()
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn(async () => {}) }),
  setAudioModeAsync: jest.fn(async () => {}),
}))
// The phone's own pickers are native views: a plain view stands in, and tests send it the picked value.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))
jest.mock('../../hooks/useNowMinutes', () => ({ useNowMinutes: jest.fn() }))
// The duck redraws every frame (he has his own tests): here a line of text says which mood he is in.
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood }: { mood: string }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}`}</Line>
  },
}))

const today = todayISO()
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility)
const flags = globalThis as { __SKIP_ANIMATIONS__?: boolean }

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  // React Native's test setup already ships this as a mock: restoring spies doesn't empty it.
  announce.mockClear()
  mockPlay.mockClear()
  // Morning, so the start defaults to Today (from 18:00 it's Tomorrow).
  jest.mocked(useNowMinutes).mockReturnValue(9 * 60)
  await freshDatabase()
})

afterEach(() => {
  flags.__SKIP_ANIMATIONS__ = true
  jest.useRealTimers()
  jest.restoreAllMocks()
})

const show = (ui: React.ReactElement) => render(ui, { wrapper: Providers })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const press = (name: string | RegExp) => fireEvent.press(button(name))
const stored = async (id: number) => (await challengeRepo.getById(id)) as Challenge
const withProfile = () => profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
const active = async () => (await challengeRepo.getAll()).filter((challenge) => challenge.status === 'active')
/** A day picked in the phone's date picker. */
async function pickDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  await fireEvent(screen.getByTestId('date-field'), 'valueChange', {}, new Date(year, month - 1, day, 12))
}

describe('DayFailedScreen', () => {
  /** A 75 Hard attempt that started 3 days ago with nothing logged: Day 1 failed it. */
  async function setup() {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    await show(<DayFailedScreen challenge={await stored(challengeId)} failedDayNumber={1} today={today} />)
    // Let the missed-task list load, so nothing updates after the test.
    await screen.findByText('✕ Progress photo')
    return challengeId
  }

  it('says its heading aloud, since it replaces Today, and lists what the day lacked', async () => {
    await setup()

    expect(screen.getByRole('header', { name: "Day 1 wasn't completed" })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith("Day 1 wasn't completed")
    expect(screen.getByText("Again. From Day 1. I'm watching.")).toBeOnTheScreen()
    expect(screen.queryByText(/You said/)).toBeNull()
    expect(screen.getAllByText(/^✕ /)).toHaveLength(5)
    expect(screen.getByText('duck: judging')).toBeOnTheScreen()
  })

  it('archives the attempt as failed and starts the next one today, with the same challenge', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active', variant: 'strong' })
    await show(<DayFailedScreen challenge={await stored(challengeId)} failedDayNumber={1} today={today} />)
    await screen.findByText('✕ Progress photo')
    // A double tap makes one attempt: the button is locked while it saves (two calls at once are the repository's test).
    await press('Restart from Day 1')
    const again = screen.queryByRole('button', { name: /^Restart/ })
    if (again) await fireEvent.press(again)

    await waitFor(async () => expect(await active()).toMatchObject([{ attemptNumber: 2, variant: 'strong', startDate: today }]))
    expect((await stored(challengeId)).status).toBe('failed')
    expect(await challengeRepo.getAll()).toHaveLength(2)
  })

  it('shows an error and re-enables the button when restarting fails', async () => {
    jest.spyOn(challengeRepo, 'restart').mockRejectedValueOnce(new Error('quota'))
    await setup()
    await press('Restart from Day 1')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that — try again.")
    expect(button('Restart from Day 1')).toBeEnabled()
  })

  it('calls the player by name and quotes their reason back', async () => {
    await withProfile()
    await setup()

    expect(await screen.findByText("Again, Daniel. From Day 1. I'm watching.")).toBeOnTheScreen()
    expect(screen.getByText('You said: “A fresh start”')).toBeOnTheScreen()
  })
})

describe('JokerUsedScreen', () => {
  /** A Medium challenge with no day entries at all: every day, including Day 3, is missing. */
  async function setup(props: { newlyMissed: number[]; missedCount: number; jokersLeft: number }) {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'medium' })
    await show(<JokerUsedScreen challenge={await stored(challengeId)} {...props} />)
    await screen.findAllByText('✕ Progress photo')
    return { challengeId }
  }

  it('announces one missed day, its missing tasks, and the last-joker line', async () => {
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })

    expect(screen.getByRole('header', { name: "Day 3 wasn't completed" })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith("Day 3 wasn't completed")
    expect(screen.getByText('Joker used. 0 left.')).toBeOnTheScreen()
    expect(screen.getByText("That was your last joker. Next time, it's Day 1.")).toBeOnTheScreen()
    expect(screen.getByText("Your streak starts over. Your challenge doesn't.")).toBeOnTheScreen()
    expect(screen.getByText('✕ Ate healthy, no alcohol unless declared')).toBeOnTheScreen()
    expect(screen.getAllByText(/^✕ /)).toHaveLength(5)
  })

  it('calls acknowledgeJokers with the total missed count on Keep going', async () => {
    const { challengeId } = await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })
    await press('Keep going')

    await waitFor(async () => expect((await stored(challengeId)).jokersAcknowledged).toBe(1))
  })

  it('announces several missed days with the plural line, per-day labels and the softer duck line', async () => {
    await setup({ newlyMissed: [12, 13], missedCount: 2, jokersLeft: 1 })

    expect(screen.getByText("Days 12 and 13 weren't completed")).toBeOnTheScreen()
    expect(screen.getByText('2 jokers used. 1 left.')).toBeOnTheScreen()
    expect(screen.getByText("I'll let that one go. Once.")).toBeOnTheScreen()
    expect(screen.getByText('Day 12')).toBeOnTheScreen()
    expect(screen.getByText('Day 13')).toBeOnTheScreen()
  })

  it('joins three or more missed days with commas and "and"', async () => {
    await setup({ newlyMissed: [3, 4, 5], missedCount: 3, jokersLeft: 0 })

    expect(screen.getByText("Days 3, 4 and 5 weren't completed")).toBeOnTheScreen()
  })

  it('shows an error and re-enables the button when saving fails', async () => {
    jest.spyOn(challengeRepo, 'acknowledgeJokers').mockRejectedValueOnce(new Error('quota'))
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })
    await press('Keep going')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that — try again.")
    expect(button('Keep going')).toBeEnabled()
  })

  it('quotes the reason back when a joker is spent', async () => {
    await withProfile()
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })

    expect(await screen.findByText('You said: “A fresh start”')).toBeOnTheScreen()
  })
})

describe('GaveUpScreen', () => {
  /** A 75 Medium attempt #2 that started 11 days ago and was given up (today, on Day 12, unless no date is given). */
  async function setup(abandonedOn: string | undefined) {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -11), attemptNumber: 2, status: 'abandoned', variant: 'medium', ...(abandonedOn ? { abandonedOn } : {}) })
    await show(<GaveUpScreen challenge={await stored(challengeId)} today={today} />)
  }

  it('names the day, the challenge and the attempt, and says its heading aloud', async () => {
    await setup(today)

    expect(screen.getByRole('header', { name: 'You gave up on Day 12' })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('You gave up on Day 12')
    expect(screen.getByText('75 Medium, attempt #2. It stays in your history.')).toBeOnTheScreen()
    expect(screen.getByText("Fine. Pick something. I'm still watching.")).toBeOnTheScreen()
    expect(screen.getByText('Pick your next challenge and when it starts.')).toBeOnTheScreen()
  })

  it('says only "You gave up" when the give-up date is missing', async () => {
    await setup(undefined)

    expect(screen.getByRole('header', { name: 'You gave up' })).toBeOnTheScreen()
  })

  it('starts the next attempt from the sheet, with the same challenge picked by default', async () => {
    await setup(today)

    await press('Start a new challenge')
    expect(await screen.findByRole('radio', { name: /^75 Medium/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Today' })).toBeChecked()
    await press('Start')

    await waitFor(async () => expect(await active()).toMatchObject([{ attemptNumber: 3, variant: 'medium', startDate: today }]))
  })

  it('calls the player by name', async () => {
    await withProfile()
    await setup(today)

    expect(await screen.findByText("Fine, Daniel. Pick something. I'm still watching.")).toBeOnTheScreen()
  })
})

describe('NewChallengeForm', () => {
  /** A completed attempt, so `startNew` always creates a fresh active one instead of reusing it. */
  async function setup(defaultVariant: ChallengeVariant = 'hard') {
    const oldId = await addChallenge({ startDate: addDaysISO(today, -80), attemptNumber: 1, status: 'completed', variant: 'hard' })
    await addPerfectDays(oldId, addDaysISO(today, -80), 1, 2)
    const onClose = jest.fn()
    await show(<NewChallengeForm defaultVariant={defaultVariant} today={today} onClose={onClose} />)
    return { onClose, oldId }
  }

  it('shows the title and defaults the picker to defaultVariant', async () => {
    await setup('medium')

    expect(screen.getByRole('header', { name: 'Start a new challenge' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: /^75 Medium/ })).toBeChecked()
  })

  it('offers Today, Tomorrow and a date picker that starts no earlier than today', async () => {
    await setup()

    expect(screen.getByRole('radio', { name: 'Today' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Pick a date' }))

    expect(todayISO(screen.getByLabelText('Start date').props.minimumDate)).toBe(today)
  })

  it('defaults the start to tomorrow from 18:00', async () => {
    jest.mocked(useNowMinutes).mockReturnValue(18 * 60)
    await setup()

    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toBeChecked()
  })

  it('starts a new attempt with the chosen variant and date, then closes; the old attempt’s days stay', async () => {
    const { onClose, oldId } = await setup('hard')

    await fireEvent.press(screen.getByRole('radio', { name: /^75 Soft/ }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }))
    expect(screen.getByText(/^A new attempt starts on .+\. Every photo and stat from this one stays saved\.$/)).toBeOnTheScreen()
    await press('Start')

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await active()).toMatchObject([{ attemptNumber: 2, variant: 'soft', startDate: addDaysISO(today, 1) }])
    const { dayEntryRepo } = jest.requireActual<typeof import('../../db/repositories/dayEntryRepo')>('../../db/repositories/dayEntryRepo')
    expect(await dayEntryRepo.getAllForChallenge(oldId)).toHaveLength(2)
  })

  it('shows an error and stays open when starting fails', async () => {
    jest.spyOn(challengeRepo, 'startNew').mockRejectedValueOnce(new Error('quota'))
    const { onClose } = await setup()
    await press('Start')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't start it — try again.")
    expect(onClose).not.toHaveBeenCalled()
    expect(button('Start')).toBeEnabled()
  })

  it('picking a past date shows "The start can\'t be in the past." and disables Start', async () => {
    await setup()
    await fireEvent.press(screen.getByRole('radio', { name: 'Pick a date' }))
    await pickDay(addDaysISO(today, -1))

    expect(await screen.findByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(button('Start')).toBeDisabled()
    expect(screen.queryByText(/A new attempt starts on/)).toBeNull()
  })

  it('starts the attempt with a valid picked date once one is chosen', async () => {
    const { onClose } = await setup()
    const future = addDaysISO(today, 5)
    await fireEvent.press(screen.getByRole('radio', { name: 'Pick a date' }))
    await pickDay(future)
    await press('Start')

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await active())[0].startDate).toBe(future)
  })
})

describe('VictoryScreen', () => {
  /** A completed attempt of the given variant, with the gate's streak and missedDays. */
  async function setup(props: { variant: ChallengeVariant; streak: number; missedDays: number[]; revealed?: boolean; perfectDays?: number; earlier?: number }) {
    // Earlier attempts give this one an id of its own: a victory is celebrated once per session and attempt.
    for (let n = 0; n < (props.earlier ?? 0); n++) await addChallenge({ startDate: addDaysISO(today, -400), attemptNumber: 0, status: 'failed' })
    const startDate = addDaysISO(today, -75)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'completed', variant: props.variant })
    if (props.perfectDays) await addPerfectDays(challengeId, startDate, 1, props.perfectDays)
    const challenge = await stored(challengeId)
    const ui = (revealed: boolean) => <VictoryScreen challenge={challenge} today={today} revealed={revealed} streak={props.streak} missedDays={props.missedDays} />
    const view = await show(ui(props.revealed ?? false))
    return { view, ui }
  }
  const confetti = () => screen.queryByTestId('confetti', { includeHiddenElements: true })

  it('shows the variant title, the streak and a Jokers used stat for a completed Medium challenge', async () => {
    await setup({ variant: 'medium', streak: 42, missedDays: [12] })

    expect(await screen.findByRole('header', { name: '75 Medium complete! 🏆' })).toBeOnTheScreen()
    expect(screen.getByText('Attempt #1')).toBeOnTheScreen()
    expect(screen.getByLabelText('Streak: 🔥 42')).toBeOnTheScreen()
    expect(screen.getByLabelText('Jokers used: 1/1')).toBeOnTheScreen()
    expect(screen.getByText('duck: triumphant')).toBeOnTheScreen()
  })

  it('shows no Jokers used stat for a Hard victory', async () => {
    await setup({ variant: 'hard', streak: 75, missedDays: [] })

    expect(await screen.findByRole('header', { name: '75 Hard complete! 🏆' })).toBeOnTheScreen()
    expect(screen.queryByText('Jokers used')).toBeNull()
  })

  it('shows the attempt’s numbers', async () => {
    await setup({ variant: 'hard', streak: 3, missedDays: [], perfectDays: 3 })

    expect(await screen.findByLabelText('Perfect days: 3')).toBeOnTheScreen()
    expect(screen.getByLabelText('Water: 11.4 L')).toBeOnTheScreen()
    expect(screen.getByLabelText('Pages read: 30')).toBeOnTheScreen()
    expect(screen.getByLabelText('Workout time: 4h30')).toBeOnTheScreen()
  })

  it('fires its confetti and its chime once the Day 75 peak is gone, and once per session', async () => {
    flags.__SKIP_ANIMATIONS__ = false
    const { view, ui } = await setup({ variant: 'hard', streak: 75, missedDays: [] })
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })
    // Still under the peak.
    expect(confetti()).toBeNull()
    expect(mockPlay).not.toHaveBeenCalled()

    await view.rerender(ui(true))
    await waitFor(() => expect(confetti()).not.toBeNull())
    expect(mockPlay).toHaveBeenCalledTimes(1)

    // Coming back to the tab stays calm.
    await view.unmount()
    await show(ui(true))
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })
    expect(confetti()).toBeNull()
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('chimes without confetti under reduce motion', async () => {
    flags.__SKIP_ANIMATIONS__ = false
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    // Its own attempt: the one above has had its celebration this session.
    await addChallenge({ startDate: addDaysISO(today, -200), attemptNumber: 7, status: 'failed' })
    const { view, ui } = await setup({ variant: 'hard', streak: 75, missedDays: [] })
    await act(async () => {})
    await view.rerender(ui(true))

    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1))
    expect(confetti()).toBeNull()
  })

  it('shows the duck whole when Reduce Motion is learned after it started to arrive (the app opened on Victory)', async () => {
    flags.__SKIP_ANIMATIONS__ = false
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    await setup({ variant: 'hard', streak: 75, missedDays: [] })
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })

    await waitFor(() => expect(screen.getByTestId('victory-duck')).toHaveStyle({ opacity: 1, transform: [{ scale: 1 }] }))
  })

  it('rings its chime when the app opens on Victory, once the sound setting is known', async () => {
    await setup({ variant: 'hard', streak: 75, missedDays: [], revealed: true, earlier: 2 })
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })

    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1))
  })

  it('stays silent when the app opens on Victory with sounds off', async () => {
    await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
    await setup({ variant: 'hard', streak: 75, missedDays: [], revealed: true, earlier: 3 })
    await screen.findByRole('header', { name: '75 Hard complete! 🏆' })
    await screen.findByLabelText('Streak: 🔥 75')
    await act(async () => {})

    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('starts the next attempt from its sheet, with the challenge just won picked by default', async () => {
    await setup({ variant: 'soft', streak: 75, missedDays: [] })
    await press('Start a new challenge')

    expect(await screen.findByRole('radio', { name: /^75 Soft/ })).toBeChecked()
    await press('Start')
    await waitFor(async () => expect(await active()).toMatchObject([{ attemptNumber: 2, variant: 'soft', startDate: today }]))
  })
})

describe('GiveUpFlow', () => {
  /** A 75 Hard attempt on `todayDayNumber` with `perfectDays` perfect days, and the flow open on step 1. */
  async function setup(todayDayNumber = 12, perfectDays = 11) {
    const startDate = addDaysISO(today, -(todayDayNumber - 1))
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'hard' })
    if (perfectDays > 0) await addPerfectDays(challengeId, startDate, 1, perfectDays)
    const onClose = jest.fn()
    await show(<GiveUpFlow open onClose={onClose} challenge={await stored(challengeId)} today={today} todayDayNumber={todayDayNumber} streak={11} />)
    return { challengeId, onClose }
  }

  /** One second of step 3's lock, on the fake clock. */
  const tick = () => act(async () => void jest.advanceTimersByTime(1000))

  /** Steps 1 and 2, then step 3's five-second lock on a fake clock, then on to step 4. */
  async function reachStepFour() {
    await press('Give up')
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    await press("I'm sure")
    for (let second = 0; second < 5; second++) await tick()
    jest.useRealTimers()
    await press('Give up')
  }

  const typeConfirmation = (value: string) => fireEvent.changeText(screen.getByLabelText('Type GIVE UP to confirm'), value)

  it('opens on what giving up means, and Keep going closes without giving up', async () => {
    const { challengeId, onClose } = await setup()

    expect(screen.getByRole('header', { name: 'Give up 75 Hard?' })).toBeOnTheScreen()
    expect(screen.getByText("You're on Day 12 of 75. Giving up ends this attempt for good: you can't pick it back up. It stays in your history.")).toBeOnTheScreen()
    await press('Keep going')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await stored(challengeId)).status).toBe('active')
  })

  it('shows what the attempt built on step 2, saying its heading aloud, and I’ll stay closes', async () => {
    const { onClose } = await setup()
    await press('Give up')

    expect(screen.getByRole('header', { name: 'Look at what you built.' })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('Look at what you built.')
    expect(await screen.findByText('🔥 11-day streak · 11 perfect days')).toBeOnTheScreen()
    expect(screen.getByText("11 perfect days. You'd throw them away?")).toBeOnTheScreen()
    expect(screen.getByText('duck: judging')).toBeOnTheScreen()

    await press("I'll stay")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('words step 2 for a single perfect day', async () => {
    await setup(12, 1)
    await press('Give up')

    expect(await screen.findByText('🔥 11-day streak · 1 perfect day')).toBeOnTheScreen()
    expect(screen.getByText("1 perfect day. You'd throw it away?")).toBeOnTheScreen()
  })

  it('words step 2 for no perfect day at all', async () => {
    await setup(12, 0)
    await press('Give up')

    expect(screen.getByText("Not one perfect day yet, and you're already out?")).toBeOnTheScreen()
  })

  it('closes on a tap beside the sheet without giving up', async () => {
    const { challengeId, onClose } = await setup()
    await press('Give up') // step 2
    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await stored(challengeId)).status).toBe('active')
  })

  it('locks Give up on step 3 for five seconds, counting down', async () => {
    const { onClose } = await setup()
    await press('Give up')
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    await press("I'm sure")

    expect(screen.getByRole('header', { name: 'Last warning.' })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('Last warning.')
    expect(screen.getByText("Tomorrow is Day 13. Quitters don't get a Day 13.")).toBeOnTheScreen()
    expect(screen.getByText('duck: hunting')).toBeOnTheScreen()
    expect(screen.getByText('Give up (5)')).toBeOnTheScreen()
    expect(button('Give up, locked for a few seconds')).toBeDisabled()

    await tick()
    expect(screen.getByText('Give up (4)')).toBeOnTheScreen()
    expect(button('Give up, locked for a few seconds')).toBeDisabled()

    for (let second = 0; second < 4; second++) await tick()
    expect(button('Give up')).toBeEnabled()

    await press('Keep going')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('speaks of the finish line on Day 75', async () => {
    await setup(75, 0)
    await press('Give up')
    await press("I'm sure")

    expect(screen.getByText("It's Day 75. Quitters don't get a finish line.")).toBeOnTheScreen()
  })

  it('unlocks the last button only once GIVE UP is typed, then gives the attempt up', async () => {
    const { challengeId } = await setup()
    await reachStepFour()

    expect(screen.getByRole('header', { name: 'Type GIVE UP to confirm.' })).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('Type GIVE UP to confirm.')
    expect(screen.getByText("This can't be undone.")).toBeOnTheScreen()
    expect(button('Give up for good')).toBeDisabled()

    await typeConfirmation('give')
    expect(button('Give up for good')).toBeDisabled()
    await typeConfirmation('GIVEUP')
    expect(button('Give up for good')).toBeDisabled()
    await typeConfirmation('  give   up ')
    expect(button('Give up for good')).toBeEnabled()

    await press('Give up for good')

    await waitFor(async () => expect(await stored(challengeId)).toMatchObject({ status: 'abandoned', abandonedOn: today }))
  })

  it('shows Giving up… and locks both buttons while saving', async () => {
    jest.spyOn(challengeRepo, 'giveUp').mockReturnValueOnce(new Promise<GiveUpResult>(() => {}))
    await setup()
    await reachStepFour()
    await typeConfirmation('GIVE UP')
    await press('Give up for good')

    expect(await screen.findByRole('button', { name: 'Giving up…' })).toBeDisabled()
    expect(button('Cancel')).toBeDisabled()
  })

  it('closes on Cancel at the last step without giving up', async () => {
    const { challengeId, onClose } = await setup()
    await reachStepFour()
    await press('Cancel')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await stored(challengeId)).status).toBe('active')
  })

  it('says so when the attempt can no longer be given up', async () => {
    const { challengeId } = await setup()
    await reachStepFour()
    await challengeRepo.markCompleted(challengeId)
    await typeConfirmation('GIVE UP')
    await press('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("This attempt can't be given up anymore.")
    expect(button('Give up for good')).toBeEnabled()
  })

  it('shows an error and re-enables the button when saving fails', async () => {
    jest.spyOn(challengeRepo, 'giveUp').mockRejectedValueOnce(new Error('quota'))
    await setup()
    await reachStepFour()
    await typeConfirmation('GIVE UP')
    await press('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't give up — try again.")
    expect(button('Give up for good')).toBeEnabled()
  })

  it('quotes the reason back on step 2', async () => {
    await withProfile()
    await setup()
    await press('Give up')

    expect(await screen.findByText('You said: “A fresh start”')).toBeOnTheScreen()
  })
})
