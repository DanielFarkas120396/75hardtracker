// The app lock: the cases of the plan's Review Focus 6 and 7 (docs/superpowers/plans/2026-11-19-v4-part-8-settings.md),
// from the web's useAppLock, LockScreen, AppLockSection and LockOffer tests.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import * as LocalAuthentication from 'expo-local-authentication'
import { useState } from 'react'
import { AccessibilityInfo, AppState, type AppStateStatus, Pressable, Text } from 'react-native'
import { Sheet } from '../../components/ui/Sheet'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { OnboardingGate } from '../../onboarding/OnboardingGate'
import { AppLockPage } from '../../settings/AppLockPage'
import { Providers, startAttempt } from '../../today/__tests__/support'
import { LockBypassBanner } from '../LockBypassBanner'
import { hashPin, verifyPin } from '../pin'
import { setLockStatus } from '../store'
import { AppLock } from '../useAppLock'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
// The duck's frame loop never lets a render settle in Jest: a line stands in.
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood }: { mood: string }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}`}</Line>
  },
}))
jest.mock('expo-crypto', () => ({ ...jest.requireActual('expo-crypto'), getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }))
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'user_cancel' })),
}))
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync)
const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync)
const enrolled = jest.mocked(LocalAuthentication.isEnrolledAsync)

const PIN = '482915'

let appStateListeners: ((state: AppStateStatus) => void)[] = []
beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  authenticate.mockReset().mockResolvedValue({ success: false, error: 'user_cancel' })
  hasHardware.mockResolvedValue(false)
  enrolled.mockResolvedValue(false)
  appStateListeners = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void)
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) } as ReturnType<typeof AppState.addEventListener>
  })
  setLockStatus('open')
  await freshDatabase()
})
afterEach(() => jest.restoreAllMocks())

const goTo = (state: AppStateStatus) => act(async () => appStateListeners.forEach((listener) => listener(state)))
const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }))
async function typePin(pin: string) {
  for (const digit of pin) await fireEvent.press(screen.getByRole('button', { name: digit }))
}
const lockTitle = () => screen.queryByRole('header', { name: / is locked$/ })

/** The app under the lock, with a sheet it can open (to see that it hides under the lock). */
function Shell() {
  const [open, setOpen] = useState(false)
  return (
    <AppLock>
      <Text>the app</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text>open sheet</Text>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} label="A sheet">
        <Text>in the sheet</Text>
      </Sheet>
    </AppLock>
  )
}

describe('the PIN', () => {
  it('is never kept as typed, and is recognised again', async () => {
    const stored = await hashPin(PIN, 1000)
    expect(JSON.stringify(stored)).not.toContain(PIN)
    expect(await verifyPin(PIN, stored)).toBe(true)
    expect(await verifyPin('482916', stored)).toBe(false)
    expect(await verifyPin('48291', stored)).toBe(false)
  })

  it('counts wrong PINs across launches, then waits, checking nothing meanwhile', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    const now = 1_000_000
    for (let i = 1; i <= 4; i++) expect(await appLockRepo.checkPin('111111', now)).toEqual({ ok: false, failures: { count: i, lockedUntil: null } })
    expect(await appLockRepo.checkPin('111111', now)).toEqual({ ok: false, failures: { count: 5, lockedUntil: now + 30_000 } })
    // During the wait even the right PIN isn't checked.
    expect((await appLockRepo.checkPin(PIN, now + 1000)).ok).toBe(false)
    expect(await appLockRepo.checkPin(PIN, now + 31_000)).toEqual({ ok: true })
    expect(await appLockRepo.getFailures()).toEqual({ count: 0, lockedUntil: null })
  })
})

describe('the lock', () => {
  it('stays out of the way while off', async () => {
    await render(<Shell />, { wrapper: Providers })
    expect(await screen.findByText('the app')).toBeOnTheScreen()
    expect(lockTitle()).toBeNull()
  })

  it('opens locked, refuses a wrong PIN, and opens with the right one', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await render(<Shell />, { wrapper: Providers })
    expect(await screen.findByRole('header', { name: / is locked$/ })).toBeOnTheScreen()
    // Hidden from VoiceOver underneath.
    expect(screen.queryByText('the app')).toBeNull()
    await typePin('111111')
    expect(await screen.findByText('Wrong PIN. 4 tries left before a wait.')).toBeOnTheScreen()
    await typePin(PIN)
    await waitFor(() => expect(lockTitle()).toBeNull())
    expect(screen.getByText('the app')).toBeOnTheScreen()
  })

  it("doesn't lock when turned on mid-session; locks again after more than a minute away, covering the app meanwhile", async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0)
    await render(<Shell />, { wrapper: Providers })
    await screen.findByText('the app')
    const before = appStateListeners.length
    await act(async () => appLockRepo.enable(await hashPin(PIN, 1000)))
    await waitFor(() => expect(appStateListeners).toHaveLength(before + 1))
    expect(lockTitle()).toBeNull()

    await goTo('inactive')
    expect(screen.getByTestId('privacy-cover')).toBeOnTheScreen()
    await goTo('background')
    clock.mockReturnValue(30_000)
    await goTo('active')
    expect(lockTitle()).toBeNull()
    expect(screen.queryByTestId('privacy-cover')).toBeNull()

    await goTo('background')
    clock.mockReturnValue(100_000)
    await goTo('active')
    expect(await screen.findByRole('header', { name: / is locked$/ })).toBeOnTheScreen()
  })

  it('hides an open sheet while locked, and brings it back once unlocked', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0)
    await render(<Shell />, { wrapper: Providers })
    await act(async () => appLockRepo.enable(await hashPin(PIN, 1000)))
    await press('open sheet')
    expect(await screen.findByText('in the sheet')).toBeOnTheScreen()
    await goTo('background')
    clock.mockReturnValue(100_000)
    await goTo('active')
    await screen.findByRole('header', { name: / is locked$/ })
    expect(screen.queryByText('in the sheet')).toBeNull()
    clock.mockRestore()
    await typePin(PIN)
    expect(await screen.findByText('in the sheet')).toBeOnTheScreen()
  })

  it('asks Face ID once on its own; "Forgot PIN?" sets a new PIN after Face ID', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await appLockRepo.setFaceId(true)
    await render(<Shell />, { wrapper: Providers })
    await screen.findByRole('header', { name: / is locked$/ })
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1))

    authenticate.mockResolvedValueOnce({ success: true })
    await press('Forgot PIN?')
    expect(await screen.findByRole('header', { name: 'Choose a new PIN' })).toBeOnTheScreen()
    await typePin('739104')
    await typePin('739104')
    await waitFor(() => expect(lockTitle()).toBeNull())
    const config = (await appLockRepo.get())!
    expect(await verifyPin('739104', config.pin!)).toBe(true)
    expect(config.credentialId).toBeDefined()
  })

  it('opens with Face ID from its key', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await appLockRepo.setFaceId(true)
    await render(<Shell />, { wrapper: Providers })
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1))
    authenticate.mockResolvedValueOnce({ success: true })
    await press('Unlock with Face ID')
    await waitFor(() => expect(lockTitle()).toBeNull())
  })

  it('turns itself off with "Can\'t unlock?", after asking, and leaves the notice on Today', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await render(
      <>
        <Shell />
        <LockBypassBanner />
      </>,
      { wrapper: Providers },
    )
    await press("Can't unlock?")
    expect(await screen.findByRole('header', { name: 'Turn the lock off?' })).toBeOnTheScreen()
    await press('Cancel')
    await press("Can't unlock?")
    await press('Turn off and open')
    await waitFor(() => expect(lockTitle()).toBeNull())
    expect(await appLockRepo.get()).toBeNull()
    expect(await screen.findByText(/^🔓 The app lock was turned off on /)).toBeOnTheScreen()
    await press('Got it')
    await waitFor(() => expect(screen.queryByText(/^🔓 The app lock/)).toBeNull())
  })
})

describe('Settings → App lock', () => {
  const page = () => render(<AppLockPage />, { wrapper: Providers })

  it('turns on with a PIN typed twice, refusing one too easy to guess', async () => {
    await page()
    await press('Turn on the app lock')
    await typePin('123456')
    expect(await screen.findByText('Too easy to guess. Try another one.')).toBeOnTheScreen()
    await typePin(PIN)
    expect(await screen.findByRole('header', { name: 'Type it again' })).toBeOnTheScreen()
    await typePin('482916')
    expect(await screen.findByText("Those didn't match. Start again.")).toBeOnTheScreen()
    await typePin(PIN)
    await typePin(PIN)
    await waitFor(async () => expect(await appLockRepo.get()).not.toBeNull())
    expect(await verifyPin(PIN, (await appLockRepo.get())!.pin!)).toBe(true)
    expect(await screen.findByRole('button', { name: 'Change PIN' })).toBeOnTheScreen()
    // No Face ID on this phone: no switch.
    expect(screen.queryByRole('switch', { name: 'Also unlock with Face ID' })).toBeNull()
  })

  it('asks the current PIN before changing it or turning the lock off', async () => {
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await page()
    await press('Change PIN')
    expect(await screen.findByRole('header', { name: 'Enter your current PIN' })).toBeOnTheScreen()
    await typePin('111111')
    expect(await screen.findByText('Wrong PIN. 4 tries left before a wait.')).toBeOnTheScreen()
    await typePin(PIN)
    expect(await screen.findByRole('header', { name: 'Choose a new PIN' })).toBeOnTheScreen()
    await press('Cancel')

    await press('Turn off the app lock')
    expect(await screen.findByRole('header', { name: 'Enter your PIN to turn the lock off' })).toBeOnTheScreen()
    await typePin(PIN)
    await waitFor(async () => expect(await appLockRepo.get()).toBeNull())
    expect(await screen.findByRole('button', { name: 'Turn on the app lock' })).toBeOnTheScreen()
  })

  it('adds Face ID only once the phone has confirmed it', async () => {
    hasHardware.mockResolvedValue(true)
    enrolled.mockResolvedValue(true)
    await appLockRepo.enable(await hashPin(PIN, 1000))
    await page()
    const toggle = await screen.findByRole('switch', { name: 'Also unlock with Face ID' })
    await fireEvent.press(toggle)
    expect(await screen.findByText("Face ID didn't confirm, so it's still off. Try again.")).toBeOnTheScreen()
    expect((await appLockRepo.get())?.credentialId).toBeUndefined()

    authenticate.mockResolvedValueOnce({ success: true })
    await fireEvent.press(screen.getByRole('switch', { name: 'Also unlock with Face ID' }))
    await waitFor(async () => expect((await appLockRepo.get())?.credentialId).toBeDefined())
    expect(screen.getByRole('switch', { name: 'Also unlock with Face ID' })).toBeChecked()
  })
})

describe('the offer after the deal', () => {
  const gate = () =>
    render(
      <OnboardingGate>
        <Text>the app</Text>
      </OnboardingGate>,
      { wrapper: Providers },
    )

  it('sets a PIN, asks for Face ID where the phone has it, and is shown once', async () => {
    hasHardware.mockResolvedValue(true)
    enrolled.mockResolvedValue(true)
    await gate()
    await screen.findByText('Get started')
    await act(async () => void (await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })))
    expect(await screen.findByRole('header', { name: 'Keep it private?' })).toBeOnTheScreen()
    await press('Set a PIN')
    await typePin(PIN)
    await typePin(PIN)
    expect(await screen.findByRole('header', { name: 'Also unlock with Face ID?' })).toBeOnTheScreen()
    authenticate.mockResolvedValueOnce({ success: true })
    await press('Turn on Face ID')
    expect(await screen.findByText('the app')).toBeOnTheScreen()
    expect(await appLockRepo.get()).toMatchObject({ credentialId: expect.any(String) })
  })

  it('is not shown to someone who already has a profile', async () => {
    await startAttempt(1)
    await gate()
    expect(await screen.findByText('the app')).toBeOnTheScreen()
    expect(screen.queryByText('Keep it private?')).toBeNull()
  })
})
