import { act, render } from '@testing-library/react-native'
import TabsLayout from '../app/(tabs)/_layout'
import { freshDatabase } from '../db/__tests__/fixtures'
import { useHideTabBar } from '../hooks/useTabBar'
import { ThemeProvider } from '../theme/ThemeProvider'

const mockNavigate = jest.fn()
const mockTabs = jest.fn()
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }))
jest.mock('expo-router', () => ({ router: { navigate: (href: string) => mockNavigate(href) } }))
jest.mock('expo-router/native-tabs', () => {
  const NativeTabs = (props: { hidden: boolean }) => {
    mockTabs(props.hidden)
    return null
  }
  const nothing = () => null
  NativeTabs.Trigger = Object.assign(nothing, { Label: nothing, Icon: nothing })
  return { NativeTabs }
})

beforeEach(freshDatabase)

function Covering() {
  useHideTabBar()
  return null
}

it('brings Today to the front when a screen there hides the tab bar, so no other tab is left without a way out', async () => {
  const ui = (covered: boolean) => (
    <ThemeProvider>
      <TabsLayout />
      {covered && <Covering />}
    </ThemeProvider>
  )
  const view = await render(ui(false))
  await act(async () => {})
  expect(mockTabs).toHaveBeenLastCalledWith(false)
  expect(mockNavigate).not.toHaveBeenCalled()

  await view.rerender(ui(true))
  expect(mockTabs).toHaveBeenLastCalledWith(true)
  expect(mockNavigate).toHaveBeenCalledWith('/')

  await view.rerender(ui(false))
  expect(mockTabs).toHaveBeenLastCalledWith(false)
  expect(mockNavigate).toHaveBeenCalledTimes(1)
})
