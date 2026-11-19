// Badges and the toast stack: the cases of the plan's Review Focus 4 and 5
// (docs/superpowers/plans/2026-11-19-v4-part-8-settings.md), from the web's useBadgeUnlocks and ToastStack tests.
import { BADGE_DEFINITIONS } from '@logic/badges'
import { addDaysISO } from '@logic/dates'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { useState } from 'react'
import { AccessibilityInfo, Pressable, Text } from 'react-native'
import { useBadgeUnlocks } from '../../badges/useBadgeUnlocks'
import { addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { setSaveFailureListener, transaction } from '../../db/open'
import { badgeRepo } from '../../db/repositories/badgeRepo'
import { useGate } from '../../hooks/useChallengeGate'
import { useHideTabBar, useTabBarHidden } from '../../hooks/useTabBar'
import { setCoverShown, setLockStatus } from '../../lock/store'
import { BadgesPage } from '../../settings/BadgesPage'
import { Providers, startAttempt, TODAY } from '../../today/__tests__/support'
import { noteSaveFailure, queueBadges, resetToastsForTests } from '../store'
import { ToastStack } from '../ToastStack'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  resetToastsForTests()
  setLockStatus('open')
  setCoverShown(false)
  await freshDatabase()
})
afterEach(() => {
  jest.useRealTimers()
  setSaveFailureListener(undefined)
})

const badge = (id: string) => BADGE_DEFINITIONS.find((b) => b.id === id)!
const front = () => screen.queryByRole('button', { name: /Tap to dismiss\.$/ })

/** The tabs' layout as far as badges go: the watcher, and something that can hide the tab bar. */
function App() {
  const [covered, setCovered] = useState(false)
  const hidden = useTabBarHidden()
  useBadgeUnlocks(useGate(), hidden)
  return (
    <>
      {covered && <Cover />}
      <Pressable accessibilityRole="button" onPress={() => setCovered(!covered)}>
        <Text>cover</Text>
      </Pressable>
      <ToastStack />
    </>
  )
}
function Cover() {
  useHideTabBar()
  return null
}

describe('badges', () => {
  it('unlocks what the attempt has earned, once, with a toast each, queued', async () => {
    const id = await startAttempt(3)
    await addPerfectDays(id, addDaysISO(TODAY, -2), 1, 2)
    await render(<App />, { wrapper: Providers })
    // Two perfect days: the first workout, outdoors, the first perfect day, the water, the photo.
    expect(await screen.findByRole('button', { name: 'Badge unlocked: First Rep. Logged your first workout. Tap to dismiss.' })).toBeOnTheScreen()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Badge unlocked: First Rep. Logged your first workout.')
    const unlocked = (await badgeRepo.getForChallenge(id)).map((b) => b.badgeId).sort()
    expect(unlocked).toEqual(['first-outdoor-workout', 'first-perfect-day', 'first-photo', 'first-water-goal', 'first-workout'])
    // Never twice, even when two reads race.
    expect(await badgeRepo.unlockMissing(id, ['first-workout', 'first-workout'])).toEqual([])

    await fireEvent.press(front()!)
    expect(await screen.findByRole('button', { name: /^Badge unlocked: Fresh Air/ })).toBeOnTheScreen()
  })

  it('waits while a covering screen is up, and under the lock', async () => {
    const id = await startAttempt(3)
    await render(<App />, { wrapper: Providers })
    await fireEvent.press(screen.getByRole('button', { name: 'cover' }))
    await addPerfectDays(id, addDaysISO(TODAY, -2), 1, 1)
    await waitFor(async () => expect(await badgeRepo.getForChallenge(id)).not.toHaveLength(0))
    expect(front()).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'cover' }))
    expect(await screen.findByRole('button', { name: /^Badge unlocked: First Rep/ })).toBeOnTheScreen()

    await act(async () => setLockStatus('locked'))
    expect(front()).toBeNull()
    await act(async () => setLockStatus('open'))
    expect(front()).not.toBeNull()
    // Nor over the app-switcher cover.
    await act(async () => setCoverShown(true))
    expect(front()).toBeNull()
    await act(async () => setCoverShown(false))
    expect(front()).not.toBeNull()
  })

  it('counts them on the Badges page', async () => {
    const id = await startAttempt(1)
    await badgeRepo.unlockMissing(id, ['first-workout', 'first-photo'])
    await render(<BadgesPage challengeId={id} />, { wrapper: Providers })
    expect(await screen.findByText(`Badges (2/${BADGE_DEFINITIONS.length})`)).toBeOnTheScreen()
    expect(screen.getByLabelText('First Rep, unlocked. Logged your first workout.')).toBeOnTheScreen()
    expect(screen.getByLabelText(/^Bookworm, locked\./)).toBeOnTheScreen()
  })
})

describe('the toast stack', () => {
  it('times the front toast out, quicker with a queue, and peeks two behind it', async () => {
    jest.useFakeTimers()
    await render(<ToastStack />, { wrapper: Providers })
    await act(async () => queueBadges([badge('first-workout'), badge('first-photo'), badge('first-perfect-day'), badge('first-water-goal')]))
    expect(front()).toHaveAccessibleName(/^Badge unlocked: First Rep/)
    // Three cards drawn: the front one and two edges.
    expect(screen.getAllByText(/^Badge unlocked/, { includeHiddenElements: true })).toHaveLength(3)
    await act(async () => void jest.advanceTimersByTime(3000))
    expect(front()).toHaveAccessibleName(/^Badge unlocked: Say Cheese/)
    await act(async () => void jest.advanceTimersByTime(3000 * 2))
    // The last one alone stays its full time.
    expect(front()).toHaveAccessibleName(/^Badge unlocked: Hydrated/)
    await act(async () => void jest.advanceTimersByTime(4000))
    expect(front()).not.toBeNull()
    await act(async () => void jest.advanceTimersByTime(600))
    expect(front()).toBeNull()
  })

  it('puts a failed save in front, even under the lock', async () => {
    await act(async () => setLockStatus('locked'))
    await render(<ToastStack />, { wrapper: Providers })
    await act(async () => {
      queueBadges([badge('first-workout')])
      noteSaveFailure()
    })
    expect(front()).toHaveAccessibleName("Couldn't save that. Try again. If it keeps happening, your phone may be full. Tap to dismiss.")
    expect(screen.queryByText(/^Badge unlocked/, { includeHiddenElements: true })).toBeNull()
  })

  it('hears of a write the database refused, not of a task that said no', async () => {
    setSaveFailureListener(noteSaveFailure)
    await render(<ToastStack />, { wrapper: Providers })
    await expect(
      transaction(async () => {
        throw new Error('a rule said no')
      }),
    ).rejects.toThrow('a rule said no')
    expect(front()).toBeNull()
    await expect(act(() => transaction((db) => db.runAsync('INSERT INTO nowhere (x) VALUES (1)')))).rejects.toThrow()
    expect(await screen.findByRole('button', { name: /^Couldn't save that/ })).toBeOnTheScreen()
  })
})
