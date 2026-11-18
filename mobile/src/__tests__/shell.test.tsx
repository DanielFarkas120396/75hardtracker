import { SETTING_KEYS } from '@logic/settingKeys'
import { dayNumberForDate, todayISO } from '@logic/dates'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import TodayScreen from '../app/(tabs)/index'
import SettingsScreen from '../app/(tabs)/settings'
import { AppGate } from '../components/AppGate'
import { addChallenge, freshDatabase } from '../db/__tests__/fixtures'
import * as open from '../db/open'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { seedDay } from '../dev/seed'
import { ThemeProvider } from '../theme/ThemeProvider'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => {}), preventAutoHideAsync: jest.fn(async () => {}) }))
const hideSplash = jest.mocked(SplashScreen.hideAsync)
jest.mock('../db/open', () => ({ ...jest.requireActual('../db/open'), openAppDatabase: jest.fn() }))
const openAppDatabase = jest.mocked(open.openAppDatabase)

const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  hideSplash.mockClear()
  await freshDatabase()
})

describe('Today', () => {
  it('shows the day of the current challenge', async () => {
    await seedDay(12)
    await render(<TodayScreen />, { wrapper: Providers })
    expect(await screen.findByText('Day 12 of 75')).toBeOnTheScreen()
  })

  it('says so when there is no challenge', async () => {
    await render(<TodayScreen />, { wrapper: Providers })
    expect(await screen.findByText('No challenge yet')).toBeOnTheScreen()
  })

  it('says so when the challenge starts later', async () => {
    await seedDay(-2)
    await render(<TodayScreen />, { wrapper: Providers })
    expect(await screen.findByText('Not started yet')).toBeOnTheScreen()
  })
})

describe('seedDay', () => {
  it('replaces whatever was there with one attempt on that day', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 4, status: 'failed' })
    await settingsRepo.set(SETTING_KEYS.bedtime, '22:30')
    await seedDay(30)
    const challenges = await challengeRepo.getAll()
    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({ attemptNumber: 1, status: 'active', variant: 'hard' })
    expect(dayNumberForDate(challenges[0].startDate, todayISO())).toBe(30)
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, 'none')).toBe('none')
  })
})

describe('Settings', () => {
  it('has a developer button that seeds Day 12', async () => {
    await render(<SettingsScreen />, { wrapper: Providers })
    await fireEvent.press(await screen.findByText('Seed Day 12'))
    await waitFor(async () => {
      const current = await challengeRepo.getCurrent()
      expect(current && dayNumberForDate(current.startDate, todayISO())).toBe(12)
    })
  })
})

describe('opening the app', () => {
  it('shows the app once the database is open', async () => {
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText('inside')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
  })

  it('keeps the splash screen up while the fonts are loading', async () => {
    jest.mocked(Font.useFonts).mockReturnValue([false, null])
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate>
        <Text>inside</Text>
      </AppGate>,
    )
    await waitFor(() => expect(openAppDatabase).toHaveBeenCalled())
    expect(screen.queryByText('inside')).toBeNull()
    expect(hideSplash).not.toHaveBeenCalled()
  })

  it('lifts the splash screen and shows the app when the fonts fail', async () => {
    jest.mocked(Font.useFonts).mockReturnValue([false, new Error('no fonts')])
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText('inside')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
  })

  it('shows an error screen when the database can’t open', async () => {
    openAppDatabase.mockRejectedValue(new Error('disk full'))
    await render(
      <AppGate>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText("Your data couldn't be opened.")).toBeOnTheScreen()
    expect(screen.getByText('disk full')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
    expect(screen.queryByText('inside')).toBeNull()
  })
})
