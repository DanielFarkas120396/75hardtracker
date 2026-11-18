import { SETTING_KEYS } from '@logic/settingKeys'
import { addDaysISO, todayISO } from '@logic/dates'
import { render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { Appearance, Text } from 'react-native'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { ThemeProvider, useTheme } from '../ThemeProvider'

// The real fonts can't load in tests: say they loaded, except where a test says otherwise.
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
const useFonts = jest.mocked(Font.useFonts)

function Probe() {
  const theme = useTheme()
  return (
    <Text style={{ fontFamily: theme.fonts.rounded.regular }}>
      {`${theme.mode} ${theme.world} ${theme.colors.canvas} fonts:${theme.fontStatus}`}
    </Text>
  )
}

const show = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

beforeEach(async () => {
  await freshDatabase()
  jest.restoreAllMocks()
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light')
  useFonts.mockReturnValue([true, null])
})

it('follows the phone when nothing is saved: light Hell before any challenge', async () => {
  await show()
  expect(await screen.findByText(/^light hell #f9f3ea/)).toBeOnTheScreen()
})

it('follows the saved theme over the phone’s', async () => {
  await settingsRepo.set(SETTING_KEYS.theme, 'dark')
  await show()
  expect(await screen.findByText(/^dark hell #16110e/)).toBeOnTheScreen()
})

it('ignores a saved theme that isn’t one', async () => {
  await settingsRepo.set(SETTING_KEYS.theme, 'sepia')
  await show()
  expect(await screen.findByText(/^light hell/)).toBeOnTheScreen()
})

it('wears the world of the current day', async () => {
  await addChallenge({ startDate: addDaysISO(todayISO(), -29), attemptNumber: 1, status: 'active' })
  await show()
  expect(await screen.findByText(/^light forest/)).toBeOnTheScreen()
})

it('wears heaven after victory', async () => {
  await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'completed' })
  await show()
  expect(await screen.findByText(/^light heaven/)).toBeOnTheScreen()
})

it('uses the app’s fonts once they are loaded', async () => {
  await show()
  const text = await screen.findByText(/fonts:ready$/)
  expect(text.props.style.fontFamily).toBe('DMSans_400Regular')
})

it('still renders when the fonts fail, in the system font', async () => {
  useFonts.mockReturnValue([false, new Error('no fonts')])
  await show()
  const text = await screen.findByText(/fonts:failed$/)
  expect(text).toBeOnTheScreen()
  expect(text.props.style.fontFamily).toBeUndefined()
})
