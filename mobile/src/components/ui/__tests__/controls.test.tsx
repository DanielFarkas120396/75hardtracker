import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import type { ReactElement } from 'react'
import { Text } from 'react-native'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { Providers } from '../../../today/__tests__/support'
import { FlameStreak, GaugeRing, litBars } from '../../GaugeRing'
import { DoneBadge, MoodPicker, Stepper, Toggle } from '../controls'
import { Sheet } from '../Sheet'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))

const show = (ui: ReactElement) => render(ui, { wrapper: Providers })

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
})

describe('Stepper', () => {
  it('steps by a signed amount, and stops at its bounds', async () => {
    const onStep = jest.fn()
    const view = await show(<Stepper value={45} onStep={onStep} step={5} min={0} max={50} unit="min" />)
    expect(await screen.findByText(/45/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByLabelText('Increase'))
    await fireEvent.press(screen.getByLabelText('Decrease'))
    expect(onStep.mock.calls).toEqual([[5], [-5]])

    await view.rerender(<Stepper value={50} onStep={onStep} step={5} min={0} max={50} />)
    expect(screen.getByLabelText('Increase')).toBeDisabled()
    await view.rerender(<Stepper value={0} onStep={onStep} step={5} min={0} max={50} />)
    expect(screen.getByLabelText('Decrease')).toBeDisabled()
  })
})

describe('Toggle', () => {
  it('is a switch named by its label, and asks for the other state', async () => {
    const onChange = jest.fn()
    await show(<Toggle checked={false} onChange={onChange} label="No alcohol" />)
    const toggle = await screen.findByRole('switch', { name: 'No alcohol' })
    expect(toggle).not.toBeChecked()
    await fireEvent.press(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('MoodPicker', () => {
  it('offers the five moods, worst to best, and marks the chosen one', async () => {
    const onPick = jest.fn()
    await show(<MoodPicker label="Mood" value={4} onPick={onPick} selected={{ fill: '#ffffff', ring: '#000000' }} />)
    await screen.findByLabelText('Mood')
    for (const mood of ['Rough', 'Meh', 'Okay', 'Good', 'Great']) expect(screen.getByRole('button', { name: mood })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Good' })).toBeSelected()
    expect(screen.getByRole('button', { name: 'Great' })).not.toBeSelected()
    await fireEvent.press(screen.getByRole('button', { name: 'Rough' }))
    expect(onPick).toHaveBeenCalledWith(1)
  })
})

describe('GaugeRing', () => {
  it('says how many tasks are done', async () => {
    await show(<GaugeRing value={3} max={5} />)
    expect(await screen.findByLabelText('3 of 5 tasks done')).toBeOnTheScreen()
  })

  it('lights its 41 bars in step with the tasks', () => {
    expect(litBars(0, 5)).toBe(0)
    expect(litBars(3, 5)).toBe(25)
    expect(litBars(5, 5)).toBe(41)
    expect(litBars(9, 5)).toBe(41)
    expect(litBars(1, 0)).toBe(0)
  })
})

describe('FlameStreak', () => {
  it('names the streak in days', async () => {
    const view = await show(<FlameStreak streak={1} />)
    expect(await screen.findByLabelText('Streak: 1 day')).toBeOnTheScreen()
    await view.rerender(<FlameStreak streak={12} />)
    expect(screen.getByLabelText('Streak: 12 days')).toBeOnTheScreen()
  })
})

describe('DoneBadge', () => {
  it('is a tick', async () => {
    await show(<DoneBadge pop={false} />)
    expect(await screen.findByText('✓', { includeHiddenElements: true })).toBeOnTheScreen()
  })
})

describe('Sheet', () => {
  const sheet = (open: boolean, onClose = jest.fn()) => (
    <Sheet open={open} onClose={onClose} label="Water">
      <Text>inside the sheet</Text>
    </Sheet>
  )

  it('shows what it holds while open, and nothing once it has closed', async () => {
    const view = await show(sheet(false))
    expect(screen.queryByText('inside the sheet')).toBeNull()
    await view.rerender(sheet(true))
    expect(await screen.findByText('inside the sheet')).toBeOnTheScreen()
    await view.rerender(sheet(false))
    await waitFor(() => expect(screen.queryByText('inside the sheet')).toBeNull())
  })

  it('closes on a tap beside it', async () => {
    const onClose = jest.fn()
    await show(sheet(true, onClose))
    await fireEvent.press(await screen.findByTestId('sheet-backdrop', { includeHiddenElements: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
