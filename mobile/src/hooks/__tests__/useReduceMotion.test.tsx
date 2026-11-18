import { act, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Text } from 'react-native'
import { useReduceMotion } from '../useReduceMotion'

const seen: boolean[] = []

/** Something that is on screen for the whole life of the app, as AppGate is. */
function Root({ late }: { late: boolean }) {
  const reduced = useReduceMotion()
  return (
    <>
      <Text>{`root: ${reduced}`}</Text>
      {late && <Late />}
    </>
  )
}

/** Something that appears later and animates at once (the day-complete peak, a status line). */
function Late() {
  seen.push(useReduceMotion())
  return null
}

afterEach(() => {
  seen.length = 0
  jest.restoreAllMocks()
})

it('tells a screen that appears later the phone’s answer on its very first render', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  const view = await render(<Root late={false} />)
  expect(await screen.findByText('root: true')).toBeOnTheScreen()

  await view.rerender(<Root late />)
  // Never "motion allowed" first: an animation started on that render would be cut short and left half way.
  expect(seen[0]).toBe(true)
  expect(new Set(seen)).toEqual(new Set([true]))
})

it('follows the setting when it changes, and asks again once nothing was listening', async () => {
  let changed: (value: boolean) => void = () => undefined
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, listener: (value: boolean) => void) => {
    changed = listener
    return { remove: jest.fn() }
  }) as never)
  const view = await render(<Root late={false} />)
  expect(await screen.findByText('root: false')).toBeOnTheScreen()
  await act(async () => changed(true))
  expect(screen.getByText('root: true')).toBeOnTheScreen()
  await view.unmount()
  const asked = jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mock.calls.length

  // A fresh start (each test, each launch) doesn't inherit the last answer.
  await render(<Root late={false} />)
  expect(screen.getByText('root: false')).toBeOnTheScreen()
  await waitFor(() => expect(jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mock.calls.length).toBeGreaterThan(asked))
})
