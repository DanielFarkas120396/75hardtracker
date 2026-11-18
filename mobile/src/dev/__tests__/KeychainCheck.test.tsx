import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import type { ReactNode } from 'react'
import * as keychain from '../../../modules/synced-keychain'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { KeychainCheck } from '../KeychainCheck'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
// The keychain is Swift code: here it is a map.
jest.mock('../../../modules/synced-keychain', () => {
  const items = new Map<string, string>()
  return {
    isAvailable: true,
    setItem: jest.fn(async (key: string, value: string) => void items.set(key, value)),
    getItem: jest.fn(async (key: string) => items.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => void items.delete(key)),
  }
})

const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
  await keychain.removeItem('keychain-check')
})

it('shows "No value" on a first launch', async () => {
  await render(<KeychainCheck />, { wrapper: Providers })
  expect(await screen.findByText('No value')).toBeOnTheScreen()
})

it('writes the time, shows it, and removes it', async () => {
  await render(<KeychainCheck />, { wrapper: Providers })
  await fireEvent.press(await screen.findByText('Write the time'))
  expect(await screen.findByText(/^\d{4}-\d{2}-\d{2}T/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Remove'))
  expect(await screen.findByText('No value')).toBeOnTheScreen()
})

it('shows what went wrong instead of crashing', async () => {
  jest.mocked(keychain.getItem).mockRejectedValueOnce(new Error('Keychain read failed (-25308)'))
  await render(<KeychainCheck />, { wrapper: Providers })
  expect(await screen.findByText('Keychain read failed (-25308)')).toBeOnTheScreen()
})
