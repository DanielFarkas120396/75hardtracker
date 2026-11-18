// Ported from the web app's src/screens/Onboarding/__tests__/OnboardingFlow.test.tsx and OnboardingGate.test.tsx.
import { addDaysISO, todayISO } from '@logic/dates'
import { lateStartHint, SAVE_FAILED_LINE, WHY_IDEAS } from '@logic/onboardingCopy'
import type { OnboardingDraft } from '@logic/onboardingDraft'
import { RULESETS } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import type { ReactNode } from 'react'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccessibilityInfo, Text } from 'react-native'
import { pickBackupFile } from '../../backup/pickBackupFile'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { eraseEverything } from '../../db/erase'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { nodeStore } from '../../files/__tests__/nodeStore'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { loadDraft, saveDraft } from '../draftStore'
import { OnboardingFlow } from '../OnboardingFlow'
import { OnboardingGate } from '../OnboardingGate'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('../../backup/pickBackupFile', () => ({ pickBackupFile: jest.fn(async () => null) }))
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }))
// The duck redraws every frame (he has his own tests): here a line of text says which mood he is in.
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood }: { mood: string }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}`}</Line>
  },
}))
// The phone's own pickers are native views: a plain view stands in, and tests send it the picked value.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))

const TODAY = todayISO()
const MORNING = 10 * 60
const EVENING = 19 * 60
const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  // React Native's test setup already ships this as a mock: restoring spies doesn't empty it.
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  await freshDatabase()
})

afterEach(() => {
  jest.restoreAllMocks()
})

interface Options {
  mode?: 'new' | 'returning'
  draft?: OnboardingDraft | null
  nowMin?: number
  today?: string
}

const flow = ({ mode = 'new', draft = null, nowMin = MORNING, today = TODAY }: Options = {}) => (
  <OnboardingFlow mode={mode} draft={draft} nowMin={nowMin} today={today} />
)
const show = (options?: Options) => render(flow(options), { wrapper: Providers })

const press = async (label: string) => fireEvent.press(await screen.findByText(label))
const pressContinue = async () => fireEvent.press(await screen.findByRole('button', { name: 'Continue' }))
const draftAt = (step: OnboardingDraft['step'], changes: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  step,
  name: 'Daniel',
  variant: 'hard',
  why: 'A fresh start',
  startChoice: 'today',
  pickedDate: addDaysISO(TODAY, 1),
  ...changes,
})

/** From the first screen to "When do you start?", with no saved choice (a draft's own start choice would win over the default). */
async function walkToStart() {
  await press('Get started')
  await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Daniel')
  await pressContinue()
  await fireEvent.press(await screen.findByRole('radio', { name: /^75 Hard/ }))
  await pressContinue()
  await press(WHY_IDEAS[0])
  await pressContinue()
  await screen.findByText('When do you go to bed?')
  await pressContinue()
  await screen.findByText('When do you start?')
}

const layout = (box: { y?: number; height: number }) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, ...box } } })
/** The deal on a 600-point page, with the signature starting 900 points down. */
async function layOutTheDeal() {
  await fireEvent(await screen.findByTestId('flow-scroll'), 'layout', layout({ height: 600 }))
  await fireEvent(screen.getByTestId('signing'), 'layout', layout({ y: 900, height: 300 }))
}

/** Signs the deal the way VoiceOver does (the pad's own tests cover a drawn stroke), then commits. */
async function signTheDeal() {
  const pad = await screen.findByRole('button', { name: 'Sign the deal: draw a checkmark.' })
  await fireEvent(pad, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
  await fireEvent.press(screen.getByRole('button', { name: 'I commit' }))
}

describe('a new player', () => {
  it('walks the whole flow, signs the deal, and gets attempt #1 with the chosen challenge and start', async () => {
    await show()
    expect(await screen.findByText('75 days. 5 tasks. One duck with a knife.')).toBeOnTheScreen()
    await press('Get started')

    await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Daniel')
    await pressContinue()

    await fireEvent.press(await screen.findByRole('radio', { name: /^75 Soft/ }))
    await pressContinue()

    await press(WHY_IDEAS[0])
    await pressContinue()

    expect(await screen.findByText('When do you go to bed?')).toBeOnTheScreen()
    await pressContinue()

    expect(await screen.findByText('When do you start?')).toBeOnTheScreen()
    await pressContinue()

    expect(await screen.findByText('Deal, Daniel.')).toBeOnTheScreen()
    expect(screen.getByText('75 Soft')).toBeOnTheScreen()
    expect(screen.getByText(`“${WHY_IDEAS[0]}”`)).toBeOnTheScreen()
    await signTheDeal()
    expect(await screen.findByText('I’m watching, Daniel.'.replace('’', "'"))).toBeOnTheScreen()
    expect(screen.queryByLabelText('Back')).toBeNull()
    expect(screen.getByText('duck: triumphant')).toBeOnTheScreen()

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: WHY_IDEAS[0] }), {
      timeout: 4000,
    })
    expect(await challengeRepo.getAll()).toMatchObject([{ attemptNumber: 1, status: 'active', variant: 'soft', startDate: TODAY }])
    await waitFor(async () => expect(await loadDraft()).toBeNull())
  })

  it('can’t leave the name step without a name', async () => {
    await show({ draft: draftAt('name', { name: '' }) })
    const next = await screen.findByRole('button', { name: 'Continue' })
    expect(next).toBeDisabled()
    expect(screen.getByText('Type a name to continue. Up to 20 characters.')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('What should the duck call you?'), 'Daniel')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('has no challenge picked for them', async () => {
    await show({ draft: draftAt('challenge', { variant: null }) })
    expect(await screen.findByText('Pick a challenge to continue.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    for (const card of screen.getAllByRole('radio')) expect(card).not.toBeChecked()
  })

  it('moves one step on a double tap, not two', async () => {
    await show()
    const start = await screen.findByText('Get started')
    await fireEvent.press(start)
    await fireEvent.press(start)
    expect(await screen.findByText('What should the duck call you?')).toBeOnTheScreen()
    expect(screen.queryByText('Pick your challenge')).toBeNull()
  })

  it('keeps the answers when going back', async () => {
    await show({ draft: draftAt('challenge') })
    await fireEvent.press(await screen.findByLabelText('Back'))
    expect((await screen.findByLabelText('What should the duck call you?')).props.value).toBe('Daniel')
  })

  it('shows the ideas only while the reason is empty or is one of them, and counts the last characters', async () => {
    await show({ draft: draftAt('why', { why: '' }) })
    expect(await screen.findByText(WHY_IDEAS[1])).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Your why'), 'x'.repeat(100))
    expect(screen.queryByText(WHY_IDEAS[1])).toBeNull()
    expect(screen.getByText('100/140')).toBeOnTheScreen()
  })

  it('starts today by default in the morning', async () => {
    await show({ nowMin: MORNING })
    await walkToStart()
    expect(await screen.findByRole('radio', { name: 'Today' })).toBeChecked()
  })

  it('offers Tomorrow first in the evening, and warns when Today is picked anyway', async () => {
    // No saved choice: the draft's own start choice would win over the evening default.
    await settingsRepo.set(SETTING_KEYS.bedtime, '23:00')
    const view = await show({ nowMin: EVENING })
    await walkToStart()
    expect(await screen.findByRole('radio', { name: 'Tomorrow' })).toBeChecked()

    await fireEvent.press(screen.getByRole('radio', { name: 'Today' }))
    const warning = lateStartHint(EVENING, RULESETS.hard)
    expect(warning).not.toBeNull()
    expect(await screen.findByText(warning!)).toBeOnTheScreen()
    await view.unmount()
  })

  it('shows how far along the flow is, with Back from the second screen on', async () => {
    await show()
    const progress = () => screen.getByRole('progressbar', { name: 'Setup progress' })
    await screen.findByText('Get started')
    expect(progress()).toHaveAccessibilityValue({ text: 'Step 1 of 7' })
    expect(screen.queryByLabelText('Back')).toBeNull()

    await press('Get started')
    await screen.findByText('What should the duck call you?')
    expect(progress()).toHaveAccessibilityValue({ text: 'Step 2 of 7' })
    expect(screen.getByLabelText('Back')).toBeOnTheScreen()
  })

  it('moves on with Return from the name and from the reason, once they are usable', async () => {
    await show({ draft: draftAt('name', { name: '' }) })
    const name = await screen.findByLabelText('What should the duck call you?')
    await fireEvent(name, 'submitEditing')
    expect(screen.getByText('What should the duck call you?')).toBeOnTheScreen()
    await fireEvent.changeText(name, 'Daniel')
    await fireEvent(screen.getByLabelText('What should the duck call you?'), 'submitEditing')
    expect(await screen.findByText('Pick your challenge')).toBeOnTheScreen()
    await pressContinue()
    await fireEvent(await screen.findByLabelText('Your why'), 'submitEditing')
    expect(await screen.findByText('When do you go to bed?')).toBeOnTheScreen()
  })

  it('moves VoiceOver to each step’s title as it appears', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
    await show()
    await screen.findByText('Get started')
    expect(focus).toHaveBeenLastCalledWith(expect.anything(), 'focus')
    const before = focus.mock.calls.length
    await press('Get started')
    await screen.findByText('What should the duck call you?')
    expect(focus.mock.calls.length).toBeGreaterThan(before)
  })

  it('opens the file picker from "Already have a backup? Restore it"', async () => {
    await show()
    await press('Already have a backup? Restore it')
    await waitFor(() => expect(pickBackupFile).toHaveBeenCalledTimes(1))
    // Nothing picked: the welcome screen is still there.
    expect(screen.getByText('Get started')).toBeOnTheScreen()
  })

  it('refuses a start more than 60 days ahead', async () => {
    await show({ draft: draftAt('start', { startChoice: 'pick', pickedDate: addDaysISO(TODAY, 3) }) })
    const [year, month, day] = addDaysISO(TODAY, 61).split('-').map(Number)
    await fireEvent(await screen.findByTestId('date-field'), 'valueChange', {}, new Date(year, month - 1, day, 12))
    expect(await screen.findByText('Start within the next 60 days.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('refuses a picked date in the past', async () => {
    await show({ draft: draftAt('start', { startChoice: 'pick', pickedDate: addDaysISO(TODAY, 3) }) })
    expect(await screen.findByRole('radio', { name: 'Pick a date' })).toBeChecked()
    const [year, month, day] = addDaysISO(TODAY, -2).split('-').map(Number)
    await fireEvent(screen.getByTestId('date-field'), 'valueChange', {}, new Date(year, month - 1, day, 12))
    expect(await screen.findByText("The start can't be in the past.")).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('saves the bedtime as it is picked', async () => {
    await show({ draft: draftAt('bedtime') })
    const picked = new Date()
    picked.setHours(22, 15, 0, 0)
    await fireEvent(await screen.findByTestId('time-field'), 'valueChange', {}, picked)
    await waitFor(async () => expect(await settingsRepo.get(SETTING_KEYS.bedtime, '')).toBe('22:15'))
  })

  it('won’t take a bedtime before 18:00', async () => {
    await show({ draft: draftAt('bedtime') })
    const picked = new Date()
    picked.setHours(15, 0, 0, 0)
    await fireEvent(await screen.findByTestId('time-field'), 'valueChange', {}, picked)
    expect(await screen.findByText('Pick a time between 18:00 and 23:59.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, 'unset')).toBe('unset')
  })
})

describe('closing and reopening the app', () => {
  it('keeps the answers as they are given', async () => {
    await show()
    await press('Get started')
    await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Daniel')
    await pressContinue()
    await screen.findByText('Pick your challenge')
    await waitFor(async () => expect(await loadDraft()).toMatchObject({ step: 'challenge', name: 'Daniel', variant: null }))
  })

  it('comes back to the saved step', async () => {
    await show({ draft: draftAt('why') })
    expect(await screen.findByText('Why are you doing this?')).toBeOnTheScreen()
    expect(screen.getByLabelText('Your why').props.value).toBe('A fresh start')
  })

  it('comes back to the first step whose answer no longer holds', async () => {
    await show({ draft: draftAt('ready', { name: '   ' }) })
    expect(await screen.findByText('What should the duck call you?')).toBeOnTheScreen()
  })
})

describe('the deal', () => {
  it('refuses a start date that has slipped into the past, and offers to change it', async () => {
    const draft = draftAt('ready', { startChoice: 'pick', pickedDate: TODAY })
    const view = await show({ draft })
    expect(await screen.findByText('Deal, Daniel.')).toBeOnTheScreen()
    // Midnight passes with the deal still open.
    await view.rerender(flow({ draft, today: addDaysISO(TODAY, 1) }))
    expect(await screen.findByText("The start can't be in the past.")).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'I commit' })).toBeDisabled()
    await press('Change start date')
    expect(await screen.findByText('When do you start?')).toBeOnTheScreen()
  })

  it('says so when saving fails, and asks for the signature again', async () => {
    jest.spyOn(profileRepo, 'completeOnboarding').mockRejectedValueOnce(new Error('disk full'))
    await show({ draft: draftAt('ready') })
    await signTheDeal()
    expect(await screen.findByText(SAVE_FAILED_LINE, {}, { timeout: 4000 })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'I commit' })).toBeDisabled()
    expect(await profileRepo.get()).toBeUndefined()
    expect(await challengeRepo.getAll()).toEqual([])
  })

  it('holds the page still while the signature is drawn', async () => {
    await show({ draft: draftAt('ready') })
    const pad = await screen.findByRole('button', { name: 'Sign the deal: draw a checkmark.' })
    const page = () => screen.getByTestId('flow-scroll')
    expect(page().props.scrollEnabled).not.toBe(false)
    await fireEvent(pad, 'responderGrant', { nativeEvent: { locationX: 20, locationY: 90 } })
    expect(page().props.scrollEnabled).toBe(false)
    await fireEvent(pad, 'responderRelease', { nativeEvent: { locationX: 60, locationY: 120 } })
    expect(page().props.scrollEnabled).not.toBe(false)
  })

  it('points to the signature with "Sign below" until it is in view', async () => {
    await show({ draft: draftAt('ready') })
    await layOutTheDeal()
    expect(await screen.findByText('Sign below ↓')).toBeOnTheScreen()
    await fireEvent.scroll(screen.getByTestId('flow-scroll'), { nativeEvent: { contentOffset: { y: 700 } } })
    expect(screen.queryByText('Sign below ↓')).toBeNull()
  })

  it('opens every step at its top, however far the one before was scrolled', async () => {
    await show({ draft: draftAt('ready') })
    await layOutTheDeal()
    await fireEvent.scroll(screen.getByTestId('flow-scroll'), { nativeEvent: { contentOffset: { y: 700 } } })
    await fireEvent.press(screen.getByLabelText('Back'))
    await screen.findByText('When do you start?')
    await pressContinue()
    await screen.findByText('Deal, Daniel.')
    // Back at the top of the deal, the signature is below the fold again.
    await layOutTheDeal()
    expect(await screen.findByText('Sign below ↓')).toBeOnTheScreen()
  })

  it('says aloud that the save failed, and that the duck is watching', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    jest.spyOn(profileRepo, 'completeOnboarding').mockRejectedValueOnce(new Error('disk full'))
    await show({ draft: draftAt('ready') })
    await signTheDeal()
    await waitFor(() => expect(announce).toHaveBeenCalledWith("I'm watching, Daniel."))
    await screen.findByText(SAVE_FAILED_LINE, {}, { timeout: 4000 })
    expect(announce).toHaveBeenCalledWith(SAVE_FAILED_LINE)
  })

  it('keeps showing a step when the mode flips mid-flow (attempts came back from a backup)', async () => {
    const draft = draftAt('ready')
    const view = await show({ draft })
    await screen.findByText('Deal, Daniel.')
    await view.rerender(flow({ mode: 'returning', draft }))
    expect(await screen.findByText('Welcome back, Daniel.')).toBeOnTheScreen()
  })

  it('can’t be committed before it is signed', async () => {
    await show({ draft: draftAt('ready') })
    expect(await screen.findByRole('button', { name: 'I commit' })).toBeDisabled()
  })
})

describe('a returning player (attempts came back, no profile)', () => {
  it('gives a name and a reason, then picks up where they were: no new attempt, nothing signed', async () => {
    const id = await addChallenge({ startDate: addDaysISO(TODAY, -3), attemptNumber: 4, status: 'active' })
    await show({ mode: 'returning' })
    await press('Get started')
    await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Dan')
    await pressContinue()
    await fireEvent.changeText(await screen.findByLabelText('Your why'), 'Clear my head')
    await pressContinue()
    expect(await screen.findByText('Welcome back, Dan.')).toBeOnTheScreen()
    expect(screen.queryByText('Pick your challenge')).toBeNull()
    await press("Let's go")
    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Dan', why: 'Clear my head' }))
    expect((await challengeRepo.getAll()).map((challenge) => challenge.id)).toEqual([id])
  })
})

describe('the gate', () => {
  const gate = () =>
    render(
      <OnboardingGate>
        <Text>the app</Text>
      </OnboardingGate>,
      { wrapper: Providers },
    )

  it('shows the welcome flow on a fresh install', async () => {
    await gate()
    expect(await screen.findByText('Get started')).toBeOnTheScreen()
    expect(screen.queryByText('the app')).toBeNull()
  })

  it('shows the app to someone with a profile', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: TODAY, variant: 'hard' })
    await gate()
    expect(await screen.findByText('the app')).toBeOnTheScreen()
  })

  it('gives way to the app the moment a profile appears (a backup restored from the welcome screen)', async () => {
    await gate()
    await screen.findByText('Get started')
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: TODAY, variant: 'hard' })
    expect(await screen.findByText('the app')).toBeOnTheScreen()
    expect(screen.queryByText('Get started')).toBeNull()
  })

  it('opens the returning flow when attempts exist without a profile', async () => {
    await addChallenge({ startDate: TODAY, attemptNumber: 1, status: 'active' })
    await gate()
    await press('Get started')
    await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Dan')
    await pressContinue()
    expect(await screen.findByText('Why are you doing this?')).toBeOnTheScreen()
  })

  it('starts from the first screen after everything is erased, not from the answers it once had', async () => {
    await saveDraft(draftAt('challenge'))
    await gate()
    expect(await screen.findByText('Pick your challenge')).toBeOnTheScreen()
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: TODAY, variant: 'hard' })
    await screen.findByText('the app')

    await eraseEverything(nodeStore(mkdtempSync(join(tmpdir(), 'erase-'))))
    expect(await screen.findByText('Get started')).toBeOnTheScreen()
    expect(screen.queryByText('Pick your challenge')).toBeNull()
  })

  it('resumes the saved draft', async () => {
    const view = await gate()
    await press('Get started')
    await fireEvent.changeText(await screen.findByLabelText('What should the duck call you?'), 'Daniel')
    await pressContinue()
    await waitFor(async () => expect(await loadDraft()).toMatchObject({ step: 'challenge' }))
    await view.unmount()
    await gate()
    expect(await screen.findByText('Pick your challenge')).toBeOnTheScreen()
  })
})
