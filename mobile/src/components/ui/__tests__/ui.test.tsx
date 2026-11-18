import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import type { ReactElement, ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { BASE_COLORS, withAlpha } from '../../../theme/tokens'
import { Button } from '../Button'
import { Field } from '../Field'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))

const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>
const show = (ui: ReactElement) => render(ui, { wrapper: Providers })

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
})

describe('withAlpha', () => {
  it('turns a hex colour into an rgba one', () => {
    expect(withAlpha('#2a211b', 0.08)).toBe('rgba(42, 33, 27, 0.08)')
  })
})

describe('Button', () => {
  it('shows its label and tells when it is pressed', async () => {
    const onPress = jest.fn()
    await show(<Button label="Start" onPress={onPress} />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Start' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled, and says so to screen readers', async () => {
    const onPress = jest.fn()
    await show(<Button label="Start" onPress={onPress} disabled />)
    const button = await screen.findByRole('button', { name: 'Start' })
    await fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('is a pill at least 48 points tall, in the world colour by default', async () => {
    await show(<Button label="Start" onPress={() => {}} />)
    const style = StyleSheet.flatten((await screen.findByRole('button')).props.style)
    expect(style.minHeight).toBeGreaterThanOrEqual(48)
    expect(style.borderRadius).toBeGreaterThanOrEqual(24)
    // Light Hell, the world before any challenge.
    expect(style.backgroundColor).toBe('#c98a3a')
  })

  it('has a red fill with white text for dangerous actions', async () => {
    await show(<Button label="Erase" onPress={() => {}} variant="danger" />)
    const style = StyleSheet.flatten((await screen.findByRole('button')).props.style)
    expect(style.backgroundColor).toBe(BASE_COLORS.light.dangerDark)
    expect(StyleSheet.flatten(screen.getByText('Erase').props.style).color).toBe('#ffffff')
  })
})

describe('Field', () => {
  it('labels what is inside it, with its unit', async () => {
    await show(
      <Field label="Weight" unit="kg">
        <Text>input</Text>
      </Field>,
    )
    expect(await screen.findByText('Weight (kg)')).toBeOnTheScreen()
    expect(screen.getByText('input')).toBeOnTheScreen()
  })

  it('shows an error under the input, announced as an alert', async () => {
    await show(
      <Field label="Name" error="Tell me your name.">
        <Text>input</Text>
      </Field>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Tell me your name.')
  })
})
