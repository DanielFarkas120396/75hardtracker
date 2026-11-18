import { typedStroke, type Point } from '@logic/checkmark'
import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import type { ReactElement, ReactNode } from 'react'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { DrawCheckPad } from '../DrawCheckPad'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))

const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>
const show = (ui: ReactElement) => render(ui, { wrapper: Providers })

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
})

const at = (point: Point) => ({ nativeEvent: { locationX: point.x, locationY: point.y } })
const pad = () => screen.getByRole('button', { name: 'Sign the deal: draw a checkmark.' })

/** A finger going through the points, lifting at the last one. */
async function draw(points: Point[]) {
  await fireEvent(pad(), 'responderGrant', at(points[0]))
  for (const point of points.slice(1, -1)) await fireEvent(pad(), 'responderMove', at(point))
  await fireEvent(pad(), 'responderRelease', at(points[points.length - 1]))
}

const CHECK = typedStroke(320, 192)
const FLAT_LINE = Array.from({ length: 20 }, (_, i) => ({ x: 20 + i * 14, y: 100 }))

async function showPad(disabled = false) {
  const onChange = jest.fn()
  await show(<DrawCheckPad label="Sign the deal: draw a checkmark." onChange={onChange} disabled={disabled} />)
  await screen.findByRole('button', { name: 'Sign the deal: draw a checkmark.' })
  return onChange
}

it('takes a drawn checkmark as a signature', async () => {
  const onChange = await showPad()
  await draw(CHECK)
  expect(onChange).toHaveBeenLastCalledWith(true)
  expect(screen.getByText('Signed.')).toBeOnTheScreen()
})

it('refuses a stroke that isn’t a checkmark, and says to try again', async () => {
  const onChange = await showPad()
  await draw(FLAT_LINE)
  expect(onChange).toHaveBeenLastCalledWith(false)
  expect(screen.getByText('Not quite a checkmark. Try again.')).toBeOnTheScreen()
})

it('unsigns the moment a new stroke starts', async () => {
  const onChange = await showPad()
  await draw(CHECK)
  await fireEvent(pad(), 'responderGrant', at(FLAT_LINE[0]))
  expect(onChange).toHaveBeenLastCalledWith(false)
  expect(screen.queryByText('Signed.')).toBeNull()
})

it('clears a stroke with the × button', async () => {
  const onChange = await showPad()
  expect(screen.queryByLabelText('Clear the drawing')).toBeNull()
  await draw(FLAT_LINE)
  await fireEvent.press(screen.getByLabelText('Clear the drawing'))
  expect(screen.queryByText('Not quite a checkmark. Try again.')).toBeNull()
  expect(screen.queryByLabelText('Clear the drawing')).toBeNull()
  expect(onChange).toHaveBeenLastCalledWith(false)
})

it('signs for VoiceOver users without drawing', async () => {
  const onChange = await showPad()
  await fireEvent(pad(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
  expect(onChange).toHaveBeenLastCalledWith(true)
  expect(screen.getByText('Signed.')).toBeOnTheScreen()
})

it('keeps the touch while drawing, so the page under it can’t scroll away', async () => {
  await showPad()
  expect(pad().props.onStartShouldSetResponder()).toBe(true)
  expect(pad().props.onResponderTerminationRequest()).toBe(false)
})

it('ignores touches and VoiceOver while disabled', async () => {
  const onChange = await showPad(true)
  expect(pad().props.onStartShouldSetResponder()).toBe(false)
  await fireEvent(pad(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
  expect(onChange).not.toHaveBeenCalled()
  expect(pad()).toBeDisabled()
})
